import dotenv from "dotenv";
import express from "express";
import fs from "fs"
import http from "http";   
import https from "https";       
import { Server } from "socket.io";
import cors from "cors"

dotenv.config();

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_HOSTNAME, 
  methods: ["GET", "POST"]
}));

// const port = process.env.SOCKETS_PORT || 4000;

// Plain HTTP server for local dev
// const server = http.createServer(app);

const httpsOptions = {
	key : fs.readFileSync("/etc/letsencrypt/live/socket.debaiter.app/privkey.pem"),
	cert : fs.readFileSync("/etc/letsencrypt/live/socket.debaiter.app/cert.pem"),
	ca : fs.readFileSync("/etc/letsencrypt/live/socket.debaiter.app/chain.pem"),
}

const server = https.createServer(httpsOptions,app)

const port = process.env.SOCKET_PORT

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_HOSTNAME, 
    methods: ["GET", "POST"],
  },
});


// API for lobby list
app.get('/api/open-debates', (req, res) => {
  const openGames = [];

  activeDebates.forEach((debate, id) => {
    // We only want Human vs Human games that have exactly 1 participant
    if (debate.opponentType === 'human' && debate.participants.length === 1) {
      openGames.push({
        id: id,
        topic: debate.topic,
        creatorRole: debate.participants[0].role,
        creatorName: debate.participants[0].userName,
        createdAt: debate.createdAt
      });
    }
  });

  res.json(openGames);
});


// dictionary for storing debates and their states with properties like participants,oppent-type, current turn, timers, etc.
//should migrate to SQLite
const activeDebates = new Map()

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)

  // debate room joining event by debateId 
  // socket.on('join-debate', ({ debateId, userId, userName, role, opponentType }) => {
  //   socket.join(debateId)
    
  //   // check if room exists in activeDebates, if not create it
  //   if (!activeDebates.has(debateId)) {
  //     activeDebates.set(debateId, {
  //       participants: [],
  //       opponentType,
  //       currentTurn: 'affirmative', // Affirmative always starts
  //       timerActive: true
  //     })
  //   }

  //   const debate = activeDebates.get(debateId)
    
  //   // add the current participant
  //   const participant = {
  //     socketId: socket.id,
  //     userId,
  //     userName,
  //     role
  //   }
  //   debate.participants.push(participant)

  //   console.log(`${userName} joined debate ${debateId} as ${role}`)

  //   // share current state with everyone so existing clients can hide the modal once two people are in
  //   io.to(debateId).emit('debate-state', {
  //     currentTurn: debate.currentTurn,
  //     timerActive: debate.timerActive,
  //     participantCount: debate.participants.length
  //   })

  //   // emit event to other participants about the new joiner
  //   socket.to(debateId).emit('participant-joined', {
  //     userName,
  //     role,
  //     participantCount: debate.participants.length
  //   })

  //   // send debate state to the new participant
  //   socket.emit('debate-state', {
  //     currentTurn: debate.currentTurn,
  //     timerActive: debate.timerActive,
  //     participantCount: debate.participants.length
  //   })

  //   // if user is negative then AI should go first 
  //   if (opponentType === 'ai' && role === 'negative') {
  //     console.log('AI will make the first move')
      
  //     // small delay
  //     setTimeout(async () => {
  //       try {
  //         const aiOpening = await getAIResponse('Make an opening statement for the debate')
          
  //         io.to(debateId).emit('new-message', {
  //           from: 'affirmative',
  //           text: aiOpening,
  //           timestamp: Date.now()
  //         })

  //         // notify the turn change
  //         debate.currentTurn = 'negative'
  //         io.to(debateId).emit('turn-changed', {
  //           currentTurn: debate.currentTurn,
  //           startTimer: true
  //         })
  //       } catch (error) {
  //         console.error('AI opening statement error:', error)
  //         socket.emit('error', { message: 'Failed to get AI opening statement' })
  //       }
  //     }, 1000)
  //   }

  //   // if human vs human, both joined, then start the sebate
  //   if (opponentType === 'human' && debate.participants.length === 2) {
  //     io.to(debateId).emit('debate-ready', {
  //       message: 'Both players connected. Debate can begin!',
  //       currentTurn: debate.currentTurn
  //     })
  //   }
  // })

  // handle message
  // handle message (HUMAN vs HUMAN)
