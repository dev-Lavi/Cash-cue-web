const jwt = require('jsonwebtoken');
const User = require('../models/User');

module.exports = async (req, res, next) => {
    const token = req.headers['authorization'];

    if (!token || !token.startsWith('Bearer ')) {
        return res.status(401).json({
            status: "FAILED",
            message: "Access Denied. No token provided.",
        });
    }

    const tokenValue = token.split(' ')[1]; // Extract the token

    try {
        const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                status: "FAILED",
                message: "Invalid token.",
            });
        }

        req.user = user; // Attach user to request
        next();
    } catch (error) {
        console.error(error);
        res.status(401).json({
            status: "FAILED",
            message: "Invalid token.",
        });
    }
};