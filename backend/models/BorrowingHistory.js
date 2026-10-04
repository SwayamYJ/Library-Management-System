const mongoose = require('mongoose');

// BorrowingHistory stores a permanent record of every completed book return.
// The original Activity record moves here when status becomes 'Completed' via Return.
const BorrowingHistorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: false }, // optional: book may have been deleted
    issueDate: { type: Date, default: Date.now },
    tenureDays: { type: Number },
    dueDate: { type: Date },
    returnedAt: { type: Date, default: Date.now },
    renewCount: { type: Number, default: 0 },
    fine: { type: Number, default: 0 },
    finePaid: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('BorrowingHistory', BorrowingHistorySchema);
