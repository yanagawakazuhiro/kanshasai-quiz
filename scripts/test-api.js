// 基本的なAPI動作確認スクリプト
const http = require("http");

const BASE_URL = "http://localhost:3000";

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    const req = http.request(url, options, (res) => {
      let body = "";
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const json = body ? JSON.parse(body) : {};
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function test() {
  console.log("=== API動作確認テスト ===\n");

  // 1. スーパー管理者ログイン状態確認（未ログイン）
  console.log("1. スーパー管理者ログイン状態確認（未ログイン）");
  const status1 = await makeRequest("GET", "/api/auth/super-admin/status");
  console.log(`   ステータス: ${status1.status}`);
  console.log(`   レスポンス:`, status1.data);
  console.log("");

  // 2. スーパー管理者ログイン
  console.log("2. スーパー管理者ログイン");
  const login = await makeRequest("POST", "/api/auth/super-admin/login", {
    username: "admin",
    password: "admin123",
  });
  console.log(`   ステータス: ${login.status}`);
  console.log(`   レスポンス:`, login.data);
  console.log("");

  if (login.status === 200) {
    // 3. 運用者一覧取得
    console.log("3. 運用者一覧取得");
    const operators = await makeRequest("GET", "/api/super-admin/operators");
    console.log(`   ステータス: ${operators.status}`);
    console.log(`   レスポンス:`, operators.data);
    console.log("");

    // 4. 統計情報取得
    console.log("4. 統計情報取得");
    const stats = await makeRequest("GET", "/api/super-admin/stats");
    console.log(`   ステータス: ${stats.status}`);
    console.log(`   レスポンス:`, stats.data);
    console.log("");
  }

  console.log("=== テスト完了 ===");
}

test().catch(console.error);
