const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // For creating and verifying JWTs
const passport = require('passport'); // Add Passport
const nodemailer = require('nodemailer');
const otpStore = new Map(); // Store OTPs temporarily
const Group = require('../models/group');
require('dotenv').config();

const JWT_SECRET = "your_jwt_secret"; // Replace with a strong secret key
const JWT_EXPIRES_IN = "15m";
const User = require('./../models/User');

// password handler
const bcrypt = require('bcryptjs');


// OAuth Routes for Google (or other providers)
router.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email'],
}));

router.get('/auth/google/callback', passport.authenticate('google', {
    failureRedirect: '/login',
    session: true,
}), (req, res) => {
    // If successful, create a JWT token for the user
    const token = jwt.sign({ id: req.user._id, email: req.user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({
        status: "SUCCESS",
        message: "Authenticated via Google",
        token,
    });
});

// Facebook OAuth Route 
router.get('/auth/facebook', passport.authenticate('facebook'));

router.get('/auth/facebook/callback', passport.authenticate('facebook', {
    failureRedirect: '/login',
    session: true,
}), (req, res) => {
    // Create JWT token after successful authentication
    const token = jwt.sign({ id: req.user._id, email: req.user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({
        status: "SUCCESS",
        message: "Authenticated via Facebook",
        token,
    });
});

// Twitter OAuth
router.get('/auth/twitter', passport.authenticate('twitter'));

router.get('/auth/twitter/callback', passport.authenticate('twitter', { 
    failureRedirect: '/login',
        session: true, 
    }), (req, res) => {
        const token = jwt.sign({ id: req.user._id, email: req.user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        res.json({
            status: 'SUCCESS',
            message: 'Twitter authentication successful!',
            token,
        });
    });

//signup
router.post('/signup', async (req, res) => {
    let { name, email, password } = req.body;
    name = name.trim();
    email = email.trim();
    password = password.trim();

    if (!name || !email || !password) {
        return res.json({ status: "FAILED", errorCode: 1001, message: "Empty input fields!" });
    }

    if (!/^[a-zA-Z]+(\s[a-zA-Z]+)*$/.test(name)) {
        return res.json({ status: "FAILED", errorCode: 1002, message: "Invalid name entered" });
    }

    if (!/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        return res.json({ status: "FAILED", errorCode: 1003, message: "Invalid email entered" });
    }

    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(password)) {
        return res.json({
            status: "FAILED",
            errorCode: 1004,
            message: "Password must be at least 8 characters long and include at least one number and one symbol.",
        });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.json({
                status: "FAILED",
                errorCode: 1005,
                message: "User with the provided email already exists",
            });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP

        // Store OTP with email temporarily
        otpStore.set(email, { otp, name, password, createdAt: Date.now() });

        // Send OTP via Gmail
        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: process.env.EMAIL, 
                pass: process.env.EMAIL_PASSWORD, 
            },
        });

        const mailOptions = {
            from: process.env.EMAIL,
            to: email,
            subject: "Your OTP for Signup",
            html: `<p>Hi ${name},</p><p>Your OTP for signup is: <b>${otp}</b></p><p>This OTP will expire in 5 minutes.</p>`,
        };

        await transporter.sendMail(mailOptions);

        return res.json({
            status: "SUCCESS",
            message: "OTP sent to your email. Please verify to complete signup.",
        });
    } catch (error) {
        console.error(error);
        return res.json({
            status: "FAILED",
            errorCode: 1006,
            message: "An error occurred during signup. Please try again.",
        });
    }
});

router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.json({ status: "FAILED", errorCode: 2001, message: "Missing email or OTP!" });
    }

    const storedData = otpStore.get(email);
    if (!storedData) {
        return res.json({ status: "FAILED", errorCode: 2002, message: "OTP expired or not found!" });
    }

    if (storedData.otp !== parseInt(otp)) {
        return res.json({ status: "FAILED", errorCode: 2003, message: "Invalid OTP!" });
    }

    if (Date.now() - storedData.createdAt > 300000) { // 5-minute expiry
        otpStore.delete(email);
        return res.json({ status: "FAILED", errorCode: 2004, message: "OTP expired!" });
    }

    try {
        // Hash the password and create the user
        const hashedPassword = await bcrypt.hash(storedData.password, 10);
        const newUser = new User({ name: storedData.name, email, password: hashedPassword, isVerified: true });
        await newUser.save();

        // Clear OTP
        otpStore.delete(email);

        // Generate Tokens
        const accessToken = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ id: newUser._id }, process.env.REFRESH_SECRET, { expiresIn: "7d" });

        return res.json({
            status: "SUCCESS",
            message: "Signup successful!",
            accessToken,
            refreshToken,
        });
    } catch (error) {
        console.error(error);
        return res.json({
            status: "FAILED",
            errorCode: 2005,
            message: "An error occurred during OTP verification.",
        });
    }
});

