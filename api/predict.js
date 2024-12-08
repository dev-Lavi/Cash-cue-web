const express = require('express');
const router = express.Router();
const axios = require('axios'); // For communicating with the ML worker
const authenticate = require('../middleware/authenticate');
const User = require('../models/User');

router.get('/expense', authenticate, async (req, res) => {
    try {
        // Fetch the user's transactions from the database
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                message: "User not found.",
            });
        }

        // Format the expense transactions
        const expenseTransactions = user.transactions
            .filter((t) => t.type === 'Expense')
            .map((t) => ({
                date: new Date(t.date).toISOString().split('T')[0], // Format date as YYYY-MM-DD
                amount: t.amount,
            }));

        if (expenseTransactions.length === 0) {
            return res.status(400).json({
                status: "FAILED",
                message: "No expense transactions found for prediction.",
            });
        }

        // Payload in the required format
        const payload = {
            expenses: expenseTransactions,
        };

        // Send expense data to the ML worker API
        const response = await axios.post('https://expense-forecasting-3.onrender.com', payload);

        // Extract the prediction from the ML worker response
        const prediction = response.data;

        res.status(200).json({
            status: "SUCCESS",
            message: "Expense prediction fetched successfully!",
            data: prediction,
        });
    } catch (error) {
        console.error('Error fetching expense prediction:', error.message);

        // Handle errors gracefully
        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while predicting expenses.",
        });
    }
});


module.exports = router;