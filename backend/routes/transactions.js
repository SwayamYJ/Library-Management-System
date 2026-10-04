const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

// @route   POST api/transactions/order
// @desc    Place a new book order
// @access  Private
router.post('/order', auth, async (req, res) => {
    const { bookId } = req.body;

    if (!bookId) {
        return res.status(400).json({ msg: 'bookId is required to place an order.' });
    }

    if (!req.user?.id) {
        return res.status(401).json({ msg: 'User not authenticated. Please log in again.' });
    }

    try {
        // Atomic decrement to avoid race conditions
        const book = await Book.findOneAndUpdate(
            { _id: bookId, availableCount: { $gt: 0 } },
            { $inc: { availableCount: -1 } },
            { new: true }
        );

        if (!book) {
            return res.status(400).json({ msg: 'No copies available for order.' });
        }

        if (book.availableCount === 0) {
            book.isAvailable = false;
            book.status = 'Out of Stock';
            await book.save();
        }

        const transaction = new Transaction({
            userId: req.user.id,
            bookId: book._id,
            currentStatus: 'Ordered'
        });

        await transaction.save();
        console.log(`✅ Order created: user=${req.user.id} book=${book.Title} txn=${transaction._id}`);

        res.json({ msg: 'Order placed successfully', transaction, book });
    } catch (err) {
        console.error('FULL DATABASE ERROR:', err);
        return res.status(500).json({ msg: 'Server error placing order' });
    }
});

// @route   GET api/transactions/my-orders
// @desc    Get current user's order transactions
// @access  Private
router.get('/my-orders', auth, async (req, res) => {
    try {
        const transactions = await Transaction.find({ userId: req.user.id })
            .populate('bookId', ['Title', 'Author', 'imageUrl', 'thumbnail', 'ISBN'])
            .sort({ createdAt: -1 });
        res.json(transactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/transactions
// @desc    Get all orders (Admin only)
// @access  Private Admin
router.get('/', [auth, admin], async (req, res) => {
    try {
        const transactions = await Transaction.find()
            .populate('userId', ['username', 'email'])
            .populate('bookId', ['Title', 'ISBN', 'Author', 'imageUrl', 'thumbnail'])
            .sort({ createdAt: -1 });
        res.json(transactions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT api/transactions/:id/status
// @desc    Update order status and append to timeline (Admin only)
// @access  Private Admin
router.put('/:id/status', [auth, admin], async (req, res) => {
    const { status, location } = req.body;

    // Validate status
    const validStatuses = ['Ordered', 'Packed', 'Shipped', 'Delivered'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ msg: 'Invalid status update' });
    }

    try {
        let transaction = await Transaction.findById(req.params.id);
        if (!transaction) return res.status(404).json({ msg: 'Transaction not found' });

        // Don't add duplicate immediate status updates
        if (transaction.currentStatus === status) {
            return res.status(400).json({ msg: 'Order is already in this status' });
        }

        transaction.currentStatus = status;

        // Append to timeline
        transaction.timeline.push({
            status: status,
            timestamp: Date.now(),
            location: location || 'Transit Hub'
        });

        await transaction.save();

        res.json({ msg: 'Status updated successfully', transaction });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
