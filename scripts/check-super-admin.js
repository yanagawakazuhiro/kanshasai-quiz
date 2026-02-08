require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const SuperAdmin = require("../models/SuperAdmin");

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI is not set");
  process.exit(1);
}

async function checkSuperAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("✅ MongoDBに接続しました\n");

    const username = process.argv[2] || "admin";
    
    const superAdmin = await SuperAdmin.findOne({ username });
    
    if (!superAdmin) {
      console.log(`❌ スーパー管理者 "${username}" が見つかりませんでした。`);
      console.log("\n作成するには:");
      console.log(`  node scripts/create-super-admin.js ${username} <password>`);
      process.exit(1);
    }

    console.log(`✅ スーパー管理者 "${username}" が見つかりました:`);
    console.log(`   ID: ${superAdmin._id}`);
    console.log(`   ユーザー名: ${superAdmin.username}`);
    console.log(`   作成日時: ${superAdmin.createdAt}`);
    console.log(`   最終ログイン: ${superAdmin.lastLoginAt || "未ログイン"}`);
    console.log(`   パスワードハッシュ: ${superAdmin.password.substring(0, 20)}...`);

    // パスワード検証テスト
    const testPassword = process.argv[3] || "admin123";
    console.log(`\n🔐 パスワード検証テスト: "${testPassword}"`);
    const passwordMatch = await bcrypt.compare(testPassword, superAdmin.password);
    if (passwordMatch) {
      console.log("   ✅ パスワードが一致しました");
    } else {
      console.log("   ❌ パスワードが一致しませんでした");
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ エラー:", error);
    process.exit(1);
  }
}

checkSuperAdmin();
