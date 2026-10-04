const express = require('express');
const router = express.Router();
const BorrowingHistory = require('../models/BorrowingHistory');
const auth = require('../middleware/auth');

// @route   GET api/borrow/my-history
// @desc    Get user's borrowing history
// @access  Private
router.get('/my-history', auth, async (req, res) => {
    try {
        const history = await BorrowingHistory.find({ userId: req.user.id })
            .populate('bookId', ['Title', 'Author', 'imageUrl', 'thumbnail', 'ISBN', 'status'])
            .sort({ issueDate: -1, createdAt: -1 });
        res.json(history);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
