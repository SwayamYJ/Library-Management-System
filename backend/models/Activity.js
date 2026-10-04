const mongoose = require('mongoose');

const ActivitySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    action: { type: String, enum: ['Issue', 'Renew', 'Return', 'Login'], required: true },
    status: { type: String, enum: ['Active', 'Completed'], default: 'Completed' },
    issueDate: { type: Date, default: Date.now },
    tenureDays: { type: Number, default: 14 },
    dueDate: { type: Date, default: null },
    renewCount: { type: Number, default: 0 },    // Max 2 renewals allowed
    fineAmount: { type: Number, default: 0 },    // ₹10 per overdue day
    returnedAt: { type: Date, default: null },  // Set when the user actually returns
}, { timestamps: true });

module.exports = mongoose.model('Activity', ActivitySchema);
