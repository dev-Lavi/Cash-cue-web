const express = require('express');
const router = express.Router();
const axios = require('axios'); // For communicating with the ML worker
const authenticate = require('../middleware/authenticate');
const User = require('../models/User');

router.get('/expense', authenticate, async (req, res) => {
    try {
        console.log('Fetching user data...');
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                message: "User not found.",
            });
        }

        console.log('Formatting transactions...');
        const expenseTransactions = user.transactions
            .filter((t) => t.type === 'Expense' && t.date)
            .map((t) => ({
                date: new Date(t.date).toISOString().split('T')[0],
                amount: t.amount,
            }));

        if (expenseTransactions.length === 0) {
            return res.status(400).json({
                status: "FAILED",
                message: "No expense transactions found for prediction.",
            });
        }

        // Limit to 100 transactions for testing
        const MAX_TRANSACTIONS = 3;
        const payload = expenseTransactions.slice(0, MAX_TRANSACTIONS);

        console.log('Sending data to ML API...', payload);

        const response = await axios.post(
            'https://expense-forecasting-z2lq.onrender.com/forecast',
            payload,
            { timeout: 15000 } // Increase timeout
        );

        console.log('ML API response:', response.data);

        res.status(200).json({
            status: "SUCCESS",
            message: "Expense prediction fetched successfully!",
            data: response.data,
        });
    } catch (error) {
        console.error('Error:', error.message);

        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({
                status: "FAILED",
                message: "ML API request timed out.",
            });
        }

        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while predicting expenses.",
        });
    }
});


module.exports = router;
