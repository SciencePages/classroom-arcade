const socket = io();
let currentPin = '';

function joinGame() {
  const pin = document.getElementById('pin-input').value.trim();
  const nickname = document.getElementById('nick-input').value.trim();
  if (pin && nickname) {
    currentPin = pin;
    document.getElementById('player-nick').innerText = nickname;
    socket.emit('join-room', { pin, nickname });
  }
}

socket.on('joined-successfully', () => {
  document.getElementById('join-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  loadNextQuestion();
});

socket.on('error-msg', (msg) => alert(msg));

function loadNextQuestion() {
  document.getElementById('chest-overlay').style.display = 'none';
  document.getElementById('question-card').style.display = 'block';
  const resultBox = document.getElementById('chest-result');
  resultBox.innerText = '';
  resultBox.className = '';
  document.getElementById('next-q-btn').style.display = 'none';
  socket.emit('request-question', { pin: currentPin });
}

socket.on('receive-question', (q) => {
  document.getElementById('q-text').innerText = q.question;
  const grid = document.getElementById('answers-grid');
  grid.innerHTML = '';
  
  q.options.forEach((option) => {
    const btn = document.createElement('button');
    btn.innerText = option;
    btn.onclick = () => {
      const isCorrect = (option === q.answer);
      socket.emit('submit-answer', { pin: currentPin, isCorrect });
    };
    grid.appendChild(btn);
  });
});

socket.on('answer-result', ({ isCorrect }) => {
  if (isCorrect) {
    document.getElementById('question-card').style.display = 'none';
    document.getElementById('chest-overlay').style.display = 'block';
  } else {
    alert('Incorrect! Try the next question.');
    loadNextQuestion();
  }
});

function pickChest(index) {
  socket.emit('open-chest', { pin: currentPin, chestIndex: index });
}

socket.on('chest-opened', ({ resultMsg, totalGold }) => {
  document.getElementById('gold-count').innerText = totalGold;
  const resultBox = document.getElementById('chest-result');
  resultBox.innerText = resultMsg;

  // Apply high-contrast banner styles based on outcome
  if (resultMsg.includes('Stole') || resultMsg.includes('Swapped')) {
    resultBox.className = 'outcome-banner banner-steal';
  } else if (resultMsg.includes('Lose')) {
    resultBox.className = 'outcome-banner banner-loss';
  } else {
    resultBox.className = 'outcome-banner banner-gain';
  }

  document.getElementById('next-q-btn').style.display = 'inline-block';
});
