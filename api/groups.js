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
        if (!title || !members || !Array.isArray(members)) {
            return res.status(400).json({
                status: "FAILED",
                message: "Title and members are required, and members must be an array of email addresses.",
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

        // Prepare members with user IDs
        const memberData = userRecords.map(user => ({
            userId: user._id,
            email: user.email,
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


// Add a transaction to a group
router.post('/group/:groupId/transaction', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;
        const { description, amount, splitType } = req.body;

        // Validate input
        if (!description || !amount || !splitType) {
            return res.status(400).json({
                status: "FAILED",
                message: "Description, amount, and splitType are required.",
            });
        }

        // Find the group by ID and populate members
        const group = await Group.findById(groupId).populate('members', 'name');
        if (!group) {
            return res.status(404).json({
                status: "FAILED",
                message: "Group not found.",
            });
        }

        // Validate split type
        if (!['equally', 'unequally', 'percentage'].includes(splitType)) {
            return res.status(400).json({
                status: "FAILED",
                message: "Invalid splitType. Allowed values are 'equally', 'unequally', 'percentage'.",
            });
        }

        // Fetch the user's name from the database (initiator of the transaction)
        const user = await User.findById(req.user._id); // Assuming User is your user model
        if (!user) {
            return res.status(404).json({
                status: "FAILED",
                message: "User not found.",
            });
        }

        // Exclude the user who initiated the expense from the equal split
        const nonInitiatorMembers = group.members.filter(member => member._id.toString() !== req.user._id.toString());
        
        // If there are no members left to split the amount, return an error
        if (nonInitiatorMembers.length === 0) {
            return res.status(400).json({
                status: "FAILED",
                message: "There must be at least one other member to split the expense.",
            });
        }

        // Calculate the equal share for each non-initiating member
        const equalShare = amount / nonInitiatorMembers.length;

        // Prepare the split details
        const updatedSplitDetails = nonInitiatorMembers.map(member => ({
            member: member.name,
            share: equalShare,
        }));

        // Create the transaction object
        const transaction = {
            description,
            amount,
            splitType,
            initiatedBy: user.name, // Include the user's name
            splitDetails: updatedSplitDetails,
        };

        // Add the transaction to the group
        group.transactions.push(transaction);
        await group.save();

        res.status(201).json({
            status: "SUCCESS",
            message: "Transaction added successfully!",
            transaction,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while adding the transaction.",
        });
    }
});


router.get('/groups/:groupId', authenticate, async (req, res) => {
    try {
        const { groupId } = req.params;

        const group = await Group.findById(groupId)
            .populate('members', 'name email') // Populate members
            .populate('transactions.initiatedBy', 'name email') // Populate initiators
            .populate('transactions.splitDetails.member', 'name email'); // Populate split details

        if (!group) {
            return res.status(404).json({
                status: "FAILED",
                message: "Group not found.",
            });
        }

        res.status(200).json({
            status: "SUCCESS",
            group,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while fetching the group details.",
        });
    }
});


module.exports = router;
