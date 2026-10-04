require('dotenv').config();
const mongoose = require('mongoose');
const LibraryLayout = require('./models/LibraryLayout');
const Book = require('./models/Book');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartlibrary';

const layoutData = [
    { shelfID: 'Shelf_A', label: 'Mechanics & Physics', coordinateX: 20, coordinateY: 50, width: 150, height: 200, slotCols: 4, slotRows: 5, totalSlots: 20 },
    { shelfID: 'Shelf_B', label: 'Programming & Maths', coordinateX: 50, coordinateY: 50, width: 150, height: 200, slotCols: 4, slotRows: 5, totalSlots: 20 },
    { shelfID: 'Shelf_C', label: 'DBMS & TOC', coordinateX: 80, coordinateY: 50, width: 150, height: 200, slotCols: 4, slotRows: 5, totalSlots: 20 },
];

async function resetLayout() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Clear existing layouts
        console.log('Clearing existing layout collection...');
        await LibraryLayout.deleteMany({});

        // 2. Insert original professional shelves
        console.log('Seeding 3 Professional Shelves (Shelf_A, Shelf_B, Shelf_C)...');
        await LibraryLayout.insertMany(layoutData);
        console.log('Successfully seeded layout zones.');

        // 3. Re-link Books based on Category with UNIQUE slots
        console.log('Re-linking engineering books to standard shelves with unique slots...');
        const books = await Book.find({});
        let updateCount = 0;
        const slotCounters = {
            Shelf_A: 1,
            Shelf_B: 1,
            Shelf_C: 1
        };

        for (let book of books) {
            let shelfID = null;
            const cat = book.Category?.toLowerCase() || '';

            if (cat.includes('mechanics') || cat.includes('physics')) {
                shelfID = 'Shelf_A';
            } else if (cat.includes('programming') || cat.includes('maths') || cat.includes('mathematics') || cat.includes('algorithm')) {
                shelfID = 'Shelf_B';
            } else if (cat.includes('dbms') || cat.includes('toc') || cat.includes('database') || cat.includes('computational')) {
                shelfID = 'Shelf_C';
            }

            if (shelfID && slotCounters[shelfID] <= 20) {
                const assignedSlot = slotCounters[shelfID]++;
                book.Location = {
                    floor: '1',
                    section: 'Technical',
                    shelfNumber: shelfID,
                    slotIndex: assignedSlot
                };
            } else {
                book.Location = {
                    floor: '1',
                    section: 'Main',
                    shelfNumber: null,
                    slotIndex: null
                };
            }
            await book.save();
            updateCount++;
        }

        console.log(`✅ Reset complete! ${updateCount} books re-mapped.`);
        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('Error resetting layout:', error);
        process.exit(1);
    }
}

resetLayout();
