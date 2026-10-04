const cron = require('node-cron');
const Transaction = require('../models/Transaction');
const Activity = require('../models/Activity');
const Notification = require('../models/Notification');
const Book = require('../models/Book');

const FINE_PER_DAY = 10;

const runDueAndOverdueChecks = async () => {
    console.log('⏰ Running daily return & overdue check job...');
    try {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const fortyEightHoursLater = new Date(now.getTime() + (48 * 60 * 60 * 1000));

        // 1. Check Active Borrow Activities
        const activeActivities = await Activity.find({ status: 'Active', dueDate: { $ne: null } })
            .populate('bookId');

        for (const act of activeActivities) {
            const book = act.bookId;
            if (!book) continue;

            const dueDate = new Date(act.dueDate);

            // ── Case A: Overdue ──────────────────────────────────────────
            if (now > dueDate) {
                const diffTime = now - dueDate;
                const daysOverdue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const fine = daysOverdue * FINE_PER_DAY;

                // Sync fine to activity
                act.fineAmount = fine;
                await act.save();

                // Prevent multiple overdue alerts for same book on same day
                const existingOverdue = await Notification.findOne({
                    userId: act.userId,
                    message: { $regex: new RegExp(`"${book.Title}".*overdue`, 'i') },
                    createdAt: { $gte: startOfToday }
                });

                if (!existingOverdue) {
                    await Notification.create({
                        userId: act.userId,
                        message: `Overdue Alert: "${book.Title}" is ${daysOverdue} day(s) overdue. Penalty accrued: ₹${fine}. Please return immediately.`
                    });
                    console.log(`Created overdue notification for user ${act.userId} - "${book.Title}"`);
                }
            }
            // ── Case B: Due in next 48 hours ─────────────────────────────
            else if (dueDate <= fortyEightHoursLater) {
                const diffTime = dueDate - now;
                const hoursRemaining = Math.max(1, Math.round(diffTime / (1000 * 60 * 60)));

                // Prevent multiple due-soon reminders for same book within 24 hours
                const existingReminder = await Notification.findOne({
                    userId: act.userId,
                    message: { $regex: new RegExp(`"${book.Title}".*due in`, 'i') },
                    createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) }
                });

                if (!existingReminder) {
                    await Notification.create({
                        userId: act.userId,
                        message: `Reminder: "${book.Title}" is due in approximately ${hoursRemaining} hours. Please return or renew on time.`
                    });
                    console.log(`Created 48-hour reminder for user ${act.userId} - "${book.Title}"`);
                }
            }
        }

        // 2. Check Transactions with dueDate (Orders)
        const transactions = await Transaction.find({ dueDate: { $ne: null } }).populate('bookId');
        for (const txn of transactions) {
            const book = txn.bookId;
            if (!book || !txn.dueDate) continue;

            const dueDate = new Date(txn.dueDate);
            if (dueDate <= fortyEightHoursLater && dueDate > now) {
                const existing = await Notification.findOne({
                    userId: txn.userId,
                    message: { $regex: new RegExp(`"${book.Title}".*due`, 'i') },
                    createdAt: { $gte: startOfToday }
                });

                if (!existing) {
                    await Notification.create({
                        userId: txn.userId,
                        message: `Reminder: Order for "${book.Title}" is due soon.`
                    });
                }
            }
        }

        console.log('✅ Daily notification checks completed.');
    } catch (err) {
        console.error('Error in cron checks:', err);
    }
};

const initCronJobs = () => {
    // Run daily at 08:00 AM IST (02:30 UTC)
    cron.schedule('30 2 * * *', runDueAndOverdueChecks, {
        scheduled: true,
        timezone: 'Asia/Kolkata'
    });
};

module.exports = { initCronJobs, runDueAndOverdueChecks };
