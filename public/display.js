const adminKey = (prompt("ADMIN_KEY を入力してください") || "").trim();
if (!adminKey) {
  alert("ADMIN_KEY が空です。もう一度開き直してください。");
}
const socket = io({
  auth: { adminKey },
  query: { adminKey },
});

const displayStatusElement = document.getElementById("display-status");
const countdownElement = document.getElementById("countdown");
const questionTextElement = document.getElementById("question-text");
const optionsContainer = document.getElementById("options");

//クイズ制御ボタンとステータス表示のDOM要素取得
const startQuizBtnDisplay = document.getElementById("startQuizBtnDisplay");
const showResultsBtnDisplay = document.getElementById("showResultsBtnDisplay");
const nextQuestionBtnDisplay = document.getElementById(
  "nextQuestionBtnDisplay"
);
const endQuizBtnDisplay = document.getElementById("endQuizBtnDisplay");

function $(id) {
  return document.getElementById(id);
}
function onClick(el, fn) {
  if (el) el.addEventListener("click", fn);
}
function setText(el, text) {
  if (el) el.textContent = text;
}
function setShow(el, show) {
  if (el) el.style.display = show ? "" : "none";
}

//初期状態で全てのクイズ制御ボタンを無効化
startQuizBtnDisplay.disabled = true;
showResultsBtnDisplay.style.display = "none";
nextQuestionBtnDisplay.disabled = true;
endQuizBtnDisplay.disabled = true;
//クイズ終了メッセージとランキング関連のDOM要素
const quizEndMessageArea = document.getElementById("quiz-end-message-area");
const finalMessageElement = document.getElementById("final-message");
const rankingArea = document.getElementById("ranking-area");
const rankingList = document.getElementById("ranking-list");
const containerElement = document.querySelector(".container"); // container 要素を取得

//戻るボタンのDOM要素
const returnToStartBtn = document.getElementById("return-to-start-btn");

// --- QR表示 ---
const qrOverlay = document.getElementById("join-qr-overlay");
const qrMount = document.getElementById("join-qr");
const joinUrlEl = document.getElementById("join-url");

// 参加者URL（同じRenderの / でOK）
const joinUrl = `${location.origin}/`;

// 1回だけ生成して使い回す
let joinQr = null;

function ensureJoinQr() {
  if (!qrMount) return;
  if (!joinQr) {
    joinUrlEl && (joinUrlEl.textContent = joinUrl);
    joinQr = new QRCode(qrMount, {
      text: joinUrl,
      width: 180,
      height: 180,
      correctLevel: QRCode.CorrectLevel.M,
    });
  }
}

function setJoinQrVisible(visible) {
  if (!qrOverlay) return;
  if (visible) ensureJoinQr();
  qrOverlay.style.display = visible ? "block" : "none";
}
setJoinQrVisible(true);
let currentQuestionId = null;
let countdownInterval = null;
let quizPhase = "waiting"; // 'waiting', 'question', 'timeup', 'results', 'ended'

socket.on("connect", () => {
  console.log("controllerConnectイベントを送信しようとしています。");
  setText(displayStatusElement, "サーバーに接続済み (コントローラー)");
  console.log("Display connected to server - socket ID:", socket.id);
  socket.emit("controllerConnect");
  console.log("controllerConnectイベントを送信しました。");
});

socket.on("disconnect", () => {
  // 制御ボタンも無効化
  startQuizBtnDisplay.disabled = true;
  showResultsBtnDisplay.style.display = "none";
  nextQuestionBtnDisplay.disabled = true;
  endQuizBtnDisplay.disabled = true;
});

// クイズ開始イベント
socket.on("quizStarted", () => {
  // displayStatusElement はCSSで非表示になる
  // displayStatusElement.textContent = 'クイズ開始！';
  setJoinQrVisible(false);

  // クイズ開始時はquiz-ended-layoutを削除し、終了メッセージエリアを非表示
  containerElement.classList.remove("quiz-ended-layout");
  quizEndMessageArea.style.display = "none";
  rankingArea.style.display = "none";
  returnToStartBtn.style.display = "none";

  optionsContainer.classList.add("during-question");
  optionsContainer.classList.remove("showing-results");
  quizPhase = "question";
  showResultsBtnDisplay.style.display = "none";
});

