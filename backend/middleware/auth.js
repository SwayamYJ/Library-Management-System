const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
    let token = req.header('Authorization') || req.header('x-auth-token');

    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    if (token.startsWith('Bearer ')) {
        token = token.slice(7).trim();
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error('FATAL: JWT_SECRET environment variable is missing.');
        return res.status(500).json({ msg: 'Server configuration error' });
    }

    try {
        const decoded = jwt.verify(token, secret);
        req.user = decoded.user; // { id, role }
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid or expired' });
    }
};

module.exports = auth;
