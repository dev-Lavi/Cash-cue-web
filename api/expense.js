const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');

// Add an expense
router.post('/add', authenticate, async (req, res) => {
    const { amount, description, date } = req.body;

    // Validate input
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
        return res.status(400).json({
            status: "FAILED",
            message: "Amount must be a positive number.",
        });
    }
     
    if (!description || !date) {
        return res.status(400).json({
            status: "FAILED",
            message: "All fields (amount, description, date) are required.",
        });
    }
    
    if (isNaN(Date.parse(date))) {
        return res.status(400).json({
            status: "FAILED",
            message: "Invalid date format.",
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

        const newExpense = {
            amount,
            description,
            date: new Date(date),
        };

        user.expenses.push(newExpense);
        await user.save();

       res.status(201).json({
            status: "SUCCESS",
            message: "Expense added successfully!",
            expense: newExpense,
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

// Edit an expense
router.put('/edit/:expenseId', authenticate, async (req, res) => {
    const { expenseId } = req.params;
    const { amount, description, date } = req.body;

    // Validate input
    if (amount && (isNaN(amount) || Number(amount) <= 0)) {
        return res.status(400).json({
            status: "FAILED",
            message: "Amount must be a positive number.",
        });
    }

    if (date && isNaN(Date.parse(date))) {
        return res.status(400).json({
            status: "FAILED",
            message: "Invalid date format.",
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

        // Find the expense to edit
        const expense = user.expenses.id(expenseId);
        if (!expense) {
            return res.status(404).json({
                status: "FAILED",
                message: "Expense not found.",
            });
        }

        // Update fields if provided
        if (amount) expense.amount = amount;
        if (description) expense.description = description;
        if (date) expense.date = new Date(date);

        await user.save();

        res.json({
            status: "SUCCESS",
            message: "Expense updated successfully!",
            expense,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while editing the expense.",
        });
    }
});

// Delete an expense
router.delete('/delete/:expenseId', authenticate, async (req, res) => {
    const { expenseId } = req.params;

    try {
        const user = await User.findByIdAndUpdate(
            req.user.id,
            { $pull: { expenses: { _id: expenseId } } },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                message: "User not found.",
            });
        }

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