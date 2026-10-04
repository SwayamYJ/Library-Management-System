require('dotenv').config();
const mongoose = require('mongoose');
const LibraryLayout = require('./models/LibraryLayout');

const MONGODB_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartlibrary';

const layoutData = [
    { shelfID: 'Shelf_A', label: 'Mechanics & Physics', coordinateX: 20, coordinateY: 50, width: 150, height: 200, slotCols: 4, slotRows: 5, totalSlots: 20 },
    { shelfID: 'Shelf_B', label: 'Programming & Maths', coordinateX: 50, coordinateY: 50, width: 150, height: 200, slotCols: 4, slotRows: 5, totalSlots: 20 },
    { shelfID: 'Shelf_C', label: 'DBMS & TOC', coordinateX: 80, coordinateY: 50, width: 150, height: 200, slotCols: 4, slotRows: 5, totalSlots: 20 },
];

async function seed() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        console.log('Clearing existing layout configuration...');
        await LibraryLayout.deleteMany({});

        console.log('Inserting 3 Layout Zones (Shelf_A, Shelf_B, Shelf_C)...');
        await LibraryLayout.insertMany(layoutData);
        console.log('Successfully inserted layout zones.');

        await mongoose.connection.close();
        console.log('Layout Seed Complete!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding data:', error);
        process.exit(1);
    }
}

seed();
