const mongoose = require('mongoose');

const LocationSchema = new mongoose.Schema({
  floor: { type: String },
  section: { type: String },
  shelfNumber: { type: String },
  slotIndex: { type: Number }
});

const BookSchema = new mongoose.Schema({
  Title: { type: String, required: true },
  Author: { type: String, required: true },
  ISBN: { type: String, required: true, unique: true },
  Category: { type: String, required: false },
  price: { type: Number, default: 600, required: false },
  publisher: { type: String, required: false },
  description: { type: String, required: false },
  thumbnail: { type: String, default: '' },
  imageUrl: { type: String, default: '' },
  pageCount: { type: Number },
  rawApiData: { type: Object },
  availableCount: { type: Number, default: 1 },
  quantity: { type: Number, default: 1 },
  isAvailable: { type: Boolean, default: true },
  status: { type: String, default: 'Available' },
  Location: { type: LocationSchema, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Book', BookSchema);
