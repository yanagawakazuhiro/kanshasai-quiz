// 運用者用管理画面JavaScript
let currentRoomId = null;
let socket = null;

// ログイン状態確認と初期化
(async function init() {
  try {
    const statusResponse = await fetch("/api/auth/operator/status", {
      credentials: "include",
    });
    const statusData = await statusResponse.json();

    if (!statusData.isLoggedIn) {
      window.location.href = "/operator-login.html";
      return;
    }

    currentRoomId = statusData.roomId;
    document.getElementById("roomIdDisplay").textContent = `ルームID: ${currentRoomId}`;

    // Socket.IO接続（roomIdを指定）
    socket = io({
      query: { roomId: currentRoomId },
      auth: { roomId: currentRoomId },
    });

    setupSocketHandlers();
    setupEventListeners();
    fetchQuestions();
    fetchTimerDuration();
    loadBgmInfo();
  } catch (error) {
    console.error("初期化エラー:", error);
    window.location.href = "/operator-login.html";
  }
})();

const adminStatusElement = document.getElementById("admin-status");
const connectedUsersElement = document.getElementById("connected-users");
const currentQuestionDisplay = document.getElementById("current-question-display");
const currentQuestionIndexDisplay = document.getElementById(
  "current-question-index"
);
const totalQuestionsDisplay = document.getElementById("total-questions");
const quizActiveStatusDisplay = document.getElementById("quiz-active-status");
const resetNicknamesBtn = document.getElementById("resetNicknamesBtn");
const logoutBtn = document.getElementById("logoutBtn");
const openDisplayBtn = document.getElementById("openDisplayBtn");

// タイマー設定関連の要素
const timerDurationInput = document.getElementById("timerDuration");
const saveTimerBtn = document.getElementById("saveTimerBtn");
const timerStatusElement = document.getElementById("timer-status");

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
const optionAVideoUrlEl = document.getElementById("optionAVideoUrl");
const optionBVideoUrlEl = document.getElementById("optionBVideoUrl");
const optionCVideoUrlEl = document.getElementById("optionCVideoUrl");
const optionDVideoUrlEl = document.getElementById("optionDVideoUrl");

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

