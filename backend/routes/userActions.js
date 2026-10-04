const express = require('express');
const router = express.Router();
const Book = require('../models/Book');
const Activity = require('../models/Activity');
const BorrowingHistory = require('../models/BorrowingHistory');
const auth = require('../middleware/auth');

const MAX_RENEWALS = 2;         // Maximum times a book can be renewed
const FINE_PER_DAY = 10;        // ₹10 per overdue day (mock fine)
const LOAN_PERIOD_DAYS = 14;    // Default loan period

// Helper: calculate overdue fine in rupees
function calculateFine(dueDate) {
    const now = new Date();
    if (!dueDate || now <= new Date(dueDate)) return 0;
    const daysOverdue = Math.ceil((now - new Date(dueDate)) / (1000 * 60 * 60 * 24));
    return daysOverdue * FINE_PER_DAY;
}

// @route   POST api/actions/issue
// @desc    Issue a book to the logged-in user (14-day loan)
// @access  Private
router.post('/issue', auth, async (req, res) => {
    const { bookId, tenureDays } = req.body;
    console.log(`Borrowing attempt by user: ${req.user.id} for ${tenureDays || LOAN_PERIOD_DAYS} days`);
    try {
        // Check total unpaid penalty first
        const activeIssuesUser = await Activity.find({ userId: req.user.id, status: 'Active' });
        const activeFines = activeIssuesUser.reduce((sum, act) => sum + calculateFine(act.dueDate), 0);

        const historyRecords = await BorrowingHistory.find({ userId: req.user.id, finePaid: false });
        const historyFines = historyRecords.reduce((sum, rec) => sum + (rec.fine ?? rec.fineAmount ?? 0), 0);

        const totalUnpaidPenalty = activeFines + historyFines;

        if (totalUnpaidPenalty > 50) {
            return res.status(403).json({ msg: `Borrowing blocked. You have an unpaid penalty of ₹${totalUnpaidPenalty}. Please clear your dues first.` });
        }

        // Check if user already has an active issue for this book
        const existingIssue = await Activity.findOne({
            userId: req.user.id,
            bookId,
            status: 'Active'
        });

        if (existingIssue) {
            return res.status(400).json({ msg: 'You already have this book issued and it is currently active.' });
        }

        // Atomic decrement to prevent race conditions
        const book = await Book.findOneAndUpdate(
            { _id: bookId, availableCount: { $gt: 0 } },
            { $inc: { availableCount: -1 } },
            { new: true }
        );

        if (!book) {
            return res.status(400).json({ msg: 'No copies available for issue' });
        }

        if (book.availableCount === 0) {
            book.isAvailable = false;
            book.status = 'Borrowed';
            await book.save();
        }

        const requestedDays = req.body.duration ? Number(req.body.duration) : (tenureDays ? Number(tenureDays) : LOAN_PERIOD_DAYS);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + requestedDays);

        const activity = new Activity({
            userId: req.user.id,
            bookId: book._id,
            action: 'Issue',
            status: 'Active',
            issueDate: new Date(),
            tenureDays: requestedDays,
            dueDate,
            renewCount: 0,
            fineAmount: 0
        });
        await activity.save();

        res.json({ msg: `Book issued for ${requestedDays} days. Due: ${dueDate.toDateString()}`, activity, book });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/actions/issued
// @desc    Get all currently issued (Active) books for the logged-in user
// @access  Private
router.get('/issued', auth, async (req, res) => {
    try {
        const issued = await Activity.find({ userId: req.user.id, status: 'Active' })
            .populate('bookId', ['Title', 'Author', 'ISBN', 'imageUrl', 'thumbnail', 'Category'])
            .sort({ createdAt: -1 });

        // Attach live fine calculation to each record (don't save, just for display)
        const withFines = issued.map(act => {
            const fine = calculateFine(act.dueDate);
            return { ...act.toObject(), liveFineCal: fine };
        });

        res.json(withFines);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/actions/renew
// @desc    Renew a currently issued book (max 2 times)
// @access  Private
router.post('/renew', auth, async (req, res) => {
    const { activityId } = req.body;

    try {
        const issue = await Activity.findOne({ _id: activityId, userId: req.user.id, status: 'Active' });

        if (!issue) {
            return res.status(404).json({ msg: 'Active issue record not found.' });
        }

        if (issue.renewCount >= MAX_RENEWALS) {
            return res.status(400).json({
                msg: `Renewal limit reached. This book can only be renewed ${MAX_RENEWALS} time(s).`
            });
        }

        // Extend due date by 7 days from current due date
        const newDueDate = new Date(issue.dueDate);
        newDueDate.setDate(newDueDate.getDate() + 7);

        issue.dueDate = newDueDate;
        issue.action = 'Renew';
        issue.renewCount += 1;
        issue.fineAmount = 0; // Reset fine on renewal
        await issue.save();

        const renewsLeft = MAX_RENEWALS - issue.renewCount;
        res.json({
            msg: `Book renewed! New due date: ${newDueDate.toDateString()}. ${renewsLeft} renewal(s) remaining.`,
            activity: issue,
            renewsLeft
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/actions/return
// @desc    Return an issued book — calculates fine, archives to BorrowingHistory, marks book Available
// @access  Private
router.post('/return', auth, async (req, res) => {
    const { activityId } = req.body;

    if (!activityId) {
        return res.status(400).json({ msg: 'activityId is required.' });
    }

    try {
        const issueRaw = await Activity.findOne({ _id: activityId, userId: req.user.id, status: 'Active' });

        if (!issueRaw) {
            return res.status(404).json({ msg: 'Active issue record not found. It may have already been returned.' });
        }

        const rawBookId = issueRaw.bookId;

        // ── Fine calculation ────────
        let fine = 0;
        try {
            fine = calculateFine(issueRaw.dueDate);
        } catch (fineErr) {
            console.warn('Fine calculation failed (ignored):', fineErr.message);
        }

        // ── Book availability restore ─────────────────────────────────
        let bookTitle = 'Unknown Book';
        try {
            if (rawBookId) {
                const book = await Book.findById(rawBookId);
                if (book) {
                    book.availableCount = Math.max(0, (book.availableCount || 0) + 1);
                    if (book.availableCount > 0) {
                        book.status = 'Available';
                        book.isAvailable = true;
                    }
                    await book.save();
                    bookTitle = book.Title;
                    console.log(`📚 Book restocked: ${book.Title} → availableCount: ${book.availableCount}`);
                } else {
                    console.warn(`⚠️ Book ${rawBookId} not found in DB — may have been deleted.`);
                }
            }
        } catch (bookErr) {
            console.error('Book restock failed (non-blocking):', bookErr.message);
        }

        // ── Archive to BorrowingHistory (single permanent record) ─────
        try {
            if (rawBookId) {
                const historyRecord = new BorrowingHistory({
                    userId: issueRaw.userId,
                    bookId: rawBookId,
                    issueDate: issueRaw.issueDate || issueRaw.createdAt,
                    tenureDays: issueRaw.tenureDays || 14,
                    dueDate: issueRaw.dueDate,
                    returnedAt: new Date(),
                    renewCount: issueRaw.renewCount || 0,
                    fine: fine,
                    finePaid: fine === 0
                });
                await historyRecord.save();
                console.log(`📋 BorrowingHistory archived: ${historyRecord._id}`);
            }
        } catch (histErr) {
            console.error('BorrowingHistory save failed (non-blocking):', histErr.message);
        }

        // ── Mark Activity as Completed ────────────────────────────────
        issueRaw.status = 'Completed';
        issueRaw.action = 'Return';
        issueRaw.returnedAt = new Date();
        issueRaw.fineAmount = fine;
        await issueRaw.save();
        console.log(`✅ Activity ${activityId} marked Completed. Fine: ₹${fine}`);

        const msg = fine > 0
            ? `"${bookTitle}" returned. Overdue fine: ₹${fine}. Please pay at the library counter.`
            : `"${bookTitle}" returned successfully! No fines.`;

        res.json({ msg, fine, activity: issueRaw });

    } catch (err) {
        console.error('❌ Return failed:', err);
        if (err.errors) {
            const details = Object.values(err.errors).map(e => e.message).join(', ');
            return res.status(400).json({ msg: `Validation error: ${details}` });
        }
        res.status(500).json({ msg: 'Server error during return. Please try again.' });
    }
});

// @route   GET api/actions/history
// @desc    Get the current user's full borrowing history (completed + active)
// @access  Private
router.get('/history', auth, async (req, res) => {
    try {
        const activities = await Activity.find({ userId: req.user.id })
            .populate('bookId', ['Title', 'Author', 'ISBN', 'imageUrl', 'thumbnail'])
            .sort({ createdAt: -1 });
        res.json(activities);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET api/actions/borrowing-history
// @desc    Get archived borrowing history for the user
// @access  Private
router.get('/borrowing-history', auth, async (req, res) => {
    try {
        const records = await BorrowingHistory.find({ userId: req.user.id })
            .populate('bookId', ['Title', 'Author', 'ISBN', 'imageUrl', 'thumbnail'])
            .sort({ returnedAt: -1, createdAt: -1 });
        res.json(records);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/actions/login
// @desc    Log a user login action
// @access  Private
router.post('/login', auth, async (req, res) => {
    try {
        await Activity.create({
            userId: req.user.id,
            action: 'Login',
            status: 'Completed',
            bookId: req.body.bookId || undefined
        });
        res.json({ msg: 'Login recorded' });
    } catch (err) {
        res.json({ msg: 'Login noted' });
    }
});

// @route   GET api/actions/my-penalty
// @desc    Get total unpaid penalty for the logged-in user
// @access  Private
router.get('/my-penalty', auth, async (req, res) => {
    try {
        const activeIssues = await Activity.find({ userId: req.user.id, status: 'Active' });
        const activeFines = activeIssues.reduce((sum, act) => sum + calculateFine(act.dueDate), 0);

        const historyRecords = await BorrowingHistory.find({ userId: req.user.id, finePaid: false });
        const historyFines = historyRecords.reduce((sum, rec) => sum + (rec.fine ?? rec.fineAmount ?? 0), 0);

        const totalPenalty = activeFines + historyFines;
        res.json({ totalPenalty, activeFines, historyFines });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