// サーバーから問題データが送られてきた時
socket.on("question", (questionData) => {
  setJoinQrVisible(false);
  currentQuestionId = questionData.id;
  resetResultsUI();
  // 問題文
  questionTextElement.textContent = questionData.text;

  // 選択肢（画像 or テキスト）表示
  renderOptions(questionData.options);
  containerElement.classList.remove("quiz-ended-layout");
  quizEndMessageArea.style.display = "none";
  rankingArea.style.display = "none";
  returnToStartBtn.style.display = "none";

  optionsContainer.classList.add("during-question");
  optionsContainer.classList.remove("showing-results");
  quizPhase = "question";
  showResultsBtnDisplay.style.display = "none";
});

socket.on("showCorrectAnswer", (data) => {
  showCorrectAnswer(data.correctOptionId);
});

// サーバーからカウントダウン情報を受信
socket.on("countdown", (remainingTime) => {
  countdownElement.textContent = remainingTime;

  if (remainingTime <= 3 && remainingTime > 0) {
    countdownElement.style.color = "red";
    return;
  }

  if (remainingTime === 0) {
    countdownElement.textContent = 0;
    countdownElement.style.color = "orange";

    if (quizPhase === "question") {
      quizPhase = "waitingResult";
      showResultsBtnDisplay.style.display = "inline-block"; // 結果表示だけ許可
      nextQuestionBtnDisplay.style.display = "none";
    }
    return;
  }

  countdownElement.style.color = "#ffda6a";
});

// サーバーから結果表示データを受信
socket.on("showQuestionResults", (results) => {
  // IDは文字列で比較（型ズレ対策）
  if (String(results.questionId) !== String(currentQuestionId)) return;

  // 結果フェーズへ
  quizPhase = "results";

  // 正解・不正解を色分け（カードに付与）
  document.querySelectorAll("#options .option").forEach((card) => {
    const id = card.dataset.id;

    card.classList.remove("correct", "incorrect");

    if (id === results.correctOptionId) {
      card.classList.add("correct");
    } else {
      card.classList.add("incorrect");
    }

    // 得票表示（option-text の下に票数を足す）
    const votes =
      results.optionVotes && results.optionVotes[id]
        ? results.optionVotes[id]
        : 0;

    // 票数表示用の要素を確保
    let voteEl = card.querySelector(".vote-count-display");
    if (!voteEl) {
      voteEl = document.createElement("div");
      voteEl.className = "vote-count-display";
      card.appendChild(voteEl);
    }
    voteEl.textContent = `${votes}票`;
  });

  // ボタン切り替え
  showResultsBtnDisplay.style.display = "none";
  nextQuestionBtnDisplay.disabled = false;
  nextQuestionBtnDisplay.style.display = "inline-block";
});

// クイズ終了イベント
socket.on("quizEnded", (data) => {
  finalMessageElement.textContent = data.message || "終了";
  countdownElement.textContent = "";
  countdownElement.style.color = "white";

  optionsContainer.classList.remove("during-question", "showing-results");
  showResultsBtnDisplay.style.display = "none";
  quizPhase = "ended";
  startQuizBtnDisplay.disabled = true;
  nextQuestionBtnDisplay.disabled = true;
  endQuizBtnDisplay.disabled = true;

  //クイズ終了時は quiz-ended-layout を追加し、終了メッセージエリアを表示
  containerElement.classList.add("quiz-ended-layout");
  quizEndMessageArea.style.display = "flex"; // JSで明示的にflexにする

  if (data.finalRanking) {
    renderRanking(data.finalRanking);
    rankingArea.style.display = "block"; // ランキングエリアを表示
  } else {
    rankingArea.style.display = "none"; // ランキングデータがなければ非表示
  }

  returnToStartBtn.style.display = "inline-block";
});

socket.on("resetToStart", () => {
  console.log("[display] resetToStart received");

  containerElement.classList.remove("quiz-ended-layout");

  quizEndMessageArea.style.display = "none";
  rankingArea.style.display = "none";
  returnToStartBtn.style.display = "none";

  ensureOptionCards();

  // 初期表示
  questionTextElement.textContent = "問題が表示されます";

  renderOptions([
    { id: "A", text: " " },
    { id: "B", text: " " },
    { id: "C", text: " " },
    { id: "D", text: " " },
  ]);

  resetResultsUI();

  optionsContainer.classList.add("during-question");
  optionsContainer.classList.remove("showing-results");

  showResultsBtnDisplay.style.display = "none";
  nextQuestionBtnDisplay.style.display = "none";

  countdownElement.textContent = "10";
  countdownElement.style.color = "#ffda6a";
  setJoinQrVisible(true);
});

