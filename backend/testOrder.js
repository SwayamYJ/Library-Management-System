const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const http = require('http');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/smartlibrary').then(async () => {
    const User = require('./models/User');
    const Book = require('./models/Book');

    const user = await User.findOne({ role: 'User' });
    const book = await Book.findOne({ availableCount: { $gt: 0 } });

    if (!user) { console.log('❌ No User found in DB'); process.exit(1); }
    if (!book) { console.log('❌ No book with availableCount > 0 found'); process.exit(1); }

    console.log('✅ Test user:', user.email, '| role:', user.role);
    console.log('✅ Test book:', book.Title, '| availableCount:', book.availableCount, '| _id:', book._id);

    const token = jwt.sign(
        { user: { id: user._id.toString(), role: user.role } },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '1h' }
    );
    console.log('✅ Token generated');

    const payload = JSON.stringify({ bookId: book._id.toString() });
    const options = {
        host: 'localhost', port: 5000, path: '/api/transactions/order', method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token,
            'Content-Length': Buffer.byteLength(payload)
        }
    };

    console.log('\n🚀 Sending order request...');
    const req = http.request(options, (res) => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => {
            console.log('\n═══ RESULT ═══');
            console.log('STATUS:', res.statusCode);
            try {
                const parsed = JSON.parse(body);
                console.log('BODY:', JSON.stringify(parsed, null, 2));
            } catch {
                console.log('BODY (raw):', body);
            }
            process.exit(0);
        });
    });
    req.on('error', e => {
        console.error('\n❌ REQUEST FAILED (server may be down):', e.message);
        process.exit(1);
    });
    req.write(payload);
    req.end();
}).catch(e => { console.error('DB connect error:', e.message); process.exit(1); });
