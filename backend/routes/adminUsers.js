const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Activity = require('../models/Activity');
const BorrowingHistory = require('../models/BorrowingHistory');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// Helper to compute live fine consistent with userActions and cron
const FINE_PER_DAY = 10;
function calculateLiveFine(dueDate) {
    if (!dueDate) return 0;
    const now = new Date();
    const due = new Date(dueDate);
    if (now <= due) return 0;
    const diffTime = now - due;
    const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return daysOverdue * FINE_PER_DAY;
}

// @route   GET api/admin/users
// @desc    Get all users (with optional search)
// @access  Private/Admin
router.get('/users', [auth, admin], async (req, res) => {
    try {
        const { search } = req.query;
        let query = {};

        if (search) {
            query = {
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const users = await User.find(query).select('-password').lean();

        for (let user of users) {
            let totalPenalty = 0;
            const activeActivities = await Activity.find({ userId: user._id, status: 'Active' });

            for (let act of activeActivities) {
                totalPenalty += calculateLiveFine(act.dueDate);
            }

            const history = await BorrowingHistory.find({ userId: user._id, finePaid: false });
            for (let h of history) {
                const fineVal = h.fine ?? h.fineAmount ?? 0;
                if (fineVal > 0) totalPenalty += fineVal;
            }

            user.totalPenalty = totalPenalty;
        }

        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/admin/users/:id/restrict
// @desc    Toggle user restriction status
// @access  Private/Admin
router.put('/users/:id/restrict', [auth, admin], async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        user.isRestricted = !user.isRestricted;
        await user.save();

        res.json(user);
    } catch (err) {
        console.error(err.message);
        if (err.name === 'CastError') {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.status(500).send('Server Error');
    }
});

// @route   POST api/admin/users/:id/pay-fines
// @desc    Mark all unpaid fines for a user as paid
// @access  Private/Admin
router.post('/users/:id/pay-fines', [auth, admin], async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Update all unpaid BorrowingHistory records
        const result = await BorrowingHistory.updateMany(
            { userId, finePaid: false },
            { $set: { finePaid: true } }
        );

        // Also reset fineAmount on any active activities (or record them paid)
        await Activity.updateMany(
            { userId, status: 'Active' },
            { $set: { fineAmount: 0 } }
        );

        res.json({
            msg: `Fines cleared successfully for ${user.username}`,
            modifiedRecords: result.modifiedCount,
            fineAmount: 0
        });
    } catch (err) {
        console.error('Error clearing fines:', err.message);
        if (err.name === 'CastError') {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.status(500).send('Server Error');
    }
});

// @route   DELETE api/admin/users/:id
// @desc    Delete a user safely
// @access  Private/Admin
router.delete('/users/:id', [auth, admin], async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        // Prevent admin from deleting themselves via this route
        if (req.user.id === req.params.id) {
            return res.status(400).json({ msg: 'Cannot delete your own account from this view. Use settings.' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.json({ msg: 'User removed' });
    } catch (err) {
        console.error(err.message);
        if (err.name === 'CastError') {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.status(500).send('Server Error');
    }
});

// @route   GET api/admin/users/:id/report
// @desc    Get God View user detailed report
// @access  Private/Admin
router.get('/users/:id/report', [auth, admin], async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await User.findById(userId).select('-password');
        if (!user) return res.status(404).json({ msg: 'User not found' });

        // Total books purchased (Transactions)
        const transactions = await Transaction.find({ userId });
        const booksPurchased = transactions.length;

        // Currently held books
        const activeIssues = await Activity.find({ userId, status: 'Active' })
            .populate('bookId', ['Title', 'Author', 'imageUrl', 'thumbnail', 'ISBN']);

        let totalActivePenalty = 0;
        const heldBooks = activeIssues.map(act => {
            const dueDate = act.dueDate ? new Date(act.dueDate) : null;
            let daysRemaining = 0;
            let fine = calculateLiveFine(act.dueDate);

            if (dueDate) {
                const now = new Date();
                const diffTime = dueDate - now;
                daysRemaining = Math.ceil(diffTime / 86400000);
            }
            totalActivePenalty += fine;
            return {
                _id: act._id,
                book: act.bookId,
                issueDate: act.issueDate || act.createdAt,
                dueDate: act.dueDate,
                tenureDays: act.tenureDays || 14,
                daysRemaining,
                fine
            };
        });

        const historyRecords = await BorrowingHistory.find({ userId })
            .populate('bookId', ['Title', 'Author', 'imageUrl', 'thumbnail', 'ISBN'])
            .sort({ returnedAt: -1 });

        const booksReturned = historyRecords.length;
        const booksIssued = activeIssues.length + booksReturned;

        // Total accumulated penalty (active + unpaid history)
        const unpaidHistoryRecords = historyRecords.filter(r => !r.finePaid && ((r.fine || r.fineAmount || 0) > 0));
        const historyPenalty = unpaidHistoryRecords.reduce((sum, r) => sum + (r.fine ?? r.fineAmount ?? 0), 0);

        const totalPenalty = totalActivePenalty + historyPenalty;

        res.json({
            user,
            booksPurchased,
            booksIssued,
            heldBooks,
            historyRecords,
            unpaidHistoryRecords,
            totalActivePenalty,
            historyPenalty,
            totalPenalty
        });
    } catch (err) {
        console.error(err.message);
        if (err.name === 'CastError') {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.status(500).send('Server Error');
    }
});

module.exports = router;
