const socket = io(); // Socket.IOサーバーに接続

const statusElement = document.getElementById('status');    
const questionTextElement = document.getElementById('question-text'); 
const optionsElement = document.getElementById('options'); 
const feedbackElement = document.getElementById('feedback'); 
const myScoreElement = document.getElementById('my-score'); 

const nicknameSection = document.getElementById('nickname-section');
const nicknameInput = document.getElementById('nicknameInput');
const setNicknameBtn = document.getElementById('setNicknameBtn');
const quizSection = document.getElementById('quiz-section'); // クイズ本体のセクション

let currentQuestionId = null;
let myScore = 0; // 参加者画面のスコア
let myNickname = '匿名参加者'; // 自分のニックネーム

// --- 回答をサーバーに送信する関数 (ここを移動) ---
function sendAnswer(optionId) {
    console.log('sendAnswer関数が呼び出されました:', optionId); // <-- デバッグ用ログ
    if (!currentQuestionId) {
        feedbackElement.textContent = 'まだ問題がありません。';
        feedbackElement.style.color = 'yellow';
        console.warn('sendAnswer: currentQuestionIdが設定されていません。'); // <-- デバッグ用ログ
        return;
    }
    // 回答ボタンを無効にする（二重回答防止）
    Array.from(optionsElement.children).forEach(button => button.disabled = true);

    socket.emit('answer', { questionId: currentQuestionId, selectedOptionId: optionId });
    console.log(`回答を送信: 問題ID ${currentQuestionId}, 選択肢ID ${optionId}`);
    feedbackElement.textContent = '回答を送信しました。';
    feedbackElement.style.color = 'lightblue';
}

// サーバーに接続した時のイベント
socket.on('connect', () => {
    statusElement.textContent = 'サーバーに接続済み';
    console.log('Connected to server');
    // 接続時にニックネームセクションを表示
    nicknameSection.style.display = 'block';
    quizSection.style.display = 'none'; // クイズセクションは非表示
});

//ニックネーム設定ボタンのイベントリスナー
setNicknameBtn.onclick = () => {
    const inputNickname = nicknameInput.value.trim();
    if (inputNickname) {
        myNickname = inputNickname;
        socket.emit('setNickname', { nickname: myNickname }); // サーバーにニックネームを送信
        console.log(`ニックネームを送信: ${myNickname}`);
    } else {
        alert('ニックネームを入力してください。');
    }
};

//サーバーからニックネーム設定成功の通知を受信
socket.on('setNicknameSuccess', (data) => {
    myNickname = data.nickname;
    nicknameSection.style.display = 'none'; // ニックネームセクションを非表示
    quizSection.style.display = 'block'; // クイズセクションを表示
    statusElement.textContent = `サーバーに接続済み (${myNickname})`;
    console.log(`ニックネーム設定成功: ${myNickname}`);
});

// サーバーから切断された時のイベント
socket.on('disconnect', () => {
    statusElement.textContent = 'サーバーから切断されました';
    console.log('Disconnected from server');
    questionTextElement.textContent = 'サーバーから切断されました。';
    optionsElement.innerHTML = ''; // 選択肢をクリア
    feedbackElement.textContent = '';
    myScoreElement.textContent = 'あなたの正解数: 0';
});

// サーバーからの一般的なメッセージを受信 (クイズ開始前など)
socket.on('message', (msg) => {
    console.log('サーバーからのメッセージ:', msg);
    feedbackElement.textContent = msg;
    feedbackElement.style.color = 'white';
    questionTextElement.textContent = '準備中...'; // クイズ開始前の状態を示す
    optionsElement.innerHTML = '';
});

// サーバーから問題データが送られてきた時
socket.on('question', (questionData) => {
    console.log('参加者画面: 問題データを受信しました:', questionData);

    currentQuestionId = questionData.id;
    questionTextElement.textContent = questionData.text;
    
    // カウントダウンコンテナを表示（問題が表示されたとき）
    const countdownContainer = document.getElementById('countdown-container');
    if (countdownContainer) {
        countdownContainer.style.display = 'block';
    }

    if (optionsElement) {
        optionsElement.innerHTML = '';
        questionData.options.forEach(option => {
            const button = document.createElement('button');
            button.classList.add('option-button');
            button.dataset.option = option.id;
            button.textContent = option.text;
            button.onclick = () => sendAnswer(option.id);
            optionsElement.appendChild(button);
        });
        Array.from(optionsElement.children).forEach(button => button.disabled = false);
    } else {
        console.error("エラー: optionsElement が見つかりません。index.htmlに <div id='options'> が存在するか確認してください。");
    }

    feedbackElement.textContent = '回答してください';
    feedbackElement.style.color = 'white';
    
    if (questionData.newScore !== undefined) {
        myScore = questionData.newScore;
        myScoreElement.textContent = `あなたの正解数: ${myScore}`;
        console.log(`参加者画面: スコアが更新されました: ${myScore}`);
    }
});

// クイズが開始されたことを通知
socket.on('quizStarted', () => {
    statusElement.textContent = 'クイズが開始されました！';
    feedbackElement.textContent = '最初の問題をお待ちください...';
    feedbackElement.style.color = 'white';
    myScore = 0; // スコアをリセット
    myScoreElement.textContent = `あなたの正解数: ${myScore}`;
});

// クイズが終了したことを通知
socket.on('quizEnded', (data) => {
    questionTextElement.textContent = data.message || 'クイズは終了しました！';
    optionsElement.innerHTML = '';
    // 変更: フィードバック要素のみを使って最終スコアを表示
    feedbackElement.textContent = `あなたの最終正解数: ${data.finalScore !== undefined ? data.finalScore : myScore}`;
    feedbackElement.style.color = 'lightgreen';
    statusElement.textContent = 'クイズ終了';
    
    // カウントダウンを非表示
    const countdownContainer = document.getElementById('countdown-container');
    if (countdownContainer) {
        countdownContainer.style.display = 'none';
    }

    myScoreElement.textContent = ''; // スコア表示は最終スコアにまとめる

    if (data.finalScore !== undefined) {
        myScore = data.finalScore;
    }

    Array.from(optionsElement.children).forEach(button => button.disabled = true);
});

// サーバーからカウントダウン情報を受信
socket.on('countdown', (remainingTime) => {
    const countdownElement = document.getElementById('countdown');
    const countdownContainer = document.getElementById('countdown-container');
    
    if (remainingTime > 0 && currentQuestionId) {
        // カウントダウンを表示
        if (countdownElement) {
            countdownElement.textContent = remainingTime;
            countdownContainer.style.display = 'block';
        }
        
        // 残り時間が3秒以下になったら赤色にする
        if (remainingTime <= 3) {
            if (countdownElement) countdownElement.style.color = 'red';
        } else {
            if (countdownElement) countdownElement.style.color = '#ffda6a';
        }
        
        // 回答時間中はボタンを有効にする (問題が表示されていれば)
        if (currentQuestionId && Array.from(optionsElement.children).some(btn => !btn.disabled)) {
            Array.from(optionsElement.children).forEach(button => button.disabled = false);
        }
    } else {
        // 時間切れになったら回答ボタンを無効にする
        if (countdownElement) {
            countdownElement.textContent = '0';
            countdownElement.style.color = 'orange';
        }
        Array.from(optionsElement.children).forEach(button => button.disabled = true);
        feedbackElement.textContent = '回答時間が終了しました。';
        feedbackElement.style.color = 'orange';
    }
});