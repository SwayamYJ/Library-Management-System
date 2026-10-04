const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   GET api/profile
// @desc    Get current user profile
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        if (!user) return res.status(404).json({ msg: 'User not found' });
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/profile
// @desc    Update profile details
// @access  Private
router.put('/', auth, async (req, res) => {
    const { username } = req.body;
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        if (username && username.trim()) {
            // Check if username is already taken by another user
            const existing = await User.findOne({ username: username.trim(), _id: { $ne: req.user.id } });
            if (existing) {
                return res.status(400).json({ msg: 'Username is already taken.' });
            }
            user.username = username.trim();
        }

        await user.save();
        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            isRestricted: user.isRestricted,
            profilePicture: user.profilePicture
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/profile/change-password
// @desc    Change password with current password verification
// @access  Private
router.put('/change-password', auth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ msg: 'Both current password and new password are required.' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ msg: 'New password must be at least 6 characters long.' });
    }

    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ msg: 'User not found' });

        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Incorrect current password.' });
        }

        user.password = newPassword;
        await user.save(); // triggers pre('save') bcrypt hashing

        res.json({ msg: 'Password updated successfully.' });
    } catch (err) {
        console.error('Password change error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/profile/upload
// @desc    Upload profile picture
// @access  Private
router.put('/upload', auth, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ msg: 'No file uploaded' });
        }

        const filePath = `/uploads/${req.file.filename}`;

        const user = await User.findByIdAndUpdate(
            req.user.id,
            { profilePicture: filePath },
            { new: true }
        ).select('-password');

        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
