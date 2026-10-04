require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('./models/Book');
const { lookupBook, normalizeCoverUrl } = require('./utils/bookLookup');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartlibrary';

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

async function fixCovers() {
    console.log('🚀 Starting Book Cover Migration Script (idempotent)...');
    try {
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB at', MONGO_URI);

        const allBooks = await Book.find({});
        console.log(`📚 Total books in database: ${allBooks.length}`);

        const needsFix = (url) => {
            if (!url || typeof url !== 'string' || !url.trim()) return true;
            const lower = url.toLowerCase();
            return lower.includes('via.placeholder.com') ||
                   lower.includes('unsplash.com') ||
                   lower.startsWith('http://');
        };

        const booksToFix = allBooks.filter(b => needsFix(b.thumbnail) || needsFix(b.imageUrl));
        console.log(`🔍 Books identified with missing/placeholder/http covers: ${booksToFix.length}`);

        let updatedCount = 0;
        let alreadyValidCount = allBooks.length - booksToFix.length;
        let failedCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < booksToFix.length; i++) {
            const book = booksToFix[i];
            const cleanIsbn = (book.ISBN || '').toString().trim().replace(/[\s-]/g, '');
            console.log(`\n[${i + 1}/${booksToFix.length}] Processing "${book.Title}" (ISBN: ${book.ISBN || 'N/A'})...`);

            if (!cleanIsbn && !book.Title) {
                console.warn(`  ⚠️ Skipped: No ISBN or Title available`);
                skippedCount++;
                continue;
            }

            let foundCover = '';
            try {
                const query = cleanIsbn || book.Title;
                const lookupResult = await lookupBook(query);

                if (lookupResult && lookupResult.coverImageURL) {
                    foundCover = normalizeCoverUrl(lookupResult.coverImageURL);
                }
            } catch (lookupErr) {
                console.warn(`  ⚠️ Lookup attempt failed: ${lookupErr.message}`);
            }

            // If lookup failed to return cover, try direct Open Library by ISBN
            if (!foundCover && cleanIsbn) {
                foundCover = `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(cleanIsbn)}-L.jpg?default=false`;
            }

            if (foundCover) {
                book.thumbnail = foundCover;
                book.imageUrl = foundCover;
                await book.save();
                console.log(`  ✅ Successfully updated cover to: ${foundCover}`);
                updatedCount++;
            } else {
                // Clear dead placeholder strings so they don't loop or stay broken
                book.thumbnail = '';
                book.imageUrl = '';
                await book.save();
                console.warn(`  ❌ No remote cover found. Cleared placeholder so frontend BookCover displays local styled fallback.`);
                failedCount++;
            }

            // Rate-limit delay (800ms) between external calls
            await sleep(800);
        }

        console.log('\n=============================================');
        console.log('📊 MIGRATION SUMMARY:');
        console.log(`  Total books inspected: ${allBooks.length}`);
        console.log(`  Already valid covers:  ${alreadyValidCount}`);
        console.log(`  Updated covers:        ${updatedCount}`);
        console.log(`  Cleared placeholders:  ${failedCount}`);
        console.log(`  Skipped:               ${skippedCount}`);
        console.log('=============================================\n');

        await mongoose.connection.close();
        process.exit(0);
    } catch (err) {
        console.error('Fatal migration error:', err);
        process.exit(1);
    }
}

fixCovers();
