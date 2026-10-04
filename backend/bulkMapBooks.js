require('dotenv').config();
const mongoose = require('mongoose');
const Book = require('./models/Book');
const LibraryLayout = require('./models/LibraryLayout');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartlibrary';

async function bulkMap() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // Ensure Shelf_A, Shelf_B, Shelf_C exist with valid coordinates and dimensions
        const defaultShelves = [
            { shelfID: 'Shelf_A', label: 'Mechanics & Physics', coordinateX: 20, coordinateY: 50, width: 150, height: 200, slotCols: 4, slotRows: 5, totalSlots: 20 },
            { shelfID: 'Shelf_B', label: 'Programming & Maths', coordinateX: 50, coordinateY: 50, width: 150, height: 200, slotCols: 4, slotRows: 5, totalSlots: 20 },
            { shelfID: 'Shelf_C', label: 'DBMS & TOC', coordinateX: 80, coordinateY: 50, width: 150, height: 200, slotCols: 4, slotRows: 5, totalSlots: 20 }
        ];

        for (const def of defaultShelves) {
            const exists = await LibraryLayout.findOne({ shelfID: def.shelfID });
            if (!exists) {
                await LibraryLayout.create(def);
            } else {
                exists.coordinateX = def.coordinateX;
                exists.coordinateY = def.coordinateY;
                exists.width = def.width;
                exists.height = def.height;
                exists.slotCols = def.slotCols;
                exists.slotRows = def.slotRows;
                exists.totalSlots = def.totalSlots;
                await exists.save();
            }
        }

        const books = await Book.find({});
        let updatedCount = 0;
        const shelfSlotCounters = {
            Shelf_A: 1,
            Shelf_B: 1,
            Shelf_C: 1
        };

        for (let book of books) {
            let shelfID = null;
            const cat = book.Category ? book.Category.toLowerCase() : '';

            if (['mechanics', 'physics'].some(c => cat.includes(c))) {
                shelfID = 'Shelf_A';
            } else if (['programming', 'mathematics', 'maths', 'c programming'].some(c => cat.includes(c))) {
                shelfID = 'Shelf_B';
            } else if (['dbms', 'toc', 'computational theory'].some(c => cat.includes(c))) {
                shelfID = 'Shelf_C';
            }

            if (shelfID && shelfSlotCounters[shelfID] <= 20) {
                const assignedSlot = shelfSlotCounters[shelfID]++;
                book.Location = {
                    floor: '1',
                    section: 'Engineering',
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
            updatedCount++;
        }

        console.log(`Successfully mapped ${updatedCount} books to appropriate shelves with unique slots.`);
        await mongoose.connection.close();
        process.exit(0);

    } catch (error) {
        console.error('Bulk mapping error:', error);
        process.exit(1);
    }
}

bulkMap();
