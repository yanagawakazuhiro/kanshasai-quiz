const adminKey = prompt("ADMIN_KEY を入力してください");
const socket = io({ auth: { adminKey } });

const adminStatusElement = document.getElementById("admin-status");
const connectedUsersElement = document.getElementById("connected-users");
const currentQuestionDisplay = document.getElementById(
  "current-question-display"
);
const currentQuestionIndexDisplay = document.getElementById(
  "current-question-index"
);
const totalQuestionsDisplay = document.getElementById("total-questions");
const quizActiveStatusDisplay = document.getElementById("quiz-active-status");

const resetNicknamesBtn = document.getElementById("resetNicknamesBtn");

const addQuestionForm = document.getElementById("add-question-form");
const questionTextElement = document.getElementById("questionText");
const optionAElement = document.getElementById("optionA");
const optionBElement = document.getElementById("optionB");
const optionCElement = document.getElementById("optionC");
const optionDElement = document.getElementById("optionD");
const correctOptionElement = document.getElementById("correctOption");
const questionListElement = document.getElementById("question-list");
const optionAImageUrlEl = document.getElementById("optionAImageUrl");
const optionBImageUrlEl = document.getElementById("optionBImageUrl");
const optionCImageUrlEl = document.getElementById("optionCImageUrl");
const optionDImageUrlEl = document.getElementById("optionDImageUrl");

uploadImageAndSetUrl(
  document.getElementById("optionAImageFile"),
  document.getElementById("optionAImageUrl")
);
uploadImageAndSetUrl(
  document.getElementById("optionBImageFile"),
  document.getElementById("optionBImageUrl")
);
uploadImageAndSetUrl(
  document.getElementById("optionCImageFile"),
  document.getElementById("optionCImageUrl")
);
uploadImageAndSetUrl(
  document.getElementById("optionDImageFile"),
  document.getElementById("optionDImageUrl")
);

// サーバー接続時の処理
socket.on("connect", () => {
  adminStatusElement.textContent = "サーバーに接続済み (管理)";
  console.log("Admin connected to server - socket ID:", socket.id);
  //adminConnectイベントは接続時にすぐに送信する
  socket.emit("adminConnect");

  fetchQuestions();
  console.log("adminConnectイベントを送信しました (接続直後)。");
});

socket.on("disconnect", () => {
  adminStatusElement.textContent = "サーバーから切断されました";
  if (resetNicknamesBtn) resetNicknamesBtn.disabled = true;
  console.log("Admin disconnected from server");
});

// 参加者数の更新を受信
socket.on("updateUserCount", (count) => {
  connectedUsersElement.textContent = count;
});

socket.on("quizStatus", (status) => {
  console.log("--- admin.js - quizStatus イベント受信 ---");
  console.log("受信したステータスデータ:", status);

  // サーバーがこのソケットを管理者として認識したら、ボタンを有効化する
  if (status.isAdmin) {
    // <-- サーバーから送られてくる isAdmin フラグをチェック
    adminStatusElement.textContent = "サーバーに接続済み (管理者)";
    resetNicknamesBtn.disabled = false; // <-- ニックネームリセットボタンを有効化！
  } else {
    // サーバーがまだこのソケットを管理者と認識していない場合
    adminStatusElement.textContent = "サーバーの応答を待機中... (管理者認証中)";
    resetNicknamesBtn.disabled = true; // ボタンは無効のまま
  }

  currentQuestionDisplay.textContent = status.currentQuestionText || "なし";
  currentQuestionIndexDisplay.textContent =
    status.currentQuestionIndex !== -1 ? status.currentQuestionIndex + 1 : "-";
  totalQuestionsDisplay.textContent = status.totalQuestions;
  quizActiveStatusDisplay.textContent = status.isActive ? "進行中" : "停止中";
});

// ニックネームリセットボタンのイベントリスナー
resetNicknamesBtn.onclick = () => {
  if (
    confirm(
      "本当に全ての参加者のニックネームをリセットしますか？この操作は元に戻せません。"
    )
  ) {
    socket.emit("hostCommand", { type: "resetNicknames" }); // サーバーにコマンドを送信
    console.log("ニックネームリセットコマンドを送信しました。");
  }
};
// --- 問題管理 ---

// 問題リストの描画
function renderQuestions(questions) {
  questionListElement.innerHTML = ""; // 一度クリア
  if (questions.length === 0) {
    questionListElement.innerHTML = "<p>問題がありません。</p>";
    return;
  }
  // questions.forEach に index を追加
  questions.forEach((q, index) => {
    // <-- ここを修正
    const item = document.createElement("div");
    item.classList.add("question-item");
    item.innerHTML = `
            <span>${index + 1}. ${q.text} (正解: ${
      q.correctOptionId
    })</span>  <!-- <-- ここを修正: ${index + 1}. を追加 -->
            <div>
                <button data-id="${q._id}" class="edit-btn">編集</button>
                <button data-id="${q._id}" class="delete-btn">削除</button>
            </div>
        `;
    questionListElement.appendChild(item);
  });

  // 編集・削除ボタンにイベントリスナーを追加
  document.querySelectorAll(".delete-btn").forEach((button) => {
    button.onclick = (e) => deleteQuestion(e.target.dataset.id);
  });
  document.querySelectorAll(".edit-btn").forEach((button) => {
    button.onclick = (e) => startEdit(e.target.dataset.id);
  });
}
// サーバーから問題リストをフェッチ
async function fetchQuestions() {
  try {
    // GET /api/questions エンドポイントを叩く
    const response = await fetch("/api/questions");
    const questions = await response.json();
    renderQuestions(questions);
  } catch (error) {
    console.error("問題の取得中にエラーが発生しました:", error);
    questionListElement.innerHTML =
      '<p style="color:red;">問題のロードに失敗しました。</p>';
  }
}

