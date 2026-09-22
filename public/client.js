const socket = io();

function joinGame() {
  const pin = document.getElementById('pin-input').value.trim();
  const nickname = document.getElementById('nick-input').value.trim();
  if (pin && nickname) {
    document.getElementById('player-nick').innerText = nickname;
    socket.emit('join-room', { pin, nickname });
  }
}

socket.on('joined-successfully', () => {
  document.getElementById('join-screen').style.display = 'none';
  document.getElementById('waiting-screen').style.display = 'block';
  document.getElementById('game-screen').style.display = 'none';
});

socket.on('game-started', () => {
  document.getElementById('waiting-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  loadNextQuestion();
});

socket.on('error-msg', (msg) => alert(msg));

function loadNextQuestion() {
  document.getElementById('chest-overlay').style.display = 'none';
  document.getElementById('chest-selection').style.display = 'block';
  document.getElementById('steal-picker').style.display = 'none';
  document.getElementById('question-card').style.display = 'block';
  
  const resultBox = document.getElementById('chest-result');
  resultBox.innerText = '';
  resultBox.className = '';
  document.getElementById('next-q-btn').style.display = 'none';
  socket.emit('request-question');
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
      socket.emit('submit-answer', { isCorrect });
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
  socket.emit('open-chest', { chestIndex: index });
}

socket.on('prompt-steal', ({ targets }) => {
  document.getElementById('chest-selection').style.display = 'none';
  const picker = document.getElementById('steal-picker');
  const targetList = document.getElementById('target-list');
  targetList.innerHTML = '';

  targets.forEach(t => {
    const btn = document.createElement('button');
    btn.style.cssText = 'background: #3c096c; border: 2px solid #9d4edd; color: #fff; margin: 6px 0; font-size: 18px; width: 100%;';
    btn.innerText = `😈 Steal from ${t.nickname} (${t.gold} Gold)`;
    btn.onclick = () => {
      socket.emit('execute-steal', { targetId: t.id });
      picker.style.display = 'none';
    };
    targetList.appendChild(btn);
  });

  picker.style.display = 'block';
});

socket.on('chest-opened', ({ resultMsg, totalGold }) => {
  document.getElementById('chest-selection').style.display = 'none';
  document.getElementById('steal-picker').style.display = 'none';
  document.getElementById('gold-count').innerText = totalGold;
  
  const resultBox = document.getElementById('chest-result');
  resultBox.innerText = resultMsg;

  if (resultMsg.includes('Stole') || resultMsg.includes('Swapped')) {
    resultBox.className = 'outcome-banner banner-steal';
  } else if (resultMsg.includes('Lose')) {
    resultBox.className = 'outcome-banner banner-loss';
  } else {
    resultBox.className = 'outcome-banner banner-gain';
  }

  document.getElementById('next-q-btn').style.display = 'inline-block';
});