// 動画アップロード関数
async function uploadVideoAndSetUrl(fileInputEl, urlInputEl) {
  fileInputEl.addEventListener("change", async () => {
    const file = fileInputEl.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("video", file);

    const res = await fetch("/api/upload-video", {
      method: "POST",
      credentials: "include",
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text();
      alert("動画アップロードに失敗しました: " + res.status + " " + text);
      return;
    }

    const data = await res.json();
    urlInputEl.value = data.url;
  });
}

uploadVideoAndSetUrl(
  document.getElementById("optionAVideoFile"),
  document.getElementById("optionAVideoUrl")
);
uploadVideoAndSetUrl(
  document.getElementById("optionBVideoFile"),
  document.getElementById("optionBVideoUrl")
);
uploadVideoAndSetUrl(
  document.getElementById("optionCVideoFile"),
  document.getElementById("optionCVideoUrl")
);
uploadVideoAndSetUrl(
  document.getElementById("optionDVideoFile"),
  document.getElementById("optionDVideoUrl")
);

function setupSocketHandlers() {
  // サーバー接続時の処理
  socket.on("connect", () => {
    adminStatusElement.textContent = "サーバーに接続済み (運用者)";
    console.log("Operator connected to server - socket ID:", socket.id);
    socket.emit("adminConnect");

    fetchQuestions();
    fetchTimerDuration();
  });

  socket.on("disconnect", () => {
    adminStatusElement.textContent = "サーバーから切断されました";
    if (resetNicknamesBtn) resetNicknamesBtn.disabled = true;
    console.log("Operator disconnected from server");
  });

  // 参加者数の更新を受信
  socket.on("updateUserCount", (count) => {
    connectedUsersElement.textContent = count;
  });

  socket.on("quizStatus", (status) => {
    console.log("--- operator-admin.js - quizStatus イベント受信 ---");
    console.log("受信したステータスデータ:", status);

    if (status.isAdmin) {
      adminStatusElement.textContent = "サーバーに接続済み (運用者)";
      resetNicknamesBtn.disabled = false;
    } else {
      adminStatusElement.textContent = "サーバーの応答を待機中... (認証中)";
      resetNicknamesBtn.disabled = true;
    }

    currentQuestionDisplay.textContent = status.currentQuestionText || "なし";
    currentQuestionIndexDisplay.textContent =
      status.currentQuestionIndex !== -1 ? status.currentQuestionIndex + 1 : "-";
    totalQuestionsDisplay.textContent = status.totalQuestions;
    quizActiveStatusDisplay.textContent = status.isActive ? "進行中" : "停止中";

    if (status.connectedUsers !== undefined) {
      connectedUsersElement.textContent = status.connectedUsers;
    }

    if (status.timerDuration !== undefined && timerDurationInput) {
      timerDurationInput.value = status.timerDuration;
    }
  });

  // サーバーから問題リスト更新の通知を受け取る
  socket.on("questionsUpdated", () => {
    fetchQuestions();
  });

  // ニックネームリセット成功の通知
  socket.on("nicknamesResetSuccess", () => {
    alert("全ての参加者のニックネームをリセットしました！");
  });
}

function setupEventListeners() {
  // 表示画面を開くボタン
  if (openDisplayBtn) {
    openDisplayBtn.addEventListener("click", () => {
      // 新しいタブで表示画面を開く
      window.open("/operator-display.html", "_blank");
    });
  }

  // ログアウトボタン
  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/api/auth/operator/logout", {
        method: "POST",
        credentials: "include",
      });
      window.location.href = "/operator-login.html";
    } catch (error) {
      console.error("ログアウトエラー:", error);
    }
  });

  // タイマー保存ボタン
  if (saveTimerBtn) {
    saveTimerBtn.onclick = saveTimerDuration;
  }

  // ニックネームリセットボタン
  resetNicknamesBtn.onclick = () => {
    if (
      confirm(
        "本当に全ての参加者のニックネームをリセットしますか？この操作は元に戻せません。"
      )
    ) {
      socket.emit("hostCommand", { type: "resetNicknames" });
      console.log("ニックネームリセットコマンドを送信しました。");
    }
  };

  // 問題追加フォーム
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
          videoUrl: optionAVideoUrlEl.value.trim(),
        },
        {
          id: "B",
          text: optionBElement.value,
          imageUrl: optionBImageUrlEl.value.trim(),
          videoUrl: optionBVideoUrlEl.value.trim(),
        },
        {
          id: "C",
          text: optionCElement.value,
          imageUrl: optionCImageUrlEl.value.trim(),
          videoUrl: optionCVideoUrlEl.value.trim(),
        },
        {
          id: "D",
          text: optionDElement.value,
          imageUrl: optionDImageUrlEl.value.trim(),
          videoUrl: optionDVideoUrlEl.value.trim(),
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
        credentials: "include",
        body: JSON.stringify(body),
      });

      if (response.ok) {
        alert(editingId ? "問題を更新しました！" : "問題を追加しました！");
        cancelEdit();
        fetchQuestions();
      } else {
        if (response.status === 401) {
          window.location.href = "/operator-login.html";
          return;
        }
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
}

// タイマー時間を取得する関数
async function fetchTimerDuration() {
  try {
    const response = await fetch("/api/timer-duration", {
      credentials: "include",
    });
    if (response.status === 401) {
      window.location.href = "/operator-login.html";
      return;
    }
    if (response.ok) {
      const data = await response.json();
      if (timerDurationInput) {
        timerDurationInput.value = data.duration;
      }
    }
  } catch (error) {
    console.error("タイマー時間の取得中にエラーが発生しました:", error);
  }
}

