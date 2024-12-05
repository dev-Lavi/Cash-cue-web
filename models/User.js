const mongoose = require('mongoose'); 
const Schema = mongoose.Schema;

// Define the Transaction Schema
const TransactionSchema = new Schema({
    type: { 
        type: String, 
        enum: ["Expense", "Income"], // Allow only "Expense" or "Income"
        required: true 
    },
    amount: { 
        type: Number, 
        required: true 
    },
    description: { 
        type: String, 
        required: true 
    },
    date: { 
        type: Date, 
        required: true 
    },
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

// Define the User Schema
const UserSchema = new Schema({
    name: { type: String, required: true },
    email: { 
        type: String, 
        unique: true, 
        sparse: true // Email can be optional for OAuth users
    },
    password: { 
        type: String, 
        required: function() { 
            return !this.oauthProvider; 
        } // Password is required unless OAuth provider is used
    },
    isVerified: { 
        type: Boolean, 
        default: false 
    }, // Field for email verification
    oauthProvider: { 
        type: String, 
        enum: ['google', 'facebook', 'twitter'], 
        default: null 
    }, // Tracks which OAuth provider the user used
    oauthId: { 
        type: String, 
        unique: true, 
        sparse: true 
    }, // OAuth provider's unique ID for the user

    // Transactions array replaces expenses
    transactions: [TransactionSchema],
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

const User = mongoose.model('User', UserSchema);

module.exports = User;
