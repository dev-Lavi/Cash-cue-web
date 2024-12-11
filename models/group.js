const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define the Group schema
const GroupSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // Group title
    description: { type: String, required: true }, // Group description
    members: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Member's user ID
        email: { type: String, required: true }, // Member's email address
        role: { type: String, enum: ['admin', 'member'], default: 'member' }, // Role in the group
      },
    ],
    transactions: [
      {
        description: { type: String, required: true }, // Transaction description
        amount: { type: Number, required: true }, // Transaction amount
        date: { type: Date, default: Date.now }, // Date of the transaction
        splitType: { type: String, enum: ['equally', 'unequally', 'percentage'], required: true }, // Split type
        initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Initiator
        status: { type: String, enum: ['pending', 'completed'], default: 'pending' }, // Transaction status
        splitDetails: [
          {
            member: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Member ID
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
  this.transactions.forEach((transaction) => {
    if (transaction.splitType === 'equally') {
      // Get all members except the initiator
      const nonInitiatorMembers = this.members.filter(
        (member) => member.userId.toString() !== transaction.initiatedBy.toString()
      );

      // If there are no non-initiating members, return an error
      if (nonInitiatorMembers.length === 0) {
        return next(new Error('There must be at least one member to split the transaction.'));
      }

      // Calculate the equal share for each non-initiating member
      const equalShare = transaction.amount / nonInitiatorMembers.length;

      // Populate splitDetails with userIds of non-initiator members
      transaction.splitDetails = nonInitiatorMembers.map((member) => ({
        member: member.userId, // Correctly assign `member` as `userId`
        share: equalShare,
        paid: false, // Initially, no one has paid
      }));
    }
  });

  // Proceed to save the transaction
  next();
});

// Create and export the Group model
const Group = mongoose.model('Group', GroupSchema);
module.exports = Group;
