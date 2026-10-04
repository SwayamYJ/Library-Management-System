// Middleware to restrict access to Admin-only routes
// Must be chained AFTER the 'auth' middleware which sets req.user from JWT

const adminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'Admin') {
        return res.status(403).json({ msg: 'Access denied. Admins only.' });
    }
    next();
};

module.exports = adminOnly;