//ランキングを描画する関数
function renderRanking(ranking) {
  rankingList.innerHTML = ""; // リストをクリア
  if (ranking.length === 0) {
    rankingList.innerHTML = "<li>ランキングデータがありません。</li>";
    return;
  }
  ranking.forEach((entry, index) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${index + 1}位: ${
      entry.nickname || "匿名"
    }</span> <span>${entry.score}問正解</span>`;
    rankingList.appendChild(li);
  });
}

//戻るボタンのイベントリスナー
returnToStartBtn.onclick = () => {
  if (!confirm("開始画面に戻りますか？現在のクイズ状態はリセットされます。"))
    return;
  socket.emit("hostCommand", { type: "returnToStart" });
  console.log("開始画面に戻るコマンドを送信しました。");
};

//クイズステータスの更新を受信 (自身のボタン有効/無効化と表示)
socket.on("quizStatus", (status) => {
  console.log("--- quizStatus イベント受信 ---");
  console.log("受信したステータスデータ:", status);
  setJoinQrVisible(!status.isActive);

  if (status.isActive) {
    if (status.remainingTime <= 0) {
      // 時間切れ → 結果表示できる状態
      if (quizPhase !== "results") quizPhase = "timeup";
    } else {
      // まだ出題中
      if (quizPhase !== "results") quizPhase = "question";
    }
  }

  // ボタンの有効/無効化
  if (status.isController) {
    // <-- サーバーから送られてくる isController フラグをチェック
    console.log(
      "[display.js-quizStatus] サーバーからコントローラーとして認識されました。"
    ); // <-- このログが出るか？
    setText(displayStatusElement, "サーバーに接続済み (コントローラー)");
    if (status.isActive) {
      console.log("[display.js-quizStatus] クイズ進行中。");
      startQuizBtnDisplay.disabled = true;
      endQuizBtnDisplay.disabled = false;

      // quizPhase に基づいてボタン制御を調整
      if (quizPhase === "question" || quizPhase === "waiting") {
        // 回答受付中、または開始直後
        showResultsBtnDisplay.style.display = "none";
        nextQuestionBtnDisplay.disabled = true; // 回答中は無効
      } else if (quizPhase === "timeup") {
        showResultsBtnDisplay.style.display = "inline-block";
        endQuizBtnDisplay.style.display = "inline-block";
        nextQuestionBtnDisplay.style.display = "none";
      } else if (quizPhase === "results") {
        // 結果表示中
        showResultsBtnDisplay.style.display = "none"; // 結果表示ボタンは非表示
        nextQuestionBtnDisplay.disabled =
          status.currentQuestionIndex >= status.totalQuestions - 1; // 最終問題なら無効
      } else if (quizPhase === "ended") {
        // クイズ終了後
        showResultsBtnDisplay.style.display = "none";
        nextQuestionBtnDisplay.disabled = true;
        startQuizBtnDisplay.disabled = true; // クイズ終了後は開始ボタンも無効
        endQuizBtnDisplay.disabled = true;
      }
    } else {
      // クイズが停止中の場合
      console.log("[display.js-quizStatus] クイズ停止中。");
      startQuizBtnDisplay.disabled = status.totalQuestions === 0; // 問題がなければ開始ボタンも無効
      nextQuestionBtnDisplay.disabled = true;
      endQuizBtnDisplay.disabled = true;
      showResultsBtnDisplay.style.display = "none";
      quizPhase = "waiting";
    }

    if (!socket.sentControllerConnect) {
      // 重複送信防止
      socket.emit("controllerConnect");
      console.log(
        "controllerConnectイベントを送信しました (quizStatus受信後)。"
      );
      socket.sentControllerConnect = true; // フラグを設定
    }
  } else {
    // サーバーがまだこのソケットをコントローラーと認識していない場合
    console.log(
      "[display.js-quizStatus] サーバーの応答を待機中... (isController: false)"
    ); // <-- このログが出るか？
    setText(
      displayStatusElement,
      "サーバーの応答を待機中... (コントローラー認証中)"
    );
    startQuizBtnDisplay.disabled = true;
    showResultsBtnDisplay.style.display = "none";
    nextQuestionBtnDisplay.disabled = true;
    endQuizBtnDisplay.disabled = true;
  }
});

// クイズ制御ボタンのイベントリスナー
onClick(startQuizBtnDisplay, () => {
  console.log(
    "[display] start clicked. disabled=",
    startQuizBtnDisplay?.disabled
  );
  if (startQuizBtnDisplay?.disabled) return;
  socket.emit("hostCommand", { type: "startQuiz" });
});
onClick(showResultsBtnDisplay, () => {
  socket.emit("hostCommand", { type: "showResults" });
  quizPhase = "results";

  showResultsBtnDisplay.style.display = "none";
  nextQuestionBtnDisplay.style.display = "inline-block";
});
onClick(nextQuestionBtnDisplay, () => {
  socket.emit("hostCommand", { type: "nextQuestion" });
  quizPhase = "question";

  nextQuestionBtnDisplay.style.display = "none";
  showResultsBtnDisplay.style.display = "none";
});
onClick(endQuizBtnDisplay, () => {
  socket.emit("hostCommand", { type: "endQuiz" });
});

function renderOptions(options) {
  // options例: [{ id:"A", text:"...", imageUrl:"..." }, ...]
  document.querySelectorAll("#options .option").forEach((card) => {
    const id = card.dataset.id;
    const opt = options.find((o) => o.id === id);

    const img = card.querySelector(".option-image");
    const text = card.querySelector(".option-text");

    // まず毎回リセット（結果色・表示など）
    card.classList.remove(
      "has-image",
      "has-text",
      "correct",
      "incorrect",
      "correct-answer",
      "incorrect-answer"
    );

    // 票表示（前回の残骸）があれば消す
    card.querySelectorAll(".vote-count-display").forEach((el) => el.remove());

    // 画像・テキスト初期化
    if (img) {
      img.removeAttribute("src");
      img.alt = "";
      img.style.display = ""; // CSSに任せる
    }
    if (text) {
      text.textContent = "";
    }

    if (!opt) return;

    // 画像があれば画像優先
    if (opt.imageUrl && opt.imageUrl.trim() !== "") {
      img.src = opt.imageUrl;
      img.alt = opt.text ? `${id}：${opt.text}` : `${id}の画像`;
      card.classList.add("has-image");
    } else {
      text.textContent = opt.text || "";
      card.classList.add("has-text");
    }
  });
}

function showCorrectAnswer(correctOptionId) {
  document.querySelectorAll("#options .option").forEach((card) => {
    const id = card.dataset.id;

    card.classList.remove("correct", "incorrect");

    if (id === correctOptionId) {
      card.classList.add("correct");
    } else {
      card.classList.add("incorrect");
    }
  });
}

function resetResultsUI() {
  // 結果表示（バー版）をリセット
  document.querySelectorAll(".result-bar-container").forEach((c) => {
    c.classList.remove("correct-answer", "incorrect-answer");
    c.classList.add("hide-results-elements");

    const fill = c.querySelector(".result-bar-fill");
    if (fill) {
      fill.style.width = "0%";
      fill.style.display = "none";
      fill.textContent = "";
    }

    const vote = c.querySelector(".vote-count");
    if (vote) {
      vote.textContent = "0票";
      vote.style.display = "none";
    }
  });

  // 画像/ラベル版（showCorrectAnswerで付くやつ）も消す
  document.querySelectorAll("#options .option").forEach((card) => {
    card.classList.remove("correct", "incorrect");
  });

  // card方式で追加した「〇票」表示を削除
  document.querySelectorAll(".vote-count-display").forEach((el) => el.remove());
}

function ensureOptionCards() {
  const existing = document.querySelectorAll("#options .option");
  if (existing.length === 4) return;

  optionsContainer.innerHTML = `
    <div class="option" data-id="A">
      <div class="option-label">A</div>
      <img class="option-image" alt="" />
      <div class="option-text"></div>
    </div>
    <div class="option" data-id="B">
      <div class="option-label">B</div>
      <img class="option-image" alt="" />
      <div class="option-text"></div>
    </div>
    <div class="option" data-id="C">
      <div class="option-label">C</div>
      <img class="option-image" alt="" />
      <div class="option-text"></div>
    </div>
    <div class="option" data-id="D">
      <div class="option-label">D</div>
      <img class="option-image" alt="" />
      <div class="option-text"></div>
    </div>
  `;
}
