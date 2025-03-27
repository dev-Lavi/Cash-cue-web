const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken'); // For creating and verifying JWTs
const passport = require('passport'); // Add Passport
const Group = require('../models/group');
const nodemailer = require('nodemailer');
const otpStore = new Map(); // Store OTPs temporarily
require('dotenv').config();

const JWT_SECRET = "your_jwt_secret"; // Replace with a strong secret key
const JWT_EXPIRES_IN = "15m";
const OTP_EXPIRY_TIME = 15 * 60 * 1000; // 15 minutes
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
        const accessToken = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "15d" });
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
        const accessToken = jwt.sign({ id: decoded.id }, process.env.JWT_SECRET, { expiresIn: "15d" });

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
        const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "15d" });
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


// Step 1: Forgot Password - Send OTP
router.post("/forgot-password", async (req, res) => {
    const { email } = req.body;

    if (!email || email.trim() === "") {
        return res.json({
            status: "FAILED",
            errorCode: 4001,
            message: "Email is required!",
        });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({
                status: "FAILED",
                errorCode: 4002,
                message: "No user found with this email!",
            });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        const otpExpiry = Date.now() + OTP_EXPIRY_TIME;

        // Store OTP and expiry in DB
        user.otp = otp;
        user.otpExpiry = otpExpiry;
        user.otpVerified = false; // Ensure verification happens first
        await user.save();

        // Send OTP via email
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
            subject: "Password Reset OTP",
            html: `
                <p>You requested a password reset.</p>
                <p>Your OTP is: <strong>${otp}</strong></p>
                <p>This OTP is valid for 15 minutes.</p>
            `,
        };

        await transporter.sendMail(mailOptions);

        res.json({
            status: "SUCCESS",
            message: "OTP sent to your email. Please verify before resetting your password.",
        });
    } catch (error) {
        console.error(error);
        res.json({
            status: "FAILED",
            errorCode: 4003,
            message: "An error occurred while sending the OTP!",
        });
    }
});

// Step 2: Verify OTP
router.post("/verify-otp1", async (req, res) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
        return res.json({
            status: "FAILED",
            errorCode: 5001,
            message: "Email and OTP are required!",
        });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({
                status: "FAILED",
                errorCode: 5003,
                message: "No user found with this email!",
            });
        }

        if (user.otp !== otp || user.otpExpiry < Date.now()) {
            return res.json({
                status: "FAILED",
                errorCode: 5004,
                message: "Invalid or expired OTP!",
            });
        }

        // Mark OTP as verified
        user.otpVerified = true;
        await user.save();

        res.json({
            status: "SUCCESS",
            message: "OTP verified successfully. You can now reset your password.",
        });
    } catch (error) {
        console.error(error);
        res.json({
            status: "FAILED",
            errorCode: 5005,
            message: "An error occurred during OTP verification!",
        });
    }
});

// Step 3: Reset Password (Only if OTP is verified)
router.post("/reset-password", async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.json({
            status: "FAILED",
            errorCode: 6001,
            message: "Email and new password are required!",
        });
    }

    const passwordRegex = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        return res.json({
            status: "FAILED",
            errorCode: 6002,
            message: "Password must be at least 8 characters long and include at least one number and one symbol!",
        });
    }

    try {
        const user = await User.findOne({ email });

        if (!user) {
            return res.json({
                status: "FAILED",
                errorCode: 6003,
                message: "No user found with this email!",
            });
        }

        if (!user.otpVerified) {
            return res.json({
                status: "FAILED",
                errorCode: 6004,
                message: "OTP verification is required before resetting the password!",
            });
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password and clear OTP data
        user.password = hashedPassword;
        user.otp = null;
        user.otpExpiry = null;
        user.otpVerified = false; // Reset flag
        await user.save();

        res.json({
            status: "SUCCESS",
            message: "Password reset successful!",
        });
    } catch (error) {
        console.error(error);
        res.json({
            status: "FAILED",
            errorCode: 6005,
            message: "An error occurred while resetting the password!",
        });
    }
});

// Resend OTP for Signup
router.post('/resend-otp-signup', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.json({ status: "FAILED", errorCode: 6001, message: "Email is required!" });
    }

    const storedData = otpStore.get(email);
    if (!storedData) {
        return res.json({ status: "FAILED", errorCode: 6002, message: "No OTP request found for this email!" });
    }

    // Generate a new OTP
    const newOtp = Math.floor(100000 + Math.random() * 900000); // 6-digit OTP
    otpStore.set(email, { ...storedData, otp: newOtp, createdAt: Date.now() });

    // Send OTP via email
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
        subject: "Resend OTP for Signup",
        html: `<p>Your new OTP for signup is: <b>${newOtp}</b></p><p>This OTP will expire in 5 minutes.</p>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.json({ status: "SUCCESS", message: "New OTP sent to your email." });
    } catch (error) {
        console.error(error);
        res.json({ status: "FAILED", errorCode: 6003, message: "Error sending OTP!" });
    }
});

// Resend OTP for Forgot Password
router.post('/resend-otp-forgot-password', async (req, res) => {
    const { email } = req.body;

    if (!email) {
        return res.json({ status: "FAILED", errorCode: 7001, message: "Email is required!" });
    }

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.json({ status: "FAILED", errorCode: 7002, message: "No user found with this email!" });
        }

        // Generate a new OTP
        const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = Date.now() + OTP_EXPIRY_TIME;

        user.otp = newOtp;
        user.otpExpiry = otpExpiry;
        await user.save();

        // Send OTP via email
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
            subject: "Resend OTP for Password Reset",
            html: `<p>Your new OTP for password reset is: <b>${newOtp}</b></p><p>This OTP will expire in 15 minutes.</p>`,
        };

        await transporter.sendMail(mailOptions);
        res.json({ status: "SUCCESS", message: "New OTP sent to your email." });
    } catch (error) {
        console.error(error);
        res.json({ status: "FAILED", errorCode: 7003, message: "Error sending OTP!" });
    }
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
