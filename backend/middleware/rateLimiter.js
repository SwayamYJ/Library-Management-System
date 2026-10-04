// In-memory IP rate limiter without heavy external dependencies
const rateLimitMap = new Map();

// Periodic cleanup of stale rate-limit keys every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
        if (now > value.resetTime) {
            rateLimitMap.delete(key);
        }
    }
}, 5 * 60 * 1000).unref();

const createRateLimiter = ({
    windowMs = 60 * 1000,
    max = 20,
    message = 'Too many attempts. Please try again after a minute.'
} = {}) => {
    return (req, res, next) => {
        const ip = req.headers['x-forwarded-for'] || req.ip || req.socket?.remoteAddress || 'unknown';
        const now = Date.now();
        const clientData = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

        if (now > clientData.resetTime) {
            clientData.count = 1;
            clientData.resetTime = now + windowMs;
        } else {
            clientData.count += 1;
        }

        rateLimitMap.set(ip, clientData);

        if (clientData.count > max) {
            return res.status(429).json({ msg: message });
        }

        next();
    };
};

module.exports = { createRateLimiter };
