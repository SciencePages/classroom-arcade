const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let questions = [];
try {
  questions = JSON.parse(fs.readFileSync('questions.json', 'utf8'));
} catch (err) {
  console.error('Error loading questions.json:', err);
}

const games = {}; 

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

io.on('connection', (socket) => {
  socket.on('create_game', () => {
    const code = generateCode();
    games[code] = { hostId: socket.id, players: {}, state: 'LOBBY' };
    socket.join(code);
    socket.emit('game_created', { code });
  });

  socket.on('join_game', ({ code, nickname }) => {
    const game = games[code];
    if (!game) return socket.emit('join_error', 'Game code not found.');
    if (game.state !== 'LOBBY') return socket.emit('join_error', 'Game already in progress.');

    socket.join(code);
    game.players[socket.id] = { id: socket.id, name: nickname, score: 0, multiplier: 1 };
    socket.emit('joined_successfully', { code, nickname });
    io.to(game.hostId).emit('player_list_update', Object.values(game.players));
  });

  socket.on('start_game', ({ code }) => {
    const game = games[code];
    if (game && game.hostId === socket.id) {
      game.state = 'PLAYING';
      io.to(code).emit('game_started', { questions });
    }
  });

  socket.on('submit_answer', ({ code, isCorrect }) => {
    const game = games[code];
    if (!game || !game.players[socket.id]) return;

    if (isCorrect) {
      socket.emit('show_chests');
    } else {
      socket.emit('answer_result', { correct: false, score: game.players[socket.id].score });
    }
  });

  socket.on('select_chest', ({ code }) => {
    const game = games[code];
    if (!game || !game.players[socket.id]) return;

    const player = game.players[socket.id];
    const otherPlayers = Object.values(game.players).filter(p => p.id !== socket.id);

    const outcomes = [
      { type: 'gold', value: 100 * player.multiplier, msg: `+${100 * player.multiplier} Gold!` },
      { type: 'gold', value: 250 * player.multiplier, msg: `+${250 * player.multiplier} Gold!` },
      { type: 'multiplier', value: 2, msg: '2x Multiplier activated!' },
      { type: 'steal', value: 150, msg: 'Stole 150 Gold!' }
    ];

    const outcome = outcomes[Math.floor(Math.random() * outcomes.length)];

    if (outcome.type === 'gold') {
      player.score += outcome.value;
    } else if (outcome.type === 'multiplier') {
      player.multiplier *= outcome.value;
    } else if (outcome.type === 'steal') {
      if (otherPlayers.length > 0) {
        const victim = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        const stolen = Math.min(victim.score, outcome.value);
        victim.score -= stolen;
        player.score += stolen;
      } else {
        player.score += 50;
        outcome.msg = '+50 Gold (No players to steal from)';
      }
    }

    socket.emit('chest_opened', { outcome: outcome.msg, newScore: player.score });
    io.to(code).emit('leaderboard_update', Object.values(game.players).sort((a, b) => b.score - a.score));
  });

  socket.on('disconnect', () => {
    for (const code in games) {
      const game = games[code];
      if (game.players[socket.id]) {
        delete game.players[socket.id];
        io.to(game.hostId).emit('player_list_update', Object.values(game.players));
        io.to(code).emit('leaderboard_update', Object.values(game.players).sort((a, b) => b.score - a.score));
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server live on port ${PORT}`));
