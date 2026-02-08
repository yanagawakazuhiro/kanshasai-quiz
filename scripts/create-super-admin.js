require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const SuperAdmin = require("../models/SuperAdmin");

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set");
  process.exit(1);
}

async function createSuperAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDBに接続しました");

    const username = process.argv[2] || "admin";
    const password = process.argv[3] || "admin123";

    // 既存のスーパー管理者をチェック
    const existing = await SuperAdmin.findOne({ username });
    if (existing) {
      console.log(`⚠️  スーパー管理者 "${username}" は既に存在します。`);
      process.exit(0);
    }

    // パスワードをハッシュ化
    const hashedPassword = await bcrypt.hash(password, 10);

    const superAdmin = new SuperAdmin({
      username,
      password: hashedPassword,
    });

    await superAdmin.save();
    console.log(`✅ スーパー管理者を作成しました:`);
    console.log(`   ユーザー名: ${username}`);
    console.log(`   パスワード: ${password}`);
    console.log(`\n⚠️  本番環境では必ずパスワードを変更してください！`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  }
}

createSuperAdmin();
