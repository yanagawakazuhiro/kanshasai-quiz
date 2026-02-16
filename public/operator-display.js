// 運用者用表示画面JavaScript
// コンソールエラーを抑制（広告ブロッカーによるブロックを無視）
(function() {
  const originalError = console.error;
  console.error = function(...args) {
    // YouTubeのログイベントエラーは無視
    if (args.some(arg => 
      typeof arg === 'string' && 
      (arg.includes('ERR_BLOCKED_BY_CLIENT') || 
       arg.includes('youtube.com/youtubei/v1/log') ||
       arg.includes('net::ERR_BLOCKED_BY_CLIENT'))
    )) {
      return; // エラーを表示しない
    }
    originalError.apply(console, args);
  };
})();

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
    bgmUrl = statusData.bgmUrl || null; // BGM URLを取得
    console.log("[init] BGM URLを取得しました:", bgmUrl);
    
    // 参加用URLを更新（roomIdを含める）
    const joinUrl = `${location.origin}/?roomId=${currentRoomId}`;
    const joinUrlEl = document.getElementById("join-url");
    if (joinUrlEl) {
      joinUrlEl.textContent = joinUrl;
    }

    // クイズ開始前画面の初期化
    initializePreQuizScreen(joinUrl);

    // Socket.IO接続（roomIdを指定、ADMIN_KEYは使用しない）
    socket = io({
      query: { roomId: currentRoomId },
      auth: { roomId: currentRoomId },
    });

    setupSocketHandlers();
    setupEventListeners();
  } catch (error) {
    console.error("初期化エラー:", error);
    window.location.href = "/operator-login.html";
  }
})();

const displayStatusElement = document.getElementById("display-status");
const countdownElement = document.getElementById("countdown");
const questionTextElement = document.getElementById("question-text");
const optionsContainer = document.getElementById("options");

//クイズ制御ボタンとステータス表示のDOM要素取得
const startQuizBtnDisplay = document.getElementById("startQuizBtnDisplay");
const showResultsBtnDisplay = document.getElementById("showResultsBtnDisplay");
const nextQuestionBtnDisplay = document.getElementById("nextQuestionBtnDisplay");
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
if (startQuizBtnDisplay) {
  startQuizBtnDisplay.disabled = true;
}
if (showResultsBtnDisplay) {
  showResultsBtnDisplay.style.display = "none";
}
if (nextQuestionBtnDisplay) {
  nextQuestionBtnDisplay.style.display = "none";
  nextQuestionBtnDisplay.disabled = true;
}
if (endQuizBtnDisplay) {
  endQuizBtnDisplay.disabled = true;
}

//クイズ終了メッセージとランキング関連のDOM要素
const quizEndMessageArea = document.getElementById("quiz-end-message-area");
const finalMessageElement = document.getElementById("final-message");
const rankingArea = document.getElementById("ranking-area");
const rankingList = document.getElementById("ranking-list");
const containerElement = document.querySelector(".container");

//戻るボタンのDOM要素
const returnToStartBtn = document.getElementById("return-to-start-btn");

const qrBadge = document.getElementById("join-qr-badge");
const preQuizScreen = document.getElementById("pre-quiz-screen");
const quizContainer = document.getElementById("quiz-container");
const skipVideoBtn = document.getElementById("skip-video-btn");
const replayVideoBtn = document.getElementById("replay-video-btn");

let currentQuestionId = null;
let countdownInterval = null;
let quizPhase = "waiting";
let videoPlayed = false; // 動画が再生済みかどうか
let youtubePlayer = null; // YouTubeプレーヤーインスタンス
let bgmAudio = null; // BGM用のAudio要素
let bgmUrl = null; // BGMのURL

