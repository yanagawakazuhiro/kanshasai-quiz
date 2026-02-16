const mongoose = require("mongoose");

// 問題のスキーマを定義
const questionSchema = new mongoose.Schema({
  text: { type: String, required: true }, // 問題文
  options: [
    {
      id: { type: String, required: true }, // A / B / C / D
      text: { type: String, required: true }, // 選択肢テキスト
      imageUrl: { type: String }, // 画像URL
      videoUrl: { type: String }, // 動画URL
    },
  ],
  correctOptionId: { type: String, required: true }, // 正解
  roomId: { type: String, required: true, default: "default", index: true }, // ルームID
});

module.exports = mongoose.model("Question", questionSchema);
