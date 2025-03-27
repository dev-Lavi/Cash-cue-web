const mongoose = require('mongoose');

const FriendshipSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    friendId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

const Friendship = mongoose.model('Friendship', FriendshipSchema);
module.exports = Friendship;
