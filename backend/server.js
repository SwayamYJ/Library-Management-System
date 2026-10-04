const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

// Enforce JWT_SECRET requirement before booting
if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL ERROR: JWT_SECRET environment variable is missing.');
    console.error('Please define JWT_SECRET in backend/.env before starting the server.');
    process.exit(1);
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 Created uploads directory at:', uploadsDir);
}

const app = express();

// Middleware
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or same-origin)
        if (!origin) return callback(null, true);
        if (origin === allowedOrigin || origin.startsWith('http://localhost:')) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json());

// Serve static files from the uploads directory
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admin', require('./routes/adminUsers'));
app.use('/api/books', require('./routes/books'));
app.use('/api/layout', require('./routes/layout'));
app.use('/api/actions', require('./routes/userActions'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/borrow', require('./routes/borrow'));
app.use('/api/notifications', require('./routes/notifications'));

const { initCronJobs } = require('./utils/cronJobs');
initCronJobs();

app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'SmartLibrary API is running' });
});

// Database Connection
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/smartlibrary';

mongoose.connect(MONGO_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    });
