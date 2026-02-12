const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
    let token;

    // 1. Check for 'x-auth-token' (Mobile Preferred)
    if (req.headers['x-auth-token']) {
        token = req.headers['x-auth-token'];
    }
    // 2. Fallback to 'Authorization: Bearer' (Web Preferred)
    else if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
        } catch (err) {
            console.error("Token extraction error:", err);
        }
    }

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token' });
    }

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_dev_key_123'); // Fallback for dev

        // Add user info to request (id only)
        req.user = decoded;

        next();
    } catch (error) {
        console.error(error);
        res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

module.exports = { protect };
