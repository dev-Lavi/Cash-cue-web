const jwt = require('jsonwebtoken');
const User = require('../models/User');
const JWT_SECRET = "your_jwt_secret"; 
require('dotenv').config();

module.exports = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];

        // Check if the Authorization header is provided
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                status: "FAILED",
                message: "Access Denied. No token provided or invalid format.",
            });
        }

        const token = authHeader.split(' ')[1]; // Extract the token
        console.log("Received Token:", token);
        console.log("JWT_SECRET in authenticate middleware:", JWT_SECRET);

        // Verify the JWT
        const decoded = jwt.verify(token, JWT_SECRET);
        console.log("Decoded Token:", decoded);

        // Find the user associated with the token
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({
                status: "FAILED",
                message: "Access Denied. User does not exist.",
            });
        }

        // Attach user data to the request for use in subsequent middleware/routes
        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            console.error("JWT Error:", error.message);
            return res.status(401).json({
                status: "FAILED",
                message: "Invalid token. Access Denied.",
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                status: "FAILED",
                message: "Token has expired. Please log in again.",
            });
        }

        console.error("Authentication Error:", error.message);
        res.status(401).json({
            status: "FAILED",
            message: "Invalid token. Access Denied.",
        });
    }
};
