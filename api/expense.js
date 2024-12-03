const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const upload = require('../config/multer');


// Add an expense
router.post('/add', authenticate, upload.single('attachment'), async (req, res) => {
    const { amount, description, category, date } = req.body;
    const attachment = req.file ? `/uploads/${req.file.filename}` : null;

    // Validate input
    if (!amount || !description || !category || !date) {
        return res.status(400).json({
            status: "FAILED",
            message: "All fields (amount, description, category, date) are required.",
        });
    }

    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                message: "User not found.",
            });
        }

        user.expenses.push({
            amount,
            description,
            category,
            date: new Date(date),
            attachment,
        });

        await user.save();

        res.status(201).json({
            status: "SUCCESS",
            message: "Expense added successfully!",
            expense: user.expenses[user.expenses.length - 1],
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while adding the expense.",
        });
    }
});

// Get all expenses for the authenticated user
router.get('/list', authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                message: "User not found.",
            });
        }

        res.json({
            status: "SUCCESS",
            expenses: user.expenses,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while fetching expenses.",
        });
    }
});

// Delete an expense
router.delete('/delete/:expenseId', authenticate, async (req, res) => {
    const { expenseId } = req.params;

    try {
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                message: "User not found.",
            });
        }

        // Filter out the expense to delete
        user.expenses = user.expenses.filter(expense => expense._id.toString() !== expenseId);

        await user.save();

        res.json({
            status: "SUCCESS",
            message: "Expense deleted successfully.",
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while deleting the expense.",
        });
    }
});

module.exports = router;