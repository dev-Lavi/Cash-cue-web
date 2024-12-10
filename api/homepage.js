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

        // Get date ranges for last 3 weeks and last 3 months
        const lastWeekStart = new Date(currentISTDate);
        const threeWeeksAgoStart = new Date(currentISTDate);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        threeWeeksAgoStart.setDate(threeWeeksAgoStart.getDate() - 21);

        const oneMonthAgoStart = new Date(currentISTDate);
        const threeMonthsAgoStart = new Date(currentISTDate);
        oneMonthAgoStart.setMonth(oneMonthAgoStart.getMonth() - 1);
        threeMonthsAgoStart.setMonth(threeMonthsAgoStart.getMonth() - 3);

        // Filter transactions based on the last 3 weeks and last 3 months
        const last3WeeksExpenses = expenseTransactions.filter(t => {
            const transactionDate = new Date(new Date(t.date).getTime() + IST_OFFSET * 60 * 1000);
            return transactionDate >= threeWeeksAgoStart && transactionDate <= currentISTDate;
        });

        const last3MonthsExpenses = expenseTransactions.filter(t => {
            const transactionDate = new Date(new Date(t.date).getTime() + IST_OFFSET * 60 * 1000);
            return transactionDate >= threeMonthsAgoStart && transactionDate <= currentISTDate;
        });

        // Calculate totals for each period
        const totalLast3WeeksExpense = last3WeeksExpenses.reduce((sum, t) => sum + t.amount, 0);
        const totalLast3MonthsExpense = last3MonthsExpenses.reduce((sum, t) => sum + t.amount, 0);

        // Calculate averages
        const averageDailyExpense = totalExpense / new Set(
            expenseTransactions.map(t => 
                new Date(new Date(t.date).getTime() + IST_OFFSET * 60 * 1000).toISOString().split('T')[0]
            )
        ).size || 0;

        const averageWeeklyExpense = totalLast3WeeksExpense / 3;
        const averageMonthlyExpense = totalLast3MonthsExpense / 3;

        // Send response
        return res.status(200).json({
            status: "SUCCESS",
            message: "Home data fetched successfully!",
            data: {
                totalIncome,
                totalExpense,
                remainingBalance,
                averageDailyExpense: averageDailyExpense.toFixed(2),
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