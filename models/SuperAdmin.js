const mongoose = require("mongoose");

const superAdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // ハッシュ化されたパスワード
  createdAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date },
});

module.exports = mongoose.model("SuperAdmin", superAdminSchema);
