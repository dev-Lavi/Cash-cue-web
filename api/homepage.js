const express = require('express');
const router = express.Router();
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');
const moment = require('moment'); // For date manipulation

router.get('/home', authenticate, async (req, res) => {
    try {
        // Fetch the user from the database
        const user = await User.findById(req.user.id);

        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                message: "User not found.",
            });
        }

        // Initial account balance stored in the database
        const initialBalance = user.accountBalance || 0;

        // Transactions from the user
        const transactions = user.transactions || [];

        // Filter income and expense transactions
        const incomeTransactions = transactions.filter(t => t.type === 'Income');
        const expenseTransactions = transactions.filter(t => t.type === 'Expense');

        // Calculate total income and total expense
        const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
        const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

        // Calculate remaining balance
        const remainingBalance = initialBalance + totalIncome - totalExpense;

        // Indian Timezone Offset (IST = UTC + 5:30)
        const IST_OFFSET = 330; // 5 hours 30 minutes in minutes

        // Current date in IST
        const currentISTDate = new Date(new Date().getTime() + IST_OFFSET * 60 * 1000);

        // Date ranges for the last 7 days and last 28 days
        const last7DaysStart = new Date(currentISTDate);
        last7DaysStart.setDate(last7DaysStart.getDate() - 7);

        const last28DaysStart = new Date(currentISTDate);
        last28DaysStart.setDate(last28DaysStart.getDate() - 28);

        // Filter transactions based on the last 7 and 28 days
        const last7DaysExpenses = expenseTransactions.filter(t => {
            const transactionDate = new Date(new Date(t.date).getTime() + IST_OFFSET * 60 * 1000);
            return transactionDate >= last7DaysStart;
        });

        const last28DaysExpenses = expenseTransactions.filter(t => {
            const transactionDate = new Date(new Date(t.date).getTime() + IST_OFFSET * 60 * 1000);
            return transactionDate >= last28DaysStart;
        });

        // Calculate totals for each period
        const last7DaysTotal = last7DaysExpenses.reduce((sum, t) => sum + t.amount, 0);
        const last28DaysTotal = last28DaysExpenses.reduce((sum, t) => sum + t.amount, 0);

        // Calculate averages
        const averageWeeklyExpense = last7DaysTotal / 7;
        const averageMonthlyExpense = last28DaysTotal / 28;

        // Send response
        return res.status(200).json({
            status: "SUCCESS",
            message: "Home data fetched successfully!",
            data: {
                totalIncome,
                totalExpense,
                remainingBalance,
                averageWeeklyExpense: averageWeeklyExpense.toFixed(2),
                averageMonthlyExpense: averageMonthlyExpense.toFixed(2),
            },
        });
    } catch (error) {
        console.error("Error fetching home data:", error);
        return res.status(500).json({
            status: "FAILED",
            message: "An error occurred while fetching home data.",
        });
    }
});



module.exports = router; 