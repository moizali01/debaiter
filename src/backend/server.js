// src/backend/server.js
'use strict';
const dotenv = require('dotenv');
const logger = require('pino-http')();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();

// HTTP middleware
app.disable('x-powered-by');
app.use(express.text());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(logger);

// Create HTTP server + Socket.IO server
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// In-memory state per debate
const debates = new Map(); // debateId -> { players: Map<socketId,{role,name}> }

io.on('connection', (socket) => {
  console.log('Socket connected:', socket.id);

  socket.on('join-debate', ({ debateId, role, name }) => {
    if (!debateId || !role) return;

    socket.join(`debate:${debateId}`);

    let debate = debates.get(debateId);
    if (!debate) {
      debate = { players: new Map() };
      debates.set(debateId, debate);
    }

    debate.players.set(socket.id, { role, name });

    io.to(`debate:${debateId}`).emit('player-joined', {
      debateId,
      role,
      name,
    });

    console.log(`Socket ${socket.id} joined debate ${debateId} as ${role}`);
  });

  socket.on('submit-argument', ({ debateId, role, text }) => {
    if (!debateId || !role || !text?.trim()) return;

    // Broadcast to everyone in the debate
    io.to(`debate:${debateId}`).emit('new-argument', {
      debateId,
      fromRole: role,
      text,
    });

    console.log(
      `Argument in debate ${debateId} from ${role}: ${text.slice(0, 80)}`
    );
  });

  // OPTIONAL: keep AI call here to preserve current behaviour
  // For example:
  // socket.on('request-ai-reply', async ({ debateId, role, text }) => {
  //   const aiResponse = await callGeminiOrYourHTTPRoute(text);
  //   io.to(`debate:${debateId}`).emit('ai-argument', {
  //     debateId,
  //     fromRole: 'opponent',
  //     text: aiResponse,
  //   });
  // });

  socket.on('disconnect', () => {
    // Clean up from all debates
    for (const [debateId, debate] of debates.entries()) {
      if (debate.players.has(socket.id)) {
        const { role, name } = debate.players.get(socket.id);
        debate.players.delete(socket.id);
        io.to(`debate:${debateId}`).emit('player-left', {
          debateId,
          role,
          name,
        });
        console.log(`Socket ${socket.id} left debate ${debateId}`);
        if (debate.players.size === 0) {
          debates.delete(debateId);
        }
      }
    }
  });
});

// keep your existing HTTP routes
app.post('/promptAI', (req, res) => {
  // ...
});

app.post('/MessageToAI', (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    return res.status(400).json({ error: 'No message was provided.' });
  }

  console.log(`Received message: ${userMessage}`);
  const aiResponse = `Bla Bla Bla. You just said: "${userMessage}"`;

  res.status(200).json({ reply: aiResponse });
});

const PORT = 8080;
httpServer.listen(PORT, () => {
  console.log(`Server (HTTP + Socket.IO) started on port ${PORT}`);
});
