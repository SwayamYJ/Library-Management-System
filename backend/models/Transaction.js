const mongoose = require('mongoose');

const TimelineStepSchema = new mongoose.Schema({
    status: { type: String, enum: ['Processing', 'Ordered', 'Packed', 'Shipped', 'Delivered'], required: true },
    timestamp: { type: Date, default: Date.now },
    location: { type: String, default: 'Warehouse' }
}, { _id: false });

const TransactionSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    bookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    currentStatus: { type: String, enum: ['Processing', 'Ordered', 'Packed', 'Shipped', 'Delivered'], default: 'Ordered' },
    issueDate: { type: Date, default: Date.now },
    tenureDays: { type: Number },
    dueDate: { type: Date },
    fine: { type: Number, default: 0 },
    timeline: [TimelineStepSchema]
}, { timestamps: true });

// Pre-save to auto-add 'Ordered' to timeline when a new transaction is created
TransactionSchema.pre('save', function () {
    if (this.isNew && this.timeline.length === 0) {
        this.timeline.push({
            status: 'Ordered',
            timestamp: Date.now(),
            location: 'SmartLibrary System'
        });
    }
});

module.exports = mongoose.model('Transaction', TransactionSchema);
