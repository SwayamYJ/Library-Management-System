const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartlibrary';

mongoose.connect(MONGO_URI).then(async () => {
    const Book = require('./models/Book');

    // Restock all books that have 0 copies back to 3
    const result = await Book.updateMany(
        { availableCount: { $lte: 0 } },
        { $set: { availableCount: 3, status: 'Available' } }
    );
    console.log('Books restocked (were at 0 copies):', result.modifiedCount);

    // Confirm counts
    const total = await Book.countDocuments();
    const available = await Book.countDocuments({ availableCount: { $gt: 0 } });
    console.log(`Total books: ${total} | With available copies: ${available}`);

    process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
