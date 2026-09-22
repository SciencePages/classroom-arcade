const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// 10 Embedded Questions (Ensures immediate, fault-tolerant loading)
let questions = [
  {
    question: "What process do plants use to convert sunlight into energy?",
    options: ["Photosynthesis", "Respiration", "Fermentation", "Combustion"],
    answer: "Photosynthesis"
  },
  {
    question: "Which planet in our solar system is known as the Red Planet?",
    options: ["Venus", "Mars", "Jupiter", "Saturn"],
    answer: "Mars"
  },
  {
    question: "What is the hardest naturally occurring substance on Earth?",
    options: ["Gold", "Iron", "Diamond", "Quartz"],
    answer: "Diamond"
  },
  {
    question: "What force keeps objects grounded on Earth?",
    options: ["Magnetism", "Friction", "Gravity", "Inertia"],
    answer: "Gravity"
  },
  {
    question: "Which gas do humans require to breathe for survival?",
    options: ["Carbon Dioxide", "Oxygen", "Nitrogen", "Helium"],
    answer: "Oxygen"
  },
  {
    question: "How many continents are there on Earth?",
    options: ["5", "6", "7", "8"],
    answer: "7"
  },
  {
    question: "What state of matter is water vapor?",
    options: ["Solid", "Liquid", "Gas", "Plasma"],
    answer: "Gas"
  },
  {
    question: "What organ pumps blood throughout the human body?",
    options: ["Brain", "Lungs", "Liver", "Heart"],
    answer: "Heart"
  },
  {
    question: "Which chemical element has the symbol 'O'?",
    options: ["Osmium", "Oxygen", "Gold", "Zinc"],
    answer: "Oxygen"
  },
  {
    question: "What is the freezing point of water in Celsius?",
    options: ["0°C", "32°C", "100°C", "-10°C"],
    answer: "0°C"
  }
];

// Load questions.json if present
try {
  const qPath = path.join(__dirname, 'questions.json');
  if (fs.existsSync(qPath)) {
    const fileData = fs.readFileSync(qPath, 'utf8');
    const parsed = JSON.parse(fileData);
    if (Array.isArray(parsed) && parsed.length > 0) {
      questions = parsed;
    }
  }
} catch (err) {
  console.log("Using default question bank.");
}

const rooms = {};

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
  socket.on('create-room', () => {
    const pin = generatePin();
    rooms[pin] = { hostId: socket.id, players: {} };
    socket.join(pin);
    socket.emit('room-created', pin);
  });

  socket.on('join-room', ({ pin, nickname }) => {
    const cleanPin = pin ? pin.toString().trim() : '';
    if (rooms[cleanPin]) {
      rooms[cleanPin].players[socket.id] = { nickname, gold: 0 };
      socket.join(cleanPin);
      socket.emit('joined-successfully');
      io.to(rooms[cleanPin].hostId).emit('update-players', rooms[cleanPin].players);
    } else {
      socket.emit('error-msg', 'Room not found!');
    }
  });

  socket.on('start-game', ({ pin }) => {
    const cleanPin = pin ? pin.toString().trim() : '';
    io.to(cleanPin).emit('game-started');
  });

  socket.on('request-question', () => {
    if (questions.length > 0) {
      const q = questions[Math.floor(Math.random() * questions.length)];
      socket.emit('receive-question', q);
    }
  });

  socket.on('submit-answer', ({ pin, isCorrect }) => {
    socket.emit('answer-result', { isCorrect });
  });

  socket.on('open-chest', ({ pin, chestIndex }) => {
    const cleanPin = pin ? pin.toString().trim() : '';
    const room = rooms[cleanPin];
    if (!room) return;

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
