const socket = io();
let currentGameCode = '';
let questionSet = [];
let currentQIndex = 0;

function createGame() { socket.emit('create_game'); }

socket.on('game_created', ({ code }) => {
  currentGameCode = code;
  document.getElementById('create-btn').classList.add('hidden');
  document.getElementById('lobby-info').classList.remove('hidden');
  document.getElementById('display-code').innerText = code;
});

socket.on('player_list_update', (players) => {
  const list = document.getElementById('player-list');
  if (list) list.innerHTML = players.map(p => `<li>${p.name}</li>`).join('');
});

function startGame() { socket.emit('start_game', { code: currentGameCode }); }

socket.on('leaderboard_update', (players) => {
  const board = document.getElementById('leaderboard');
  if (board) {
    document.getElementById('host-lobby')?.classList.add('hidden');
    document.getElementById('host-scoreboard')?.classList.remove('hidden');
    board.innerHTML = players.map(p => `<li><span>${p.name}</span> <strong>${p.score} Gold</strong></li>`).join('');
  }
});

function joinGame() {
  const code = document.getElementById('game-code').value.trim();
  const nickname = document.getElementById('nickname').value.trim();
  if (!code || !nickname) return;
  currentGameCode = code;
  socket.emit('join_game', { code, nickname });
}

socket.on('join_error', (msg) => { document.getElementById('error-msg').innerText = msg; });

socket.on('joined_successfully', () => {
  document.getElementById('join-card').classList.add('hidden');
  document.getElementById('waiting-card').classList.remove('hidden');
});

socket.on('game_started', ({ questions }) => {
  questionSet = questions;
  currentQIndex = 0;
  document.getElementById('waiting-card').classList.add('hidden');
  renderQuestion();
});

function renderQuestion() {
  document.getElementById('chest-card').classList.add('hidden');
  document.getElementById('feedback-card').classList.add('hidden');
  document.getElementById('question-card').classList.remove('hidden');

  const q = questionSet[currentQIndex];
  document.getElementById('question-text').innerText = q.question;
  const container = document.getElementById('options-container');
  container.innerHTML = '';

  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.innerText = opt;
    btn.onclick = () => submitAnswer(idx === q.answer);
    container.appendChild(btn);
  });
}

function submitAnswer(isCorrect) {
  socket.emit('submit_answer', { code: currentGameCode, isCorrect });
}

socket.on('show_chests', () => {
  document.getElementById('question-card').classList.add('hidden');
  document.getElementById('chest-card').classList.remove('hidden');
});

socket.on('answer_result', ({ correct, score }) => {
  document.getElementById('question-card').classList.add('hidden');
  document.getElementById('feedback-card').classList.remove('hidden');
  document.getElementById('feedback-title').innerText = 'Incorrect';
  document.getElementById('feedback-detail').innerText = `Current Score: ${score} Gold`;
});

function pickChest() {
  socket.emit('select_chest', { code: currentGameCode });
}

socket.on('chest_opened', ({ outcome, newScore }) => {
  document.getElementById('chest-card').classList.add('hidden');
  document.getElementById('feedback-card').classList.remove('hidden');
  document.getElementById('feedback-title').innerText = 'Chest Reward!';
  document.getElementById('feedback-detail').innerText = `${outcome} (Total Gold: ${newScore})`;
  document.getElementById('score-display').innerText = `Gold: ${newScore}`;
});

function nextQuestion() {
  currentQIndex = (currentQIndex + 1) % questionSet.length;
  renderQuestion();
}
