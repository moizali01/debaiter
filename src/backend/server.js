'use strict'
const dotenv = require("dotenv")
const logger = require("pino-http")()
const express = require("express")
const cors = require("cors")
const http = require("http")
const { Server } = require("socket.io")

// Load environment variables from .env
dotenv.config()

const app = express()
const server = http.createServer(app)

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
})

// Application settings
app.disable("x-powered-by")
app.use(express.text())
app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(cors({ origin: 'http://localhost:3000' }))
app.use(logger)

// dictionary for storing debates and their states with properties like participants,oppent-type, current turn, timers, etc.
//should migrate to SQLite
const activeDebates = new Map()

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`)

  // debate room joining event by debateId 
  socket.on('join-debate', ({ debateId, userId, userName, role, opponentType }) => {
    socket.join(debateId)
    
    // check if room exists in activeDebates, if not create it
    if (!activeDebates.has(debateId)) {
      activeDebates.set(debateId, {
        participants: [],
        opponentType,
        currentTurn: 'affirmative', // Affirmative always starts
        timerActive: true
      })
    }

    const debate = activeDebates.get(debateId)
    
    // add the current participant
    const participant = {
      socketId: socket.id,
      userId,
      userName,
      role
    }
    debate.participants.push(participant)

    console.log(`${userName} joined debate ${debateId} as ${role}`)

    // emit event to other participants about the new joiner
    socket.to(debateId).emit('participant-joined', {
      userName,
      role,
      participantCount: debate.participants.length
    })

    // send debate state to the new participant
    socket.emit('debate-state', {
      currentTurn: debate.currentTurn,
      timerActive: debate.timerActive,
      participantCount: debate.participants.length
    })

    // if user is negative then AI should go first 
    if (opponentType === 'ai' && role === 'negative') {
      console.log('AI will make the first move')
      
      // small delay
      setTimeout(async () => {
        try {
          const aiOpening = await getAIResponse('Make an opening statement for the debate')
          
          io.to(debateId).emit('new-message', {
            from: 'affirmative',
            text: aiOpening,
            timestamp: Date.now()
          })

          // notify the turn change
          debate.currentTurn = 'negative'
          io.to(debateId).emit('turn-changed', {
            currentTurn: debate.currentTurn,
            startTimer: true
          })
        } catch (error) {
          console.error('AI opening statement error:', error)
          socket.emit('error', { message: 'Failed to get AI opening statement' })
        }
      }, 1000)
    }

    // if human vs human, both joined, then start the sebate
    if (opponentType === 'human' && debate.participants.length === 2) {
      io.to(debateId).emit('debate-ready', {
        message: 'Both players connected. Debate can begin!',
        currentTurn: debate.currentTurn
      })
    }
  })

  // handle message
  socket.on('send-message', async ({ debateId, message, role, opponentType }) => {
    const debate = activeDebates.get(debateId)
    if (!debate) return

    // emit message to everyone
    io.to(debateId).emit('new-message', {
      from: role,
      text: message,
      timestamp: Date.now()
    })

    // turn switch
    debate.currentTurn = role === 'affirmative' ? 'negative' : 'affirmative'
    const opponentRole = role === 'affirmative' ? 'negative' : 'affirmative'

    // AI's turn
    if (opponentType === 'ai' && debate.currentTurn === opponentRole) {
      try {
        const aiResponse = await getAIResponse(message)
        

        setTimeout(() => {
          io.to(debateId).emit('new-message', {
            from: opponentRole,
            text: aiResponse,
            timestamp: Date.now()
          })

          debate.currentTurn = role
          io.to(debateId).emit('turn-changed', {
            currentTurn: debate.currentTurn,
            startTimer: true
          })
        }, 1500)
      } catch (error) {
        console.error('AI response error:', error)
        socket.emit('error', { message: 'Failed to get AI response' })
      }
    } else {
      io.to(debateId).emit('turn-changed', {
        currentTurn: debate.currentTurn,
        startTimer: true
      })
    }
  })

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
})

// API calls should be intregated here to get AI responses or the socket code might be modified depending od
//API calls
async function getAIResponse(userMessage) {
  // TODO: Replace with actual AI API call (Gemini, OpenAI, etc.)
  // For now, return a mock response
  return `AI Response: I understand your point about "${userMessage.substring(0, 50)}...". However, I must argue that...`
}

// REST API endpoints (keep existing ones)
app.post("/promptAI", (req, res) => {
  logger(req, res)
  const apiReq = new Request("http://localhost:8080/randomEndpoint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: "Deniz"
    })
  })
  fetch(apiReq)
    .then((resp) => resp.text())
    .then((bodyText) => res.send(`This is what randomEndpoint said ${bodyText}`))
})

app.post('/MessageToAI', (req, res) => {
  const userMessage = req.body.message
  if (!userMessage) {
    return res.status(400).json({ error: 'No message was provided.' })
  }
  console.log(`Received message: ${userMessage}`)
  const aiResponse = `Bla Bla Bla. You just said: "${userMessage}"`
  res.status(200).json({ reply: aiResponse })
})

// Use server.listen instead of app.listen for Socket.IO
server.listen(8080, () => {
  console.log("Server started on port 8080 with Socket.IO")
})