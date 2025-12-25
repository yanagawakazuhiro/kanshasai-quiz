const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    socketId: { type: String, required: true, unique: true },
    nickname: { type: String, default: '匿名参加者' }, 
    score: { type: Number, default: 0 },
    lastConnectedAt: { type: Date, default: Date.now },
    scoreHistory: [{ type: String }]
});

module.exports = mongoose.model('User', userSchema);