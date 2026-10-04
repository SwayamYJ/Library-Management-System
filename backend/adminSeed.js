const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartlibrary';

const seedAdmin = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        // Check if master admin exists
        const adminEmail = 'admin@test.com';
        const existingAdmin = await User.findOne({ email: adminEmail });

        if (existingAdmin) {
            console.log(`Admin account [${adminEmail}] already exists! Seeding skipped.`);
            process.exit(0);
        }

        // Create the master admin account
        const masterAdmin = new User({
            username: 'MasterAdmin',
            email: adminEmail,
            password: 'password123', // Will be hashed automatically by pre-save hook
            role: 'Admin'
        });

        await masterAdmin.save();
        console.log(`Successfully seeded master admin account!`);
        console.log(`Email: ${masterAdmin.email}`);
        console.log(`Password: password123`);

        process.exit(0);
    } catch (err) {
        console.error('Error seeding data:', err);
        process.exit(1);
    }
};

seedAdmin();