socket.on('send-message', ({ debateId, message, role, opponentType }) => {
  const debate = activeDebates.get(debateId);
  if (!debate) return;

  // Broadcast the message to everyone in this debate room
  io.to(debateId).emit('new-message', {
    from: role,          // 'affirmative' or 'negative'
    text: message,
    timestamp: Date.now(),
  });

  // Switch the turn
  debate.currentTurn = role === 'affirmative' ? 'negative' : 'affirmative';

  // Notify clients whose turn it is now
  io.to(debateId).emit('turn-changed', {
    currentTurn: debate.currentTurn,
    startTimer: true,
    reason: 'message-sent',
  });
});

  socket.on('join-debate', ({ debateId, userId, userName, role, opponentType, topic }) => {
  socket.join(debateId);

  if (!activeDebates.has(debateId)) {
    activeDebates.set(debateId, {
      participants: [],
      topic: topic,
      opponentType,
      currentTurn: 'affirmative', // Affirmative always starts
      timerActive: true,
    });
  }

  const debate = activeDebates.get(debateId);

  // make sure this user isn't added twice
  let existing = debate.participants.find(p => p.userId === userId && p.role === role);

  if (existing) {
    // Update socketId on reconnect
    existing.socketId = socket.id;
    console.log(`Reconnected: ${userName} for debate ${debateId} as ${role}`);
  } else {
    const participant = {
      socketId: socket.id,
      userId,
      userName,
      role,
    };
    debate.participants.push(participant);
    console.log(`${userName} joined debate ${debateId} as ${role}`);
  }

  // Now participantCount will be 1 until a *different* user joins
  const participantCount = debate.participants.length;

  // Broadcast current state to everyone
  io.to(debateId).emit('debate-state', {
    currentTurn: debate.currentTurn,
    timerActive: debate.timerActive,
    participantCount,
  });

  // Notify others about the join (optional)
  socket.to(debateId).emit('participant-joined', {
    userName,
    role,
    participantCount,
  });

  // If human vs human and there are now two distinct participants, start debate
  if (opponentType === 'human' && participantCount === 2) {
    io.to(debateId).emit('debate-ready', {
      message: 'Both players connected. Debate can begin!',
      currentTurn: debate.currentTurn,
    });
  }

  // (AI logic can stay as you had it if you’re also supporting AI here)
  });


  // timer exiration event
  socket.on('timer-expired', ({ debateId, role }) => {
    const debate = activeDebates.get(debateId)
    if (!debate) return

    debate.currentTurn = role === 'affirmative' ? 'negative' : 'affirmative'
    
    io.to(debateId).emit('turn-changed', {
      currentTurn: debate.currentTurn,
      startTimer: true,
      reason: 'timer-expired'
    })
  })

  //typing event 
  socket.on('typing', ({ debateId, role }) => {
    socket.to(debateId).emit('opponent-typing', { role })
  })
  //stopped typing event
  socket.on('stop-typing', ({ debateId }) => {
    socket.to(debateId).emit('opponent-stop-typing')
  })

  //disconnection handling
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`)
    
    // Remove participant from all debates
    activeDebates.forEach((debate, debateId) => {
      const index = debate.participants.findIndex(p => p.socketId === socket.id)
      if (index !== -1) {
        const participant = debate.participants[index]
        debate.participants.splice(index, 1)
        
        // Notify others
        io.to(debateId).emit('participant-left', {
          userName: participant.userName,
          role: participant.role
        })

        // Clean up empty debates
        if (debate.participants.length === 0) {
          activeDebates.delete(debateId)
        }
      }
    })
  })

  // When one client affirmative gets the debate result from AI judge
  socket.on('debate-result', ({ debateId, result }) => {
    console.log('📩 [server] debate-result received', { debateId, result });
    // send to everyone else in the room
    socket.to(debateId).emit('debate-result', result);
  });
})

server.listen(port,() => {
	console.log(`Sockets server listening on ${port}`)
})