addQuestionForm.onsubmit = async (e) => {
  e.preventDefault();

  const body = {
    text: questionTextElement.value,
    correctOptionId: correctOptionElement.value.toUpperCase(),
    options: [
      {
        id: "A",
        text: optionAElement.value,
        imageUrl: optionAImageUrlEl.value.trim(),
      },
      {
        id: "B",
        text: optionBElement.value,
        imageUrl: optionBImageUrlEl.value.trim(),
      },
      {
        id: "C",
        text: optionCElement.value,
        imageUrl: optionCImageUrlEl.value.trim(),
      },
      {
        id: "D",
        text: optionDElement.value,
        imageUrl: optionDImageUrlEl.value.trim(),
      },
    ],
  };

  const editingId = editingQuestionIdEl?.value?.trim();
  const url = editingId ? `/api/questions/${editingId}` : "/api/questions";
  const method = editingId ? "PUT" : "POST";

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      alert(editingId ? "問題を更新しました！" : "問題を追加しました！");
      cancelEdit();
      fetchQuestions();
    } else {
      const err = await response.json().catch(() => ({}));
      alert(
        (editingId ? "更新" : "追加") +
          "に失敗: " +
          (err.message || response.status)
      );
    }
  } catch (error) {
    console.error("送信エラー:", error);
    alert("通信エラーが発生しました。");
  }
};

// 問題削除関数
async function deleteQuestion(id) {
  if (!confirm("本当にこの問題を削除しますか？")) {
    return;
  }
  try {
    // DELETE /api/questions/:id エンドポイントを叩く
    const response = await fetch(`/api/questions/${id}`, {
      method: "DELETE",
    });
    if (response.ok) {
      alert("問題を削除しました！");
      fetchQuestions(); // 問題リストを再読み込み
    } else {
      alert("問題の削除に失敗しました。");
    }
  } catch (error) {
    console.error("問題の削除中にエラーが発生しました:", error);
    alert("問題の削除中にエラーが発生しました。");
  }
}

// サーバーから問題リスト更新の通知を受け取る (リアルタイム反映用)
socket.on("questionsUpdated", () => {
  fetchQuestions();
});

// ニックネームリセット成功の通知
socket.on("nicknamesResetSuccess", () => {
  alert("全ての参加者のニックネームをリセットしました！");
  // 画面の再読み込みは不要。ランキング表示がないため。
  // 必要であれば、参加者画面に「ニックネームを再入力してください」などのメッセージを送る
});

const editingQuestionIdEl = document.getElementById("editingQuestionId");
const submitQuestionBtn = document.getElementById("submitQuestionBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

// 画像input id はあなたの実装に合わせて（例）
const optionAImageEl = document.getElementById("optionAImage");
const optionBImageEl = document.getElementById("optionBImage");
const optionCImageEl = document.getElementById("optionCImage");
const optionDImageEl = document.getElementById("optionDImage");

async function startEdit(id) {
  const res = await fetch("/api/questions");
  const list = await res.json();
  const q = list.find((x) => x._id === id);
  if (!q) return alert("対象の問題が見つかりませんでした。");

  // フォームに流し込み
  questionTextElement.value = q.text || "";
  optionAImageUrlEl.value =
    q.options?.find((o) => o.id === "A")?.imageUrl || "";
  optionBImageUrlEl.value =
    q.options?.find((o) => o.id === "B")?.imageUrl || "";
  optionCImageUrlEl.value =
    q.options?.find((o) => o.id === "C")?.imageUrl || "";
  optionDImageUrlEl.value =
    q.options?.find((o) => o.id === "D")?.imageUrl || "";
  correctOptionElement.value = (q.correctOptionId || "").toUpperCase();

  // file input はセキュリティ上セットできないので「選択し直し」
  if (optionAImageEl) optionAImageEl.value = "";
  if (optionBImageEl) optionBImageEl.value = "";
  if (optionCImageEl) optionCImageEl.value = "";
  if (optionDImageEl) optionDImageEl.value = "";

  editingQuestionIdEl.value = id;
  if (submitQuestionBtn) submitQuestionBtn.textContent = "更新する";
  if (cancelEditBtn) cancelEditBtn.style.display = "inline-block";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function cancelEdit() {
  editingQuestionIdEl.value = "";
  addQuestionForm.reset();
  if (submitQuestionBtn) submitQuestionBtn.textContent = "問題を追加";
  if (cancelEditBtn) cancelEditBtn.style.display = "none";
}

if (cancelEditBtn) cancelEditBtn.onclick = cancelEdit;

async function uploadImageAndSetUrl(fileInputEl, urlInputEl) {
  fileInputEl.addEventListener("change", async () => {
    const file = fileInputEl.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("image", file);

    const res = await fetch("/api/upload", {
      method: "POST",
      body: fd,
    });

    if (!res.ok) {
      alert("画像アップロードに失敗しました");
      return;
    }

    const data = await res.json();
    urlInputEl.value = data.url; // ここがポイント：URL欄に自動で入る
  });
}