// クイズ開始前画面の初期化
function initializePreQuizScreen(joinUrl) {
  // QRコード画像のURLを生成（QRコード生成APIを使用）
  // 例: https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=URL
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(joinUrl)}`;
  const qrCodeImg = document.getElementById("qr-code-img");
  if (qrCodeImg) {
    qrCodeImg.src = qrCodeUrl;
  }

  // 参加URLを表示
  const joinUrlDisplay = document.getElementById("join-url-display");
  if (joinUrlDisplay) {
    joinUrlDisplay.textContent = joinUrl;
  }

  // YouTube動画URLを設定
  // デフォルト: https://youtu.be/1yJy6PhxEQE?si=X0lqKaTXGLlpmSAj
  const videoUrl = localStorage.getItem(`videoUrl_${currentRoomId}`) || 
                   "https://youtu.be/1yJy6PhxEQE?si=X0lqKaTXGLlpmSAj";
  
  console.log("動画URL:", videoUrl);
  
  // YouTube URLから動画IDを抽出
  const videoId = extractYouTubeVideoId(videoUrl);
  console.log("抽出された動画ID:", videoId);
  
  // YouTube IFrame APIの読み込みを待つ関数
  function waitForYouTubeAPI() {
    console.log("YouTube APIの状態を確認中...", {
      YT: typeof YT,
      YTPlayer: typeof YT !== 'undefined' ? typeof YT.Player : 'undefined',
      readyState: document.readyState
    });
    
    if (typeof YT !== 'undefined' && YT.Player) {
      console.log("YouTube APIは既に読み込まれています");
      // DOMが完全に準備されるまで待つ
      setTimeout(() => {
        console.log("YouTubeプレーヤーの初期化を開始します");
        initializeYouTubePlayer(videoId);
      }, 1000);
    } else {
      console.log("YouTube APIの読み込みを待機中...");
      // 既存のコールバックを保存
      const existingCallback = window.onYouTubeIframeAPIReady;
      
      // YouTube IFrame APIがまだ読み込まれていない場合、読み込みを待つ
      window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube APIが読み込まれました（コールバック実行）");
        if (existingCallback) {
          existingCallback();
        }
        // DOMが完全に準備されるまで待つ
        setTimeout(() => {
          console.log("YouTubeプレーヤーの初期化を開始します（コールバック経由）");
          initializeYouTubePlayer(videoId);
        }, 1000);
      };
      
      // ポーリングでAPIの読み込みを確認（フォールバック）
      let pollCount = 0;
      const pollInterval = setInterval(() => {
        pollCount++;
        if (typeof YT !== 'undefined' && YT.Player) {
          console.log("YouTube APIが読み込まれました（ポーリング検出）");
          clearInterval(pollInterval);
          setTimeout(() => {
            initializeYouTubePlayer(videoId);
          }, 1000);
        } else if (pollCount >= 20) {
          console.error("YouTube APIの読み込みがタイムアウトしました（20秒）");
          clearInterval(pollInterval);
          if (skipVideoBtn) {
            skipVideoBtn.style.display = "inline-block";
          }
        }
      }, 1000);
    }
  }
  
  // ページが完全に読み込まれた後に実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForYouTubeAPI);
  } else {
    waitForYouTubeAPI();
  }

  // スキップボタンの処理
  if (skipVideoBtn) {
    skipVideoBtn.addEventListener("click", () => {
      videoPlayed = true;
      showQuizScreen();
    });
  }

  // 再生し直すボタンの処理
  if (replayVideoBtn) {
    replayVideoBtn.addEventListener("click", () => {
      if (youtubePlayer) {
        youtubePlayer.seekTo(0);
        youtubePlayer.playVideo();
        replayVideoBtn.style.display = "none";
      }
    });
  }
}

// クイズ画面を表示
function showQuizScreen() {
  // 動画を停止する
  if (youtubePlayer) {
    try {
      youtubePlayer.stopVideo();
    } catch (e) {
      console.warn("動画の停止に失敗:", e);
    }
  }
  
  if (preQuizScreen) {
    preQuizScreen.classList.add("hidden");
  }
  if (quizContainer) {
    quizContainer.style.display = "block";
  }
  // クイズ画面が表示されたら、既存のQRコードバッジも表示（クイズ中は非表示になる）
  if (qrBadge) {
    qrBadge.style.display = "block";
  }
}

// YouTube URLから動画IDを抽出
function extractYouTubeVideoId(url) {
  if (!url) return null;
  
  console.log("URLから動画IDを抽出中:", url);
  
  // 様々なYouTube URL形式に対応
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      const videoId = match[1];
      console.log("動画IDを抽出しました:", videoId);
      return videoId;
    }
  }
  
  console.error("動画IDの抽出に失敗しました");
  return null;
}

// YouTubeプレーヤーを初期化
function initializeYouTubePlayer(videoId) {
  if (!videoId) {
    console.error("YouTube動画IDが取得できませんでした");
    if (skipVideoBtn) {
      skipVideoBtn.style.display = "inline-block";
    }
    return;
  }

  const playerElement = document.getElementById('youtube-player');
  if (!playerElement) {
    console.error("YouTubeプレーヤー要素が見つかりません");
    return;
  }

  console.log("YouTubeプレーヤーを初期化中...", videoId);

  // 既存のプレーヤーがあれば破棄
  if (youtubePlayer && youtubePlayer.destroy) {
    try {
      youtubePlayer.destroy();
    } catch (e) {
      console.warn("既存のプレーヤーの破棄に失敗:", e);
    }
  }

  try {
    // プレーヤーコンテナのサイズを取得
    const container = document.getElementById('youtube-player-container');
    const containerWidth = container ? container.offsetWidth || 800 : 800;
    const containerHeight = Math.floor(containerWidth * 9 / 16); // 16:9アスペクト比
    
    console.log("プレーヤーサイズ:", containerWidth, "x", containerHeight);
    
    youtubePlayer = new YT.Player('youtube-player', {
      videoId: videoId,
      width: containerWidth,
      height: containerHeight,
      playerVars: {
        'autoplay': 0, // 自動再生を無効化（手動再生）
        'controls': 1,
        'rel': 0, // 関連動画を非表示
        'modestbranding': 1,
        'playsinline': 1,
        'enablejsapi': 1,
        'origin': window.location.origin // セキュリティのため
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange,
        'onError': onPlayerError
      }
    });
    console.log("YouTubeプレーヤーインスタンスを作成しました");
    
    // プレーヤーの作成を確認（少し遅延を入れる）
    setTimeout(() => {
      if (youtubePlayer && youtubePlayer.getVideoUrl) {
        try {
          const url = youtubePlayer.getVideoUrl();
          console.log("プレーヤーのURL確認:", url ? "成功" : "失敗");
        } catch (e) {
          console.warn("プレーヤーのURL取得に失敗（まだ準備中かもしれません）:", e);
        }
      }
    }, 1000);
  } catch (error) {
    console.error("YouTubeプレーヤーの初期化エラー:", error);
    if (skipVideoBtn) {
      skipVideoBtn.style.display = "inline-block";
    }
  }
}

// YouTubeプレーヤーが準備完了
function onPlayerReady(event) {
  console.log("YouTubeプレーヤーが準備完了しました");
  // スキップボタンを表示
  if (skipVideoBtn) {
    skipVideoBtn.style.display = "inline-block";
  }
  
  // 動画が表示されているか確認（複数回確認）
  let checkCount = 0;
  const maxChecks = 10; // 最大10回（5秒間）確認
  
  const checkInterval = setInterval(() => {
    checkCount++;
    const playerElement = document.getElementById('youtube-player');
    if (playerElement) {
      // YouTubeプレーヤーは内部でiframeを作成するが、直接確認できない場合がある
      // 代わりに、プレーヤーの状態を確認
      if (youtubePlayer && youtubePlayer.getVideoUrl) {
        try {
          const videoUrl = youtubePlayer.getVideoUrl();
          if (videoUrl) {
            console.log("YouTube動画が正常に読み込まれました:", videoUrl);
            clearInterval(checkInterval);
            return;
          }
        } catch (e) {
          // エラーは無視（まだ準備中）
        }
      }
      
      // iframeを直接確認
      const iframe = playerElement.querySelector('iframe');
      if (iframe && iframe.src) {
        console.log("YouTube iframeが確認できました:", iframe.src);
        clearInterval(checkInterval);
        return;
      }
    }
    
    if (checkCount >= maxChecks) {
      console.warn("YouTube動画の確認がタイムアウトしました。動画は表示されている可能性があります。");
      clearInterval(checkInterval);
    }
  }, 500);
  
  // 自動再生は行わない（ユーザーが再生ボタンをクリックするまで待つ）
  console.log("動画の準備が完了しました。再生ボタンをクリックして再生してください。");
}

// YouTubeプレーヤーの状態変更
function onPlayerStateChange(event) {
  const stateNames = {
    0: 'ENDED',
    1: 'PLAYING',
    2: 'PAUSED',
    3: 'BUFFERING',
    5: 'CUED'
  };
  const stateName = stateNames[event.data] || `UNKNOWN(${event.data})`;
  console.log(`YouTubeプレーヤー状態: ${stateName}`);
  
  // YT.PlayerState.ENDED = 0
  if (event.data === YT.PlayerState.ENDED) {
    console.log("動画が終了しました");
    videoPlayed = true;
    showQuizScreen();
  }
  // YT.PlayerState.PLAYING = 1
  else if (event.data === YT.PlayerState.PLAYING) {
    console.log("動画が再生中です");
  }
  // YT.PlayerState.BUFFERING = 3
  else if (event.data === YT.PlayerState.BUFFERING) {
    console.log("動画をバッファリング中です");
  }
  // YT.PlayerState.CUED = 5
  else if (event.data === YT.PlayerState.CUED) {
    console.log("動画が準備完了しました（再生待ち）");
  }
}

// YouTubeプレーヤーエラー
function onPlayerError(event) {
  const errorMessages = {
    2: "動画IDが無効です",
    5: "HTML5プレーヤーエラー",
    100: "動画が見つかりません",
    101: "埋め込み再生が許可されていません",
    150: "埋め込み再生が許可されていません"
  };
  
  const errorMessage = errorMessages[event.data] || `エラーコード: ${event.data}`;
  console.warn("YouTubeプレーヤーエラー:", errorMessage);
  
  // エラー時はスキップボタンを表示
  if (skipVideoBtn) {
    skipVideoBtn.style.display = "inline-block";
  }
}

// クイズ開始前画面に戻る
function resetToPreQuizScreen() {
  if (preQuizScreen) {
    preQuizScreen.classList.remove("hidden");
  }
  if (quizContainer) {
    quizContainer.style.display = "none";
  }
  if (qrBadge) {
    qrBadge.style.display = "none";
  }
  // 動画を停止して最初に戻す（自動再生しない）
  if (youtubePlayer) {
    try {
      youtubePlayer.stopVideo();
      youtubePlayer.seekTo(0);
      // 確実に停止状態にする
      youtubePlayer.pauseVideo();
    } catch (e) {
      console.warn("動画の停止に失敗:", e);
    }
    // 再生ボタンを表示（自動再生しない）
    if (replayVideoBtn) {
      replayVideoBtn.style.display = "inline-block";
    }
    if (skipVideoBtn) {
      skipVideoBtn.style.display = "inline-block";
    }
  }
  // 動画再生済みフラグをリセットしない（一度再生したら、次回は手動再生）
  videoPlayed = false; // フラグをリセットして、次回も手動再生にする
}

function setupSocketHandlers() {
  socket.on("quizStatus", (status) => {
    if (!qrBadge) return;

    qrBadge.classList.toggle("is-hidden", status.isActive);
    qrBadge.classList.toggle("is-running", status.isActive);
    qrBadge.classList.toggle("is-finished", !status.isActive);
  });

  socket.on("connect", () => {
    console.log("controllerConnectイベントを送信しようとしています。");
    setText(displayStatusElement, "サーバーに接続済み (コントローラー)");
    console.log("Display connected to server - socket ID:", socket.id);
    socket.emit("controllerConnect");
    console.log("controllerConnectイベントを送信しました。");
  });

  socket.on("disconnect", () => {
    startQuizBtnDisplay.disabled = true;
    showResultsBtnDisplay.style.display = "none";
    nextQuestionBtnDisplay.disabled = true;
    endQuizBtnDisplay.disabled = true;
  });

  // BGM再生関数
  function startBgm() {
    console.log("[BGM] startBgm called, bgmUrl:", bgmUrl, "bgmAudio:", bgmAudio);
    if (!bgmUrl) {
      console.log("[BGM] BGM URLがありません");
      return;
    }
    if (bgmAudio) {
      console.log("[BGM] 既にBGMが再生中です");
      return;
    }
    
    console.log("[BGM] BGMを再生開始します, URL:", bgmUrl);
    bgmAudio = new Audio(bgmUrl);
    bgmAudio.loop = true; // ループ再生
    bgmAudio.volume = 0.5; // 音量を50%に設定（必要に応じて調整）
    
    bgmAudio.play().then(() => {
      console.log("[BGM] BGMの再生に成功しました");
    }).catch((error) => {
      console.error("[BGM] BGM再生エラー:", error);
      // 自動再生がブロックされた場合など
    });
  }
  
  // BGM停止関数
  function stopBgm() {
    if (bgmAudio) {
      bgmAudio.pause();
      bgmAudio.currentTime = 0;
      bgmAudio = null;
      console.log("BGMを停止しました");
    }
  }

  // クイズ開始イベント
  socket.on("quizStarted", () => {
    containerElement.classList.remove("quiz-ended-layout");
    quizEndMessageArea.style.display = "none";
    rankingArea.style.display = "none";
    returnToStartBtn.style.display = "none";

    optionsContainer.classList.add("during-question");
    optionsContainer.classList.remove("showing-results");
    quizPhase = "question";
    showResultsBtnDisplay.style.display = "none";
    
    // BGMを再生開始
    startBgm();
  });

  // サーバーから問題データが送られてきた時
  socket.on("question", (questionData) => {
    currentQuestionId = questionData.id;
    resetResultsUI();
    questionTextElement.textContent = questionData.text;
    const hasVideo = renderOptions(questionData.options);
    containerElement.classList.remove("quiz-ended-layout");
    quizEndMessageArea.style.display = "none";
    rankingArea.style.display = "none";
    returnToStartBtn.style.display = "none";

    optionsContainer.classList.add("during-question");
    optionsContainer.classList.remove("showing-results");
    quizPhase = "question";
    
    // 動画がある場合はカウントダウンを非表示にして、結果表示ボタンを最初から表示
    if (hasVideo) {
      if (countdownElement) {
        countdownElement.style.display = "none";
      }
      showResultsBtnDisplay.style.display = "inline-block";
      quizPhase = "waitingResult";
      console.log("[question] 動画があるため、カウントダウンを非表示にして結果表示ボタンを表示");
    } else {
      if (countdownElement) {
        countdownElement.style.display = "";
      }
      showResultsBtnDisplay.style.display = "none";
      console.log("[question] 動画がないため、通常のカウントダウンを表示");
    }
  });

  socket.on("showCorrectAnswer", (data) => {
    showCorrectAnswer(data.correctOptionId);
  });

  // サーバーからカウントダウン情報を受信
  socket.on("countdown", (remainingTime) => {
    // 動画がある場合はカウントダウンを無視
    const hasVideoInCurrentQuestion = document.querySelectorAll("#options .option.has-video").length > 0;
    if (hasVideoInCurrentQuestion) {
      console.log("[countdown] 動画があるため、カウントダウンを無視");
      return;
    }
    
    if (countdownElement) {
      countdownElement.textContent = remainingTime;
    }

    if (remainingTime <= 3 && remainingTime > 0) {
      if (countdownElement) {
        countdownElement.style.color = "red";
      }
      return;
    }

    if (remainingTime === 0) {
      if (countdownElement) {
        countdownElement.textContent = 0;
        countdownElement.style.color = "orange";
      }

      if (quizPhase === "question") {
        quizPhase = "waitingResult";
        showResultsBtnDisplay.style.display = "inline-block";
        nextQuestionBtnDisplay.style.display = "none";
      }
      return;
    }

    if (countdownElement) {
      countdownElement.style.color = "#ffda6a";
    }
  });

  // サーバーから結果表示データを受信
  socket.on("showQuestionResults", (results) => {
    console.log("[showQuestionResults] イベントを受信しました");
    console.log("[showQuestionResults] 受信したresults:", results);
    console.log("[showQuestionResults] currentQuestionId:", currentQuestionId);
    console.log("[showQuestionResults] results.questionId:", results.questionId);
    
    if (String(results.questionId) !== String(currentQuestionId)) {
      console.log("[showQuestionResults] 問題IDが一致しないため、処理をスキップします");
      return;
    }

    console.log("[showQuestionResults] 結果を表示します");
    quizPhase = "results";

    document.querySelectorAll("#options .option").forEach((card) => {
      const id = card.dataset.id;

      card.classList.remove("correct", "incorrect");

      if (id === results.correctOptionId) {
        card.classList.add("correct");
      } else {
        card.classList.add("incorrect");
      }

      const votes =
        results.optionVotes && results.optionVotes[id]
          ? results.optionVotes[id]
          : 0;

      let voteEl = card.querySelector(".vote-count-display");
      if (!voteEl) {
        voteEl = document.createElement("div");
        voteEl.className = "vote-count-display";
        card.appendChild(voteEl);
      }
      voteEl.textContent = `${votes}票`;
    });

    showResultsBtnDisplay.style.display = "none";
    nextQuestionBtnDisplay.disabled = false;
    nextQuestionBtnDisplay.style.display = "inline-block";
  });

  // クイズ終了イベント
  socket.on("quizEnded", (data) => {
    console.log("[quizEnded] クイズ終了イベントを受信しました, data:", data);
    finalMessageElement.textContent = data.message || "終了";
    countdownElement.textContent = "";
    countdownElement.style.color = "white";

    optionsContainer.classList.remove("during-question", "showing-results");
    showResultsBtnDisplay.style.display = "none";
    quizPhase = "ended";
    startQuizBtnDisplay.disabled = true;
    nextQuestionBtnDisplay.disabled = true;
    endQuizBtnDisplay.disabled = true;

    containerElement.classList.add("quiz-ended-layout");
    quizEndMessageArea.style.display = "flex";
    
    // BGMを停止
    stopBgm();

    console.log("[quizEnded] finalRanking:", data.finalRanking);
    if (data.finalRanking && data.finalRanking.length > 0) {
      console.log("[quizEnded] ランキングを表示します");
      renderRanking(data.finalRanking);
      rankingArea.style.display = "block";
    } else {
      console.log("[quizEnded] ランキングデータがありません（参加者がいない可能性があります）");
      // 参加者がいない場合でも、ランキングエリアを表示してメッセージを表示
      rankingList.innerHTML = "<li>参加者がいませんでした。</li>";
      rankingArea.style.display = "block";
    }

    returnToStartBtn.style.display = "inline-block";
  });

  socket.on("resetToStart", () => {
    console.log("[display] resetToStart received");

    // 動画画面に戻る
    resetToPreQuizScreen();

    containerElement.classList.remove("quiz-ended-layout");
    quizEndMessageArea.style.display = "none";
    rankingArea.style.display = "none";
    returnToStartBtn.style.display = "none";

    ensureOptionCards();
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
    nextQuestionBtnDisplay.disabled = true;

    if (countdownElement) {
      countdownElement.textContent = "--";
      countdownElement.style.color = "#ffda6a";
    }
  });

  //クイズステータスの更新を受信
  socket.on("quizStatus", (status) => {
    console.log("--- quizStatus イベント受信 ---");
    console.log("受信したステータスデータ:", status);

    if (status.isActive) {
      if (status.remainingTime <= 0) {
        if (quizPhase !== "results") quizPhase = "timeup";
      } else {
        if (quizPhase !== "results") quizPhase = "question";
      }
    }

    if (status.isController) {
      console.log(
        "[display.js-quizStatus] サーバーからコントローラーとして認識されました。"
      );
      setText(displayStatusElement, "サーバーに接続済み (コントローラー)");
      if (status.isActive) {
        console.log("[display.js-quizStatus] クイズ進行中。");
        startQuizBtnDisplay.disabled = true;
        endQuizBtnDisplay.disabled = false;

        if (quizPhase === "question" || quizPhase === "waiting") {
          // 動画がある場合は結果表示ボタンを表示
          const hasVideoInCurrentQuestion = document.querySelectorAll("#options .option.has-video").length > 0;
          if (hasVideoInCurrentQuestion) {
            showResultsBtnDisplay.style.display = "inline-block";
            quizPhase = "waitingResult";
          } else {
            showResultsBtnDisplay.style.display = "none";
          }
          nextQuestionBtnDisplay.disabled = true;
        } else if (quizPhase === "waitingResult") {
          // 動画がある場合の待機状態
          showResultsBtnDisplay.style.display = "inline-block";
          nextQuestionBtnDisplay.style.display = "none";
        } else if (quizPhase === "timeup") {
          showResultsBtnDisplay.style.display = "inline-block";
          endQuizBtnDisplay.style.display = "inline-block";
          nextQuestionBtnDisplay.style.display = "none";
        } else if (quizPhase === "results") {
          showResultsBtnDisplay.style.display = "none";
          nextQuestionBtnDisplay.disabled =
            status.currentQuestionIndex >= status.totalQuestions - 1;
        } else if (quizPhase === "ended") {
          showResultsBtnDisplay.style.display = "none";
          nextQuestionBtnDisplay.disabled = true;
          startQuizBtnDisplay.disabled = true;
          endQuizBtnDisplay.disabled = true;
        }
      } else {
        console.log("[display.js-quizStatus] クイズ停止中。");
        console.log("問題数:", status.totalQuestions, "isController:", status.isController);
        console.log("statusオブジェクト全体:", JSON.stringify(status, null, 2));
        if (startQuizBtnDisplay) {
          const shouldDisable = status.totalQuestions === 0 || !status.totalQuestions;
          startQuizBtnDisplay.disabled = shouldDisable;
          console.log("クイズ開始ボタンの状態:", shouldDisable ? "無効（問題数が0または未定義）" : "有効", "totalQuestions:", status.totalQuestions);
        }
        if (nextQuestionBtnDisplay) {
          nextQuestionBtnDisplay.disabled = true;
        }
        if (endQuizBtnDisplay) {
          endQuizBtnDisplay.disabled = true;
        }
        if (showResultsBtnDisplay) {
          showResultsBtnDisplay.style.display = "none";
        }
        quizPhase = "waiting";

        if (status.timerDuration !== undefined && countdownElement) {
          if (
            countdownElement.textContent === "--" ||
            countdownElement.textContent === "10"
          ) {
            countdownElement.textContent = status.timerDuration;
            countdownElement.style.color = "#ffda6a";
          }
        }
      }

      if (!socket.sentControllerConnect) {
        socket.emit("controllerConnect");
        console.log(
          "controllerConnectイベントを送信しました (quizStatus受信後)。"
        );
        socket.sentControllerConnect = true;
      }
    } else {
      console.log(
        "[display.js-quizStatus] サーバーの応答を待機中... (isController: false)"
      );
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
}

function setupEventListeners() {
  // クイズ制御ボタンのイベントリスナー
  if (startQuizBtnDisplay) {
    console.log("[setupEventListeners] startQuizBtnDisplay要素を発見しました");
    startQuizBtnDisplay.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log(
        "[display] start clicked. disabled=",
        startQuizBtnDisplay.disabled,
        "element:",
        startQuizBtnDisplay
      );
      if (startQuizBtnDisplay.disabled) {
        console.warn("クイズ開始ボタンが無効化されています");
        return;
      }
      if (!socket || !socket.connected) {
        console.error("Socket.IOが接続されていません");
        return;
      }
      console.log("クイズ開始コマンドを送信します");
      socket.emit("hostCommand", { type: "startQuiz" });
    });
    // デバッグ用：ボタンの状態を定期的に確認
    setInterval(() => {
      if (startQuizBtnDisplay) {
        console.log("[デバッグ] クイズ開始ボタンの状態:", {
          disabled: startQuizBtnDisplay.disabled,
          display: window.getComputedStyle(startQuizBtnDisplay).display,
          visibility: window.getComputedStyle(startQuizBtnDisplay).visibility,
          pointerEvents: window.getComputedStyle(startQuizBtnDisplay).pointerEvents,
          zIndex: window.getComputedStyle(startQuizBtnDisplay).zIndex
        });
      }
    }, 5000);
  } else {
    console.error("startQuizBtnDisplay要素が見つかりません");
  }

  if (showResultsBtnDisplay) {
    showResultsBtnDisplay.addEventListener("click", () => {
      console.log("[showResultsBtnDisplay] 結果表示ボタンがクリックされました");
      console.log("[showResultsBtnDisplay] 現在のquizPhase:", quizPhase);
      console.log("[showResultsBtnDisplay] 現在のcurrentQuestionId:", currentQuestionId);
      socket.emit("hostCommand", { type: "showResults" });
      console.log("[showResultsBtnDisplay] hostCommandを送信しました");
      // サーバーからの応答を待つため、ここではボタンの表示を変更しない
      // showQuestionResultsイベントで処理される
    });
  }

  if (nextQuestionBtnDisplay) {
    nextQuestionBtnDisplay.addEventListener("click", () => {
      socket.emit("hostCommand", { type: "nextQuestion" });
      quizPhase = "question";
      nextQuestionBtnDisplay.style.display = "none";
      showResultsBtnDisplay.style.display = "none";
    });
  }

  if (endQuizBtnDisplay) {
    endQuizBtnDisplay.addEventListener("click", () => {
      socket.emit("hostCommand", { type: "endQuiz" });
    });
  }

  //戻るボタンのイベントリスナー
  returnToStartBtn.onclick = () => {
    if (
      !confirm("開始画面に戻りますか？現在のクイズ状態はリセットされます。")
    )
      return;
    socket.emit("hostCommand", { type: "returnToStart" });
    console.log("開始画面に戻るコマンドを送信しました。");
  };
}

//ランキングを描画する関数
function renderRanking(ranking) {
  rankingList.innerHTML = "";
  if (ranking.length === 0) {
    rankingList.innerHTML = "<li>ランキングデータがありません。</li>";
    return;
  }
  ranking.forEach((entry, index) => {
    const li = document.createElement("li");
    const hasTime = typeof entry.totalAnswerTime === "number";
    const timeText = hasTime ? ` (${entry.totalAnswerTime}秒)` : "";
    li.innerHTML = `<span>${index + 1}位: ${
      entry.nickname || "匿名"
    }</span> <span>${entry.score}問正解${timeText}</span>`;
    rankingList.appendChild(li);
  });
  console.log("ランキングデータ:", ranking);
}

function renderOptions(options) {
  let hasVideo = false; // 動画があるかどうかのフラグ
  
  document.querySelectorAll("#options .option").forEach((card) => {
    const id = card.dataset.id;
    const opt = options.find((o) => o.id === id);

    const img = card.querySelector(".option-image");
    const video = card.querySelector(".option-video");
    const text = card.querySelector(".option-text");

    card.classList.remove(
      "has-image",
      "has-video",
      "has-text",
      "correct",
      "incorrect",
      "correct-answer",
      "incorrect-answer"
    );

    card.querySelectorAll(".vote-count-display").forEach((el) => el.remove());

    if (img) {
      img.removeAttribute("src");
      img.alt = "";
      img.style.display = "";
    }
    if (video) {
      video.pause(); // 動画を停止
      video.removeAttribute("src");
      video.src = "";
      video.load(); // 動画をリセット
      video.style.display = "";
    }
    if (text) {
      text.textContent = "";
    }

    if (!opt) return;

    // 優先順位: 動画 > 画像 > テキスト
    if (opt.videoUrl && opt.videoUrl.trim() !== "") {
      hasVideo = true; // 動画があることを記録
      if (video) {
        video.src = opt.videoUrl;
        video.load(); // 動画を読み込む
        video.style.display = "block";
        card.classList.add("has-video");
        console.log(`[renderOptions] 選択肢${id}に動画を設定: ${opt.videoUrl}`);
        // 動画のエラーハンドリング
        video.onerror = (e) => {
          console.error(`[renderOptions] 選択肢${id}の動画読み込みエラー:`, e);
          console.error(`動画URL: ${opt.videoUrl}`);
        };
        video.onloadeddata = () => {
          console.log(`[renderOptions] 選択肢${id}の動画読み込み完了`);
        };
      }
    } else if (opt.imageUrl && opt.imageUrl.trim() !== "") {
      if (img) {
        img.src = opt.imageUrl;
        img.alt = opt.text ? `${id}：${opt.text}` : `${id}の画像`;
        card.classList.add("has-image");
      }
    } else {
      if (text) {
        text.textContent = opt.text || "";
        card.classList.add("has-text");
      }
    }
  });
  
  return hasVideo; // 動画があるかどうかを返す
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

  document.querySelectorAll("#options .option").forEach((card) => {
    card.classList.remove("correct", "incorrect");
  });

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
