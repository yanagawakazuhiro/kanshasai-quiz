const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    socketId: { type: String, required: true },
    nickname: { type: String, default: '匿名参加者' }, 
    score: { type: Number, default: 0 },
    lastConnectedAt: { type: Date, default: Date.now },
    scoreHistory: [{ type: String }],
    roomId: { type: String, required: true, default: "default", index: true } // ルームID
});

// socketIdとroomIdの複合ユニークインデックス
userSchema.index({ socketId: 1, roomId: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);