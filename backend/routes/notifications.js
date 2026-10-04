const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Notification = require('../models/Notification');

// @route    GET api/notifications
// @desc     Get unread notifications for the logged-in user
// @access   Private
router.get('/', auth, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id, isRead: false })
            .sort({ createdAt: -1 });
        res.json(notifications);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// Helper for mark-read
const handleMarkRead = async (req, res) => {
    try {
        let notification = await Notification.findById(req.params.id);

        if (!notification) return res.status(404).json({ msg: 'Notification not found' });

        if (notification.userId.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        notification.isRead = true;
        await notification.save();

        res.json(notification);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// Support both GET (existing frontend) and PUT (standard REST)
router.get('/mark-read/:id', auth, handleMarkRead);
router.put('/:id/read', auth, handleMarkRead);
router.put('/mark-read/:id', auth, handleMarkRead);

// @route    PUT api/notifications/read-all
// @desc     Mark all notifications for the user as read
// @access   Private
router.put('/read-all', auth, async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.user.id, isRead: false }, { $set: { isRead: true } });
        res.json({ msg: 'All notifications marked as read' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
