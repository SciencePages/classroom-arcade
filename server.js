const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let questions = [];
try {
  questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
} catch (err) {
  console.error("Error loading questions.json", err);
}

const rooms = {};

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
  socket.on('create-room', () => {
    const pin = generatePin();
    rooms[pin] = { hostId: socket.id, players: {}, state: 'lobby' };
    socket.join(pin);
    socket.emit('room-created', pin);
  });

  socket.on('join-room', ({ pin, nickname }) => {
    if (rooms[pin]) {
      rooms[pin].players[socket.id] = { nickname, gold: 0 };
      socket.join(pin);
      socket.emit('joined-successfully');
      io.to(rooms[pin].hostId).emit('update-players', rooms[pin].players);
    } else {
      socket.emit('error-msg', 'Room not found!');
    }
  });

  socket.on('start-game', ({ pin }) => {
    if (rooms[pin] && rooms[pin].hostId === socket.id) {
      rooms[pin].state = 'playing';
      io.to(pin).emit('game-started');
    }
  });

  socket.on('request-question', ({ pin }) => {
    if (rooms[pin] && rooms[pin].state === 'playing' && questions.length > 0) {
      const q = questions[Math.floor(Math.random() * questions.length)];
      socket.emit('receive-question', q);
    }
  });

  socket.on('submit-answer', ({ pin, isCorrect }) => {
    socket.emit('answer-result', { isCorrect });
  });

  socket.on('open-chest', ({ pin, chestIndex }) => {
    const room = rooms[pin];
    if (!room || room.state !== 'playing') return;

    const player = room.players[socket.id];
    if (!player) return;

    const outcomes = ['gold_small', 'gold_med', 'gold_large', 'steal', 'swap', 'lose'];
    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    let resultMsg = "";

    const otherPlayerIds = Object.keys(room.players).filter(id => id !== socket.id);

    if (outcome === 'gold_small') {
      player.gold += 50;
      resultMsg = "+50 Gold!";
    } else if (outcome === 'gold_med') {
      player.gold += 150;
      resultMsg = "+150 Gold!";
    } else if (outcome === 'gold_large') {
      player.gold += 300;
      resultMsg = "+300 Gold!";
    } else if (outcome === 'steal') {
      if (otherPlayerIds.length > 0) {
        let targetId = otherPlayerIds.reduce((maxId, id) => 
          room.players[id].gold > room.players[maxId].gold ? id : maxId, otherPlayerIds[0]);
        let stolenAmount = Math.floor(room.players[targetId].gold * 0.25);
        if (stolenAmount === 0) stolenAmount = 50;
        
        room.players[targetId].gold = Math.max(0, room.players[targetId].gold - stolenAmount);
        player.gold += stolenAmount;
        resultMsg = `Stole ${stolenAmount} Gold from ${room.players[targetId].nickname}!`;
      } else {
        player.gold += 100;
        resultMsg = "+100 Gold!";
      }
    } else if (outcome === 'swap') {
      if (otherPlayerIds.length > 0) {
        let randomTargetId = otherPlayerIds[Math.floor(Math.random() * otherPlayerIds.length)];
        let temp = player.gold;
        player.gold = room.players[randomTargetId].gold;
        room.players[randomTargetId].gold = temp;
        resultMsg = `Swapped Gold with ${room.players[randomTargetId].nickname}!`;
      } else {
        player.gold += 100;
        resultMsg = "+100 Gold!";
      }
    } else if (outcome === 'lose') {
      let lost = Math.floor(player.gold * 0.25);
      player.gold -= lost;
      resultMsg = `Lose 25% Gold (-${lost})!`;
    }

    socket.emit('chest-opened', { resultMsg, totalGold: player.gold });
    io.to(room.hostId).emit('update-players', room.players);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
