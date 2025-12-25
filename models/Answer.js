const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    selectedOptionId: { type: String, required: true },
    isCorrect: { type: Boolean, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Answer', answerSchema);