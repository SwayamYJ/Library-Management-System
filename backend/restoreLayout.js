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

async function restore() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // 1. Clear existing layouts
        console.log('Clearing existing layout configuration...');
        await LibraryLayout.deleteMany({});

        // 2. Insert original shelves (Shelf_A, Shelf_B, Shelf_C)
        console.log('Restoring 3 Professional Shelves (Shelf_A, Shelf_B, Shelf_C)...');
        await LibraryLayout.insertMany(layoutData);
        console.log('Successfully restored layout zones.');

        // 3. Re-link Engineering Books with unique slots
        console.log('Re-linking engineering books to their respective shelves...');
        const books = await Book.find({});
        const slotCounters = {
            Shelf_A: 1,
            Shelf_B: 1,
            Shelf_C: 1
        };
        
        let linkedCount = 0;
        for (let book of books) {
            const cat = (book.Category || '').toLowerCase();
            let shelfID = null;

            if (cat.includes('mechanics') || cat.includes('physics')) {
                shelfID = 'Shelf_A';
            } else if (cat.includes('programming') || cat.includes('mathematics') || cat.includes('maths') || cat.includes('algorithm')) {
                shelfID = 'Shelf_B';
            } else if (cat.includes('dbms') || cat.includes('toc') || cat.includes('database') || cat.includes('computational')) {
                shelfID = 'Shelf_C';
            }
            
            if (shelfID && slotCounters[shelfID] <= 20) {
                book.Location = {
                    floor: '1',
                    section: 'Technical',
                    shelfNumber: shelfID,
                    slotIndex: slotCounters[shelfID]++
                };
                linkedCount++;
            } else {
                book.Location = {
                    floor: '1',
                    section: 'Main',
                    shelfNumber: null,
                    slotIndex: null
                };
            }
            await book.save();
        }
        
        console.log(`✅ Re-linked ${linkedCount} books with unique slots.`);
        
        await mongoose.connection.close();
        console.log('Layout Restoration Complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error restoring layout:', error);
        process.exit(1);
    }
}

restore();
