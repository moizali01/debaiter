import dotenv from "dotenv"
import express from "express"
// import https from "https"
import http from "http"
import fs from "fs"
import { Server } from "socket.io"

// Load environment variables from .env
dotenv.config()

const app = express()

// const httpsOptions = {
// 	key : fs.readFileSync("/etc/letsencrypt/live/socket.debaiter.app/privkey.pem"),
// 	cert : fs.readFileSync("/etc/letsencrypt/live/socket.debaiter.app/cert.pem"),
// 	ca : fs.readFileSync("/etc/letsencrypt/live/socket.debaiter.app/chain.pem"),
// }

const server = http.createServer(app)

const port = "8080"

// Initialize Socket.IO with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_HOSTNAME,
    methods: ['GET', 'POST']
  }
})

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

	socket.on('debate-result', ({debateId,winner, reasoning, from}) => {

		console.log("Received the debate-result")
		// Once you get a debate-result, propagate that to 
		// the other player
		socket.to(debateId).emit('debate-result',{
			debateId,
			winner : winner,
			reasoning : reasoning,
			from : from
		})

	})
})

server.listen(port,() => {
	console.log(`Sockets server listening on ${port}`)
})
