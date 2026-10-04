const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');

const authLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 15,
    message: 'Too many login/signup attempts. Please try again after 60 seconds.'
});

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error('JWT_SECRET is missing from environment variables.');
    }
    return secret;
};

// @route   POST api/auth/admin-internal-signup
// @desc    Register a new admin user (requires ADMIN_SECRET_KEY)
// @access  Public (protected by secret key)
router.post('/admin-internal-signup', authLimiter, async (req, res) => {
    const { username, email, password, secretKey } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ msg: 'Username, email, and password are required.' });
    }

    if (!process.env.ADMIN_SECRET_KEY) {
        return res.status(500).json({ msg: 'Server configuration error: ADMIN_SECRET_KEY not set.' });
    }

    // Validate the admin secret key strictly against the environment variable
    if (!secretKey || secretKey !== process.env.ADMIN_SECRET_KEY) {
        return res.status(403).json({ msg: 'Invalid admin secret key. Access denied.' });
    }

    try {
        let existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username }] });
        if (existingUser) {
            return res.status(400).json({ msg: 'A user with this email or username already exists.' });
        }

        const user = new User({
            username: username.trim(),
            email: email.toLowerCase().trim(),
            password,
            role: 'Admin'
        });

        await user.save();

        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            getJwtSecret(),
            { expiresIn: '5h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: 'Admin' } });
            }
        );
    } catch (err) {
        console.error('Admin signup error:', err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/signup
// @desc    Register regular user
// @access  Public
router.post('/signup', authLimiter, async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ msg: 'Username, email, and password are required.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ msg: 'Password must be at least 6 characters long.' });
    }

    try {
        let existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.trim() }] });
        if (existingUser) {
            return res.status(400).json({ msg: 'User with this email or username already exists.' });
        }

        const user = new User({
            username: username.trim(),
            email: email.toLowerCase().trim(),
            password,
            role: 'User' // Explicitly set to User — client cannot forge Admin role
        });

        await user.save();

        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            getJwtSecret(),
            { expiresIn: '5h' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, username: user.username, email: user.email, role: 'User' } });
            }
        );
    } catch (err) {
        console.error('Signup error:', err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ msg: 'Email and password are required.' });
    }

    try {
        let user = await User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid email or password.' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid email or password.' });
        }

        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        jwt.sign(
            payload,
            getJwtSecret(),
            { expiresIn: '5h' },
            (err, token) => {
                if (err) throw err;
                res.json({
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        role: user.role,
                        isRestricted: user.isRestricted,
                        profilePicture: user.profilePicture
                    }
                });
            }
        );
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/auth/me
// @desc    Get current user from JWT token (for session restore)
// @access  Private
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            isRestricted: user.isRestricted,
            profilePicture: user.profilePicture
        });
    } catch (err) {
        console.error('Auth check error:', err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/logout
// @desc    Record lastActive timestamp on logout
// @access  Private
router.post('/logout', auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user.id, {
            lastActive: new Date()
        });
        res.json({ msg: 'Logged out successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/auth/me
// @desc    Admin self-deletion — requires password confirmation
// @access  Private (Admin only)
router.delete('/me', auth, async (req, res) => {
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ msg: 'Password confirmation is required.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ msg: 'Incorrect password. Deletion cancelled.' });
        }

        await User.findByIdAndDelete(req.user.id);
        console.log(`Admin account ${user.email} self-deleted at ${new Date().toISOString()}`);
        res.json({ msg: 'Your account has been permanently deleted.' });
    } catch (err) {
        console.error('Delete account error:', err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
