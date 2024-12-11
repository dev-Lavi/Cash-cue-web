const express = require('express');
const router = express.Router();
const Group = require('../models/group');
const User = require('../models/User');
const authenticate = require('../middleware/authenticate');

// Create a new group 
router.post('/create', authenticate, async (req, res) => {
    try {
        const { title, description, members } = req.body;

        // Validate input
        if (!title || !description || !members || !Array.isArray(members)) {
            return res.status(400).json({
                status: "FAILED",
                message: "Title, description, and members are required, and members must be an array of email addresses.",
            });
        }

        // Fetch user details for each email in the members array
        const userRecords = await User.find({ email: { $in: members } });

        // Check for missing users
        const foundEmails = userRecords.map(user => user.email);
        const missingEmails = members.filter(email => !foundEmails.includes(email));
        if (missingEmails.length > 0) {
            return res.status(404).json({
                status: "FAILED",
                message: `The following emails were not found: ${missingEmails.join(', ')}`,
            });
        }

        // Prepare members with email and name
        const memberData = userRecords.map(user => ({
            email: user.email,
            name: user.name,  // Assuming User model contains a 'name' field
        }));

        // Create the group
        const newGroup = new Group({
            title,
            description,
            members: memberData,
        });

        await newGroup.save();

        res.status(201).json({
            status: "SUCCESS",
            message: "Group created successfully!",
            group: newGroup,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while creating the group.",
        });
    }
});


// Add an expense to a group
router.post('/add-expense', authenticate, async (req, res) => {
    try {
        const { groupId, amount, date, description } = req.body;
        const initiatorEmail = req.user.email; // Assuming 'req.user' contains the authenticated user's data

        // Validate input
        if (!groupId || !amount || !date || !description) {
            return res.status(400).json({
                status: "FAILED",
                message: "Group ID, amount, date, and description are required.",
            });
        }

        // Fetch the group
        const group = await Group.findById(groupId);
        if (!group) {
            return res.status(404).json({
                status: "FAILED",
                message: "Group not found.",
            });
        }

        // Check if the initiator email exists in the group members
        const initiator = group.members.find(member => member.email === initiatorEmail);
        if (!initiator) {
            return res.status(404).json({
                status: "FAILED",
                message: "Initiator email not found in the group members.",
            });
        }

        // Create the new expense transaction
        const newTransaction = {
            description,
            amount,
            date,
            initiatedBy: initiatorEmail, // Use the authenticated user's email
            splitDetails: [],
        };

        // Calculate the split for each member except the initiator
        const nonInitiatorMembers = group.members.filter(member => member.email !== initiatorEmail);
        const equalShare = amount / nonInitiatorMembers.length;

        // Prepare split details for each member
        newTransaction.splitDetails = nonInitiatorMembers.map(member => ({
            memberEmail: member.email,
            share: equalShare,
            paid: false, // Initially, no one has paid
        }));

        // Save the transaction in the group
        group.transactions.push(newTransaction);
        await group.save();

        res.status(201).json({
            status: "SUCCESS",
            message: "Expense added successfully!",
            transaction: newTransaction,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while adding the expense.",
        });
    }
});


 

// Get group data
router.get('/group/:groupId', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;

        // Fetch the group data from the database
        const group = await Group.findById(groupId).populate('transactions.splitDetails.memberEmail', 'email name'); // Populating member details

        if (!group) {
            return res.status(404).json({
                status: "FAILED",
                message: "Group not found.",
            });
        }

        // Return the group data
        res.status(200).json({
            status: "SUCCESS",
            message: "Group data fetched successfully!",
            group: {
                title: group.title,
                description: group.description,
                members: group.members, // Includes email and name
                transactions: group.transactions.map(transaction => ({
                    description: transaction.description,
                    amount: transaction.amount,
                    date: transaction.date,
                    initiatedBy: transaction.initiatedBy,
                    splitDetails: transaction.splitDetails,
                })),
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while fetching the group data.",
        });
    }
});


module.exports = router;
