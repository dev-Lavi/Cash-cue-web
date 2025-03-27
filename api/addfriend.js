const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Friendship = require('../models/friendship');
const authenticate = require('../middleware/authenticate');

// Add a friend API
router.post('/add-friend', authenticate, async (req, res) => {
    try {
        const { friendEmail } = req.body;
        const userId = req.user._id; // The logged-in user's ID

        if (!friendEmail) {
            return res.status(400).json({
                status: "FAILED",
                message: "Provide an email to add a friend.",
            });
        }

        // Check if the friend exists
        const friend = await User.findOne({ email: friendEmail });

        if (!friend) {
            return res.status(404).json({
                status: "FAILED",
                message: "Friend not found in the system.",
            });
        }

        // Prevent adding yourself as a friend
        if (friend._id.toString() === userId.toString()) {
            return res.status(400).json({
                status: "FAILED",
                message: "You cannot add yourself as a friend.",
            });
        }

        // Check if they are already friends
        const existingFriendship = await Friendship.findOne({
            $or: [
                { userId, friendId: friend._id },
                { userId: friend._id, friendId: userId }
            ]
        });

        if (existingFriendship) {
            return res.status(400).json({
                status: "FAILED",
                message: "You are already friends.",
            });
        }

        // Create a new friendship (adding both ways for mutual friendship)
        await Friendship.create({ userId, friendId: friend._id });
        await Friendship.create({ userId: friend._id, friendId: userId });

        res.status(200).json({
            status: "SUCCESS",
            message: "Friend added successfully!",
            friend: {
                id: friend._id,
                name: friend.name,
                email: friend.email,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: "FAILED",
            message: "An error occurred while adding the friend.",
        });
    }
});

module.exports = router;