router.post('/refresh-token', (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
        return res.status(401).json({ status: "FAILED", message: "Refresh token not provided!" });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
        const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: "15m" });

        return res.json({
            status: "SUCCESS",
            accessToken,
        });
    } catch (error) {
        console.error(error);
        return res.status(403).json({ status: "FAILED", message: "Invalid or expired refresh token!" });
    }
});


router.post('/signin', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.json({ status: "FAILED", errorCode: 3001, message: "Empty credentials supplied!" });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ status: "FAILED", errorCode: 3002, message: "Invalid credentials!" });
        }

        if (!user.isVerified) {
            return res.json({
                status: "FAILED",
                errorCode: 3003,
                message: "Email not verified. Please verify your email.",
            });
        }

        const isPasswordMatch = await bcrypt.compare(password, user.password);
        if (!isPasswordMatch) {
            return res.json({ status: "FAILED", errorCode: 3004, message: "Invalid password!" });
        }

        // Generate Tokens
        const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "15m" });
        const refreshToken = jwt.sign({ id: user._id }, process.env.REFRESH_SECRET, { expiresIn: "7d" });

        return res.json({
            status: "SUCCESS",
            message: "Sign-in successful!",
            accessToken,
            refreshToken,
        });
    } catch (error) {
        console.error(error);
        return res.json({
            status: "FAILED",
            errorCode: 3005,
            message: "An error occurred during sign-in.",
        });
    }
});

// Forgot Password: Send Reset Token
router.post('/forgot-password', (req, res) => {
    const { email } = req.body;

    if (!email || email.trim() === "") {
        return res.json({
            status: "FAILED",
            errorCode: 4001,
            message: "Email is required!"
        });
    }

    User.findOne({ email }).then(user => {
        if (!user) {
            return res.json({
                status: "FAILED",
                errorCode: 4002,
                message: "No user found with this email!"
            });
        }

                // Generate a JWT token
                const resetToken = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

                // Send reset email
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: {
                        user: process.env.EMAIL, //my email
                        pass: process.env.EMAIL_PASSWORD // my email password in an environment variable
                    }
                });
        
                const mailOptions = {
                    from: process.env.EMAIL,
                    to: email,
                    subject: "Password Reset",
                    html: `
                        <p>You requested a password reset</p>
                        <p>Click the link below to reset your password:</p>
                        <a href="${process.env.FRONTEND_URL}/reset-password/${resetToken}">Reset Password</a>
                        <p>This link will expire in 15 minutes.</p>
                    `
                };

                transporter.sendMail(mailOptions, (err, info) => {
                    if (err) {
                        return res.json({
                            status: "FAILED",
                            errorCode: 4003,
                            message: "Failed to send email!",
                            error: err
                        });
                    }
        
                    res.json({
                        status: "SUCCESS",
                        message: "Password reset email sent!"
                    });
                });
            }).catch(err => {
                res.json({
                    status: "FAILED",
                    errorCode: 4004,
                    message: "An error occurred while finding user!",
                    error: err
                });
            });
        });

// Reset Password: Update the Password
router.post('/reset-password/:token', (req, res) => {
    const { token } = req.params;
    const { newPassword } = req.body;

    // Password validation: At least 8 characters, 1 number, and 1 symbol
    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;
    if (!newPassword || !passwordRegex.test(newPassword)) {
        return res.json({
            status: "FAILED",
            errorCode: 5001,
            message: "Password must be at least 8 characters long and include at least one number and one symbol!"
        });
    }
        
// Verify the JWT token
jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
        return res.json({
            status: "FAILED",
            errorCode: 5002,
            message: "Invalid or expired reset token!"
        });
    }

    // Token is valid, find the user and update the password
    User.findById(decoded.id).then(user => {
        if (!user) {
            return res.json({
                status: "FAILED",
                errorCode: 5003,
                message: "User not found!"
            });
        }

        // Hash the new password
        bcrypt.hash(newPassword, 10).then(hashedPassword => {
            user.password = hashedPassword;

            user.save().then(() => {
                res.json({
                    status: "SUCCESS",
                    message: "Password reset successful!"
                });
            }).catch(err => {
                res.json({
                    status: "FAILED",
                    errorCode: 5004,
                    message: "An error occurred while updating the password!",
                    error: err
                });
            });
        }).catch(err => {
            res.json({
                status: "FAILED",
                errorCode: 5005,
                message: "An error occurred while hashing the password!",
                error: err
            });
        });
    }).catch(err => {
        res.json({
            status: "FAILED",
            errorCode: 5006,
            message: "An error occurred while finding the user!",
            error: err
        });
    });
});
});

// Logout route
router.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.json({
                status: 'FAILED',
                message: 'Error during logout!',
            });
        }
        res.json({
            status: 'SUCCESS',
            message: 'Logged out successfully!',
        });
    });
});

module.exports = router;