// タイマー時間を保存する関数
async function saveTimerDuration() {
  const duration = parseInt(timerDurationInput.value, 10);

  if (isNaN(duration) || duration < 1 || duration > 300) {
    if (timerStatusElement) {
      timerStatusElement.textContent =
        "タイマー時間は1秒以上300秒以下である必要があります。";
      timerStatusElement.style.color = "red";
    }
    return;
  }

  try {
    const response = await fetch("/api/timer-duration", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ duration }),
    });

    if (response.status === 401) {
      window.location.href = "/operator-login.html";
      return;
    }

    if (response.ok) {
      const data = await response.json();
      if (timerStatusElement) {
        timerStatusElement.textContent = `タイマー時間を ${data.duration} 秒に設定しました。`;
        timerStatusElement.style.color = "lightgreen";
      }
      console.log(`タイマー時間を ${data.duration} 秒に設定しました。`);
    } else {
      const error = await response.json().catch(() => ({}));
      if (timerStatusElement) {
        timerStatusElement.textContent =
          error.message || "タイマー時間の設定に失敗しました。";
        timerStatusElement.style.color = "red";
      }
    }
  } catch (error) {
    console.error("タイマー時間の設定中にエラーが発生しました:", error);
    if (timerStatusElement) {
      timerStatusElement.textContent = "通信エラーが発生しました。";
      timerStatusElement.style.color = "red";
    }
  }
}

// 問題リストの描画
function renderQuestions(questions) {
  questionListElement.innerHTML = "";
  if (questions.length === 0) {
    questionListElement.innerHTML = "<p>問題がありません。</p>";
    return;
  }
  questions.forEach((q, index) => {
    const item = document.createElement("div");
    item.classList.add("question-item");
    item.innerHTML = `
            <span>${index + 1}. ${q.text} (正解: ${q.correctOptionId})</span>
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
    const response = await fetch("/api/questions", {
      credentials: "include",
    });
    if (response.status === 401) {
      window.location.href = "/operator-login.html";
      return;
    }
    const questions = await response.json();
    renderQuestions(questions);
  } catch (error) {
    console.error("問題の取得中にエラーが発生しました:", error);
    questionListElement.innerHTML =
      '<p style="color:red;">問題のロードに失敗しました。</p>';
  }
}

// 問題削除関数
async function deleteQuestion(id) {
  if (!confirm("本当にこの問題を削除しますか？")) {
    return;
  }
  try {
    const response = await fetch(`/api/questions/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (response.status === 401) {
      window.location.href = "/operator-login.html";
      return;
    }
    if (response.ok) {
      alert("問題を削除しました！");
      fetchQuestions();
    } else {
      alert("問題の削除に失敗しました。");
    }
  } catch (error) {
    console.error("問題の削除中にエラーが発生しました:", error);
    alert("問題の削除中にエラーが発生しました。");
  }
}

const editingQuestionIdEl = document.getElementById("editingQuestionId");
const submitQuestionBtn = document.getElementById("submitQuestionBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

async function startEdit(id) {
  const res = await fetch("/api/questions", {
    credentials: "include",
  });
  if (res.status === 401) {
    window.location.href = "/operator-login.html";
    return;
  }
  const list = await res.json();
  const q = list.find((x) => x._id === id);
  if (!q) return alert("対象の問題が見つかりませんでした。");

  console.log("[startEdit] 編集する問題データ:", q);
  console.log("[startEdit] 選択肢データ:", q.options);

  // フォームに流し込み
  questionTextElement.value = q.text || "";
  
  // 選択肢データを取得
  const optA = q.options?.find((o) => o.id === "A");
  const optB = q.options?.find((o) => o.id === "B");
  const optC = q.options?.find((o) => o.id === "C");
  const optD = q.options?.find((o) => o.id === "D");

  // テキスト
  optionAElement.value = optA?.text || "";
  optionBElement.value = optB?.text || "";
  optionCElement.value = optC?.text || "";
  optionDElement.value = optD?.text || "";

  // 画像URL
  optionAImageUrlEl.value = optA?.imageUrl || "";
  optionBImageUrlEl.value = optB?.imageUrl || "";
  optionCImageUrlEl.value = optC?.imageUrl || "";
  optionDImageUrlEl.value = optD?.imageUrl || "";

  // 動画URL
  const videoUrlA = optA?.videoUrl || "";
  const videoUrlB = optB?.videoUrl || "";
  const videoUrlC = optC?.videoUrl || "";
  const videoUrlD = optD?.videoUrl || "";
  
  console.log("[startEdit] 動画URL - A:", videoUrlA, "B:", videoUrlB, "C:", videoUrlC, "D:", videoUrlD);
  
  optionAVideoUrlEl.value = videoUrlA;
  optionBVideoUrlEl.value = videoUrlB;
  optionCVideoUrlEl.value = videoUrlC;
  optionDVideoUrlEl.value = videoUrlD;
  
  correctOptionElement.value = (q.correctOptionId || "").toUpperCase();

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

    const res = await fetch("/api/upload-image", {
      method: "POST",
      credentials: "include",
      body: fd,
    });

    if (!res.ok) {
      const text = await res.text();
      alert("画像アップロードに失敗しました: " + res.status + " " + text);
      return;
    }

    const data = await res.json();
    urlInputEl.value = data.url;
  });
}

