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

        // Get start of day, week, and month in IST
        const startOfDayIST = new Date(currentISTDate.getFullYear(), currentISTDate.getMonth(), currentISTDate.getDate());
        const startOfWeekIST = new Date(startOfDayIST);
        startOfWeekIST.setDate(startOfWeekIST.getDate() - startOfDayIST.getDay());
        const startOfMonthIST = new Date(currentISTDate.getFullYear(), currentISTDate.getMonth(), 1);

        // Filter transactions based on IST time
        const dailyExpenses = expenseTransactions.filter(t => {
            const transactionDate = new Date(new Date(t.date).getTime() + IST_OFFSET * 60 * 1000);
            return transactionDate >= startOfDayIST;
        });
        const weeklyExpenses = expenseTransactions.filter(t => {
            const transactionDate = new Date(new Date(t.date).getTime() + IST_OFFSET * 60 * 1000);
            return transactionDate >= startOfWeekIST;
        });
        const monthlyExpenses = expenseTransactions.filter(t => {
            const transactionDate = new Date(new Date(t.date).getTime() + IST_OFFSET * 60 * 1000);
            return transactionDate >= startOfMonthIST;
        });

        // Calculate totals for each period
        const dailyExpenseTotal = dailyExpenses.reduce((sum, t) => sum + t.amount, 0);
        const weeklyExpenseTotal = weeklyExpenses.reduce((sum, t) => sum + t.amount, 0);
        const monthlyExpenseTotal = monthlyExpenses.reduce((sum, t) => sum + t.amount, 0);

        const averageDailyExpense = dailyExpenseTotal;
        const averageWeeklyExpense = weeklyExpenseTotal / 7;
        const averageMonthlyExpense = monthlyExpenseTotal / new Date(currentISTDate.getFullYear(), currentISTDate.getMonth() + 1, 0).getDate();

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