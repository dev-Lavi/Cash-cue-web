const express = require('express');
const router = express.Router();
const User = require('../models/User'); // Import your User model
const authenticate = require('../middleware/authenticate'); // Ensure middleware path is correct


// API to set or edit initial account balance
router.put('/balance', authenticate, async (req, res) => {
    try {
        // Extract the new balance and user ID
        const { accountBalance } = req.body;
        const userId = req.user.id;

        // Validate the input
        if (accountBalance == null || typeof accountBalance !== 'number') {
            return res.status(400).json({
                status: "FAILED",
                message: "Invalid account balance. It must be a number.",
            });
        }

        // Find and update the user's account balance
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                message: "User not found.",
            });
        }

        // Update the account balance
        user.accountBalance = accountBalance;
        await user.save();

        // Respond with the updated data
        return res.status(200).json({
            status: "SUCCESS",
            message: "Account balance updated successfully!",
            data: {
                accountBalance: user.accountBalance,
            },
        });
    } catch (error) {
        console.error("Error updating account balance:", error);
        return res.status(500).json({
            status: "FAILED",
            message: "An error occurred while updating account balance.",
        });
    }
});

module.exports = router;
