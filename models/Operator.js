const mongoose = require("mongoose");

const operatorSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // ハッシュ化されたパスワード
  email: { type: String },
  roomId: { type: String, required: true, unique: true }, // この運用者のルームID
  bgmUrl: { type: String }, // BGMファイルのURL
  createdAt: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
});

module.exports = mongoose.model("Operator", operatorSchema);
