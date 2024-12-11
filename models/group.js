const mongoose = require('mongoose');  
const Schema = mongoose.Schema;

// Define the Group schema
const GroupSchema = new mongoose.Schema(
    {
        title: { type: String, required: true }, // Group title
        description: { type: String, required: true }, // Group description
        members: [
            {
                email: { type: String, required: true, unique: true }, // Member's email address
                name: { type: String, required: true }, // Member's name
            },
        ],
        transactions: [
            {
                description: { type: String, required: true }, // Transaction description
                amount: { type: Number, required: true }, // Transaction amount
                date: { type: Date, default: Date.now }, // Date of the transaction
                initiatedBy: { type: String, required: true }, // Initiator's email
                splitDetails: [
                    {
                        memberEmail: { type: String, required: true }, // Member's email
                        share: { type: Number, required: true }, // Share of the transaction amount
                        paid: { type: Boolean, default: false }, // Whether the member has paid their share
                    },
                ],
            },
        ],
    },
    { timestamps: true } // Automatically add `createdAt` and `updatedAt` timestamps
);

// Middleware to handle splitting amount equally when transaction is created
GroupSchema.pre('save', function (next) {
    // For each transaction, calculate the equal split among members except for the initiator
    this.transactions.forEach((transaction) => {
        // Find members who are not the initiator
        const nonInitiatorMembers = this.members.filter(member => member.email !== transaction.initiatedBy);

        // Calculate equal share for each non-initiating member
        const equalShare = transaction.amount / nonInitiatorMembers.length;

        // Add split details for each non-initiating member
        transaction.splitDetails = nonInitiatorMembers.map(member => ({
            memberEmail: member.email,
            share: equalShare,
            paid: false, // Initially, no one has paid
        }));
    });

    next();
});

// Create and export the Group model
const Group = mongoose.model('Group', GroupSchema);
module.exports = Group;
