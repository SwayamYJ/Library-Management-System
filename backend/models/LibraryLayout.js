const mongoose = require('mongoose');

const LibraryLayoutSchema = new mongoose.Schema({
    shelfID: { type: String, required: true, unique: true },
    label: { type: String, required: true },
    coordinateX: { type: Number, required: true },  // Stored as percentage (%) for OSMA responsiveness
    coordinateY: { type: Number, required: true },  // Stored as percentage (%)
    width: { type: Number, required: true, default: 150 },   // Fixed uniform width in px (rendered on 1200px canvas)
    height: { type: Number, required: true, default: 200 },  // Fixed uniform height in px (rendered on 800px canvas)
    slotCols: { type: Number, default: 4 },   // Internal grid columns
    slotRows: { type: Number, default: 5 },   // Internal grid rows
    totalSlots: { type: Number, default: 20 } // slotCols × slotRows
}, { timestamps: true });

module.exports = mongoose.model('LibraryLayout', LibraryLayoutSchema);
