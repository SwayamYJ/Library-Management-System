const mongoose = require('mongoose');
const dotenv = require('dotenv');
const axios = require('axios');
const Book = require('./models/Book');
const LibraryLayout = require('./models/LibraryLayout');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartlibrary';

const genres = ['scifi', 'mystery', 'fantasy', 'history'];
const booksPerGenre = 5;

// Layout shelves — shelfID MUST match the shelfNumber values used in books below
const LAYOUT_SHELVES = [
    { shelfID: 'Shelf-S', label: 'Sci-Fi Section', coordinateX: 40, coordinateY: 50, width: 140, height: 45 },
    { shelfID: 'Shelf-M', label: 'Mystery Section', coordinateX: 240, coordinateY: 50, width: 140, height: 45 },
    { shelfID: 'Shelf-F', label: 'Fantasy Section', coordinateX: 40, coordinateY: 160, width: 140, height: 45 },
    { shelfID: 'Shelf-H', label: 'History Section', coordinateX: 240, coordinateY: 160, width: 140, height: 45 },
];

// Map genre initial letter to shelfID
const genreToShelfID = {
    'scifi': 'Shelf-S',
    'mystery': 'Shelf-M',
    'fantasy': 'Shelf-F',
    'history': 'Shelf-H',
};

const seedDatabase = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // ── Clear and re-seed Layout ──────────────────────────────────
        await LibraryLayout.deleteMany({});
        console.log('Cleared existing layout collection.');
        await LibraryLayout.insertMany(LAYOUT_SHELVES);
        console.log(`✅ Seeded ${LAYOUT_SHELVES.length} layout shelves:`, LAYOUT_SHELVES.map(s => s.shelfID).join(', '));

        // ── Clear and re-seed Books ──────────────────────────────────
        await Book.deleteMany({});
        console.log('Cleared existing books collection.');

        let seedBooks = [];

        for (let genre of genres) {
            console.log(`Fetching books for genre: ${genre}...`);

            const res = await axios.get(`https://openlibrary.org/subjects/${genre}.json`, {
                params: { limit: booksPerGenre }
            });

            const works = res.data.works || [];
            const cleanGenre = genre.charAt(0).toUpperCase() + genre.slice(1);
            const shelfID = genreToShelfID[genre];

            for (let i = 0; i < works.length; i++) {
                const work = works[i];

                const title = work.title || 'Unknown Title';
                const author = work.authors && work.authors.length > 0 ? work.authors[0].name : 'Unknown Author';

                let imageUrl = '';
                if (work.cover_id) {
                    imageUrl = `https://covers.openlibrary.org/b/id/${work.cover_id}-L.jpg`;
                } else {
                    imageUrl = `https://source.unsplash.com/featured/?book,${genre}`;
                }

                const mockIsbn = `OL-${work.key ? work.key.split('/')[2] : `${genre}-${i}`}`;

                seedBooks.push({
                    Title: title,
                    Author: author,
                    ISBN: mockIsbn,
                    Category: cleanGenre,
                    description: `A highly anticipated ${cleanGenre.toLowerCase()} title by ${author}.`,
                    imageUrl,
                    availableCount: Math.floor(Math.random() * 5) + 1,
                    Location: {
                        floor: '1',
                        section: cleanGenre,
                        shelfNumber: shelfID,   // matches the layout shelf's shelfID exactly
                        slotIndex: i + 1      // 1–5 within the shelf
                    }
                });
            }
        }

        let saved = 0;
        for (let b of seedBooks) {
            try {
                await new Book(b).save();
                saved++;
            } catch (err) {
                console.error(`⚠️  Error saving "${b.Title}":`, err.message);
            }
        }

        console.log(`\n✅ Seeded ${saved} books across ${genres.length} genres.`);
        console.log('📍 Map spots will appear for all books whose shelfNumber matches a Layout shelf.');
        process.exit(0);
    } catch (err) {
        console.error('Seeding error:', err.message);
        process.exit(1);
    }
};

seedDatabase();
