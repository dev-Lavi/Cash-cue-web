const mongoose = require('mongoose'); 
const Schema = mongoose.Schema;

// Define the Transaction Schema
const TransactionSchema = new Schema({
    type: { type: String, enum: ["Expense", "Income"], // Allow only "Expense" or "Income" 
        required: true },
    amount: { type: Number, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

const UserSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, unique: true, sparse: true }, // Email can be optional for OAuth users
    password: { 
        type: String, 
        required: function() { return !this.oauthProvider; } // Password required unless OAuth provider is used
    },
    isVerified: { type: Boolean, default: false }, // Field for email verification
    oauthProvider: { type: String, enum: ['google', 'facebook', 'twitter'], default: null }, // Tracks OAuth provider
    oauthId: { type: String, unique: true, sparse: true }, // OAuth provider's unique ID
    accountBalance: { type: Number, default: 0 }, // Store user's account balance

    // Transactions array 
    transactions: [TransactionSchema],

    // OTP-related fields
    otp: { type: String, required: false }, // OTP is not always required
    otpExpiry: { type: Date, required: false }, // Store OTP expiry time
    otpVerified: { type: Boolean, default: false }, // ✅ Add this field to track OTP verification
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

module.exports = User;