// BGMアップロード関数
const bgmFileInput = document.getElementById("bgmFile");
const uploadBgmBtn = document.getElementById("uploadBgmBtn");
const bgmStatusElement = document.getElementById("bgm-status");
const bgmPreviewDiv = document.getElementById("bgm-preview");
const bgmPreviewAudio = document.getElementById("bgm-preview-audio");
const removeBgmBtn = document.getElementById("removeBgmBtn");

if (uploadBgmBtn) {
  uploadBgmBtn.addEventListener("click", async () => {
    const file = bgmFileInput?.files?.[0];
    if (!file) {
      bgmStatusElement.textContent = "ファイルを選択してください";
      bgmStatusElement.style.color = "#e74c3c";
      return;
    }

    bgmStatusElement.textContent = "アップロード中...";
    bgmStatusElement.style.color = "#61dafb";

    const fd = new FormData();
    fd.append("bgm", file);

    try {
      const res = await fetch("/api/upload-bgm", {
        method: "POST",
        credentials: "include",
        body: fd,
      });

      if (!res.ok) {
        const text = await res.text();
        bgmStatusElement.textContent = "アップロードに失敗しました: " + res.status;
        bgmStatusElement.style.color = "#e74c3c";
        return;
      }

      const data = await res.json();
      bgmStatusElement.textContent = "アップロード成功！";
      bgmStatusElement.style.color = "#1f8f4a";
      
      // BGM情報を再読み込み
      loadBgmInfo();
    } catch (error) {
      console.error("BGMアップロードエラー:", error);
      bgmStatusElement.textContent = "アップロード中にエラーが発生しました";
      bgmStatusElement.style.color = "#e74c3c";
    }
  });
}

// BGM情報を読み込む
async function loadBgmInfo() {
  try {
    const response = await fetch("/api/auth/operator/status", {
      credentials: "include",
    });
    const statusData = await response.json();
    
    if (statusData.isLoggedIn && statusData.bgmUrl) {
      bgmPreviewAudio.src = statusData.bgmUrl;
      bgmPreviewDiv.style.display = "block";
    } else {
      bgmPreviewDiv.style.display = "none";
    }
  } catch (error) {
    console.error("BGM情報の取得エラー:", error);
  }
}

// BGM削除機能
if (removeBgmBtn) {
  removeBgmBtn.addEventListener("click", async () => {
    if (!confirm("BGMを削除しますか？")) {
      return;
    }

    try {
      const res = await fetch("/api/operator/bgm", {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        alert("BGMの削除に失敗しました");
        return;
      }

      bgmStatusElement.textContent = "BGMを削除しました";
      bgmStatusElement.style.color = "#1f8f4a";
      bgmPreviewDiv.style.display = "none";
      bgmPreviewAudio.src = "";
    } catch (error) {
      console.error("BGM削除エラー:", error);
      alert("BGMの削除中にエラーが発生しました");
    }
  });
}
