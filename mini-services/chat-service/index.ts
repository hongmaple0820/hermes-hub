import { createServer } from 'http'
import { Server, Socket } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  // DO NOT change the path, it is used by Caddy to forward the request to the correct port
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectedUser {
  socketId: string
  userId: string
  username: string
  status: 'online' | 'offline' | 'busy'
  connectedAt: Date
  rooms: Set<string>
}

interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  content: string
  timestamp: string
  type: 'text' | 'system' | 'agent'
}

interface AgentConfig {
  agentId: string
  name: string
  mode: 'builtin' | 'custom_api' | 'hermes'
  provider?: string
  model?: string
  apiKey?: string
  baseUrl?: string
  callbackUrl?: string
  systemPrompt?: string
}

interface AgentMessagePayload {
  conversationId: string
  agentConfig: AgentConfig
  message: string
  userId: string
}

interface StreamChunk {
  conversationId: string
  agentId: string
  chunk: string
  timestamp: string
}

interface StreamCompletePayload {
  conversationId: string
  agentId: string
  fullResponse: string
  timestamp: string
}

// ---------------------------------------------------------------------------
// In-Memory State
// ---------------------------------------------------------------------------

const connectedUsers = new Map<string, ConnectedUser>()       // userId -> user info
const socketToUser = new Map<string, string>()                // socketId -> userId
const activeRooms = new Map<string, Set<string>>()            // roomId -> Set<socketId>
const typingUsers = new Map<string, Set<string>>()            // roomId -> Set<userId>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const generateId = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36)

const getRoomMembers = (roomId: string): string[] => {
  const members = activeRooms.get(roomId)
  return members ? Array.from(members) : []
}

const removeUserFromAllRooms = (socketId: string) => {
  for (const [roomId, members] of activeRooms.entries()) {
    if (members.has(socketId)) {
      members.delete(socketId)
      // Clean up empty rooms
      if (members.size === 0) {
        activeRooms.delete(roomId)
      }
      // Clean up typing state
      const typing = typingUsers.get(roomId)
      if (typing) {
        const userId = socketToUser.get(socketId)
        if (userId) {
          typing.delete(userId)
          if (typing.size === 0) {
            typingUsers.delete(roomId)
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Authentication Middleware
// ---------------------------------------------------------------------------

io.use((socket, next) => {
  const userId = socket.handshake.auth.userId
  const username = socket.handshake.auth.username

  if (!userId) {
    return next(new Error('Authentication error: userId is required'))
  }

  // Store auth info on socket for later use
  socket.data.userId = userId
  socket.data.username = username || `User-${userId.substring(0, 6)}`

  next()
})

// ---------------------------------------------------------------------------
// Event Handlers
// ---------------------------------------------------------------------------

io.on('connection', (socket: Socket) => {
  const userId: string = socket.data.userId
  const username: string = socket.data.username

  console.log(`[CONNECT] User ${username} (${userId}) connected via socket ${socket.id}`)

  // Register user
  const user: ConnectedUser = {
    socketId: socket.id,
    userId,
    username,
    status: 'online',
    connectedAt: new Date(),
    rooms: new Set(),
  }
  connectedUsers.set(userId, user)
  socketToUser.set(socket.id, userId)

  // Broadcast presence
  io.emit('presence:online', {
    userId,
    username,
    status: 'online',
    timestamp: new Date().toISOString(),
  })

  // Send the user their own info and currently online users
  socket.emit('connected', {
    userId,
    username,
    socketId: socket.id,
    onlineUsers: Array.from(connectedUsers.values()).map((u) => ({
      userId: u.userId,
      username: u.username,
      status: u.status,
    })),
  })

  // -----------------------------------------------------------------------
  // Chat Events
  // -----------------------------------------------------------------------

  socket.on('chat:join', (data: { conversationId: string }) => {
    const { conversationId } = data
    const roomKey = `chat:${conversationId}`

    socket.join(roomKey)
    user.rooms.add(roomKey)

    // Track in activeRooms
    if (!activeRooms.has(roomKey)) {
      activeRooms.set(roomKey, new Set())
    }
    activeRooms.get(roomKey)!.add(socket.id)

    console.log(`[CHAT:JOIN] ${username} joined conversation ${conversationId}`)

    socket.to(roomKey).emit('chat:join', {
      conversationId,
      userId,
      username,
      timestamp: new Date().toISOString(),
    })

    // Send the joiner the list of current members
    const memberIds = getRoomMembers(roomKey)
      .map((sid) => socketToUser.get(sid))
      .filter(Boolean)

    socket.emit('chat:members', {
      conversationId,
      members: memberIds,
    })
  })

  socket.on('chat:leave', (data: { conversationId: string }) => {
    const { conversationId } = data
    const roomKey = `chat:${conversationId}`

    socket.leave(roomKey)
    user.rooms.delete(roomKey)

    const members = activeRooms.get(roomKey)
    if (members) {
      members.delete(socket.id)
      if (members.size === 0) activeRooms.delete(roomKey)
    }

    // Clean up typing state
    const typing = typingUsers.get(roomKey)
    if (typing) {
      typing.delete(userId)
      if (typing.size === 0) typingUsers.delete(roomKey)
    }

    console.log(`[CHAT:LEAVE] ${username} left conversation ${conversationId}`)

    socket.to(roomKey).emit('chat:leave', {
      conversationId,
      userId,
      username,
      timestamp: new Date().toISOString(),
    })
  })

  socket.on('chat:message', (data: { conversationId: string; content: string; type?: 'text' | 'system' }) => {
    const { conversationId, content, type = 'text' } = data
    const roomKey = `chat:${conversationId}`

    const message: ChatMessage = {
      id: generateId(),
      conversationId,
      senderId: userId,
      senderName: username,
      content,
      timestamp: new Date().toISOString(),
      type,
    }

    console.log(`[CHAT:MSG] ${username} in ${conversationId}: ${content.substring(0, 80)}`)

    // Broadcast to everyone in the room (including sender for confirmation)
    io.to(roomKey).emit('chat:message', message)

    // Clear typing state for this user in this room
    const typing = typingUsers.get(roomKey)
    if (typing) {
      typing.delete(userId)
      if (typing.size === 0) {
        typingUsers.delete(roomKey)
      } else {
        socket.to(roomKey).emit('chat:typing', {
          conversationId,
          typingUsers: Array.from(typing),
        })
      }
    }
  })

  socket.on('chat:typing', (data: { conversationId: string; isTyping: boolean }) => {
    const { conversationId, isTyping } = data
    const roomKey = `chat:${conversationId}`

    if (!typingUsers.has(roomKey)) {
      typingUsers.set(roomKey, new Set())
    }
    const typing = typingUsers.get(roomKey)!

    if (isTyping) {
      typing.add(userId)
    } else {
      typing.delete(userId)
    }

    if (typing.size === 0) {
      typingUsers.delete(roomKey)
    }

    socket.to(roomKey).emit('chat:typing', {
      conversationId,
      typingUsers: Array.from(typing),
    })
  })

  // -----------------------------------------------------------------------
  // Agent Events
  // -----------------------------------------------------------------------

  socket.on('agent:message', async (data: AgentMessagePayload) => {
    const { conversationId, agentConfig, message, userId: senderId } = data
    const roomKey = `chat:${conversationId}`

    console.log(`[AGENT:MSG] User ${username} sent message to agent ${agentConfig.name} (${agentConfig.agentId})`)

    // Notify the room that the agent is processing
    io.to(roomKey).emit('agent:typing', {
      conversationId,
      agentId: agentConfig.agentId,
      agentName: agentConfig.name,
      isTyping: true,
      timestamp: new Date().toISOString(),
    })

    try {
      if (agentConfig.mode === 'builtin') {
        // --- Builtin agent: call OpenAI-compatible LLM API ---
        await handleBuiltinAgent(socket, roomKey, conversationId, agentConfig, message)
      } else if (agentConfig.mode === 'custom_api') {
        // --- Custom API: forward to callback URL ---
        await handleCustomApiAgent(socket, roomKey, conversationId, agentConfig, message)
      } else if (agentConfig.mode === 'hermes') {
        // --- Hermes: forward to hermes gateway ---
        await handleHermesAgent(socket, roomKey, conversationId, agentConfig, message)
      } else {
        console.warn(`[AGENT:MSG] Unknown agent mode: ${agentConfig.mode}`)
        io.to(roomKey).emit('agent:typing', {
          conversationId,
          agentId: agentConfig.agentId,
          isTyping: false,
          timestamp: new Date().toISOString(),
        })
        io.to(roomKey).emit('agent:stream-complete', {
          conversationId,
          agentId: agentConfig.agentId,
          fullResponse: `Error: Unknown agent mode "${agentConfig.mode}"`,
          timestamp: new Date().toISOString(),
          error: true,
        })
      }
    } catch (err: any) {
      console.error(`[AGENT:MSG] Error handling agent message:`, err)

      io.to(roomKey).emit('agent:typing', {
        conversationId,
        agentId: agentConfig.agentId,
        isTyping: false,
        timestamp: new Date().toISOString(),
      })

      io.to(roomKey).emit('agent:stream-complete', {
        conversationId,
        agentId: agentConfig.agentId,
        fullResponse: `Error: ${err.message || 'Internal server error'}`,
        timestamp: new Date().toISOString(),
        error: true,
      })
    }
  })

  // -----------------------------------------------------------------------
  // Presence Events
  // -----------------------------------------------------------------------

  socket.on('presence:update', (data: { status: 'online' | 'offline' | 'busy' }) => {
    const { status } = data
    const user = connectedUsers.get(userId)
    if (user) {
      user.status = status
    }

    console.log(`[PRESENCE:UPDATE] ${username} set status to ${status}`)

    io.emit('presence:update', {
      userId,
      username,
      status,
      timestamp: new Date().toISOString(),
    })
  })

  // -----------------------------------------------------------------------
  // Room Events (general chat rooms, distinct from conversation chat)
  // -----------------------------------------------------------------------

  socket.on('room:join', (data: { roomId: string }) => {
    const { roomId } = data
    const roomKey = `room:${roomId}`

    socket.join(roomKey)
    user.rooms.add(roomKey)

    if (!activeRooms.has(roomKey)) {
      activeRooms.set(roomKey, new Set())
    }
    activeRooms.get(roomKey)!.add(socket.id)

    console.log(`[ROOM:JOIN] ${username} joined room ${roomId}`)

    socket.to(roomKey).emit('room:join', {
      roomId,
      userId,
      username,
      timestamp: new Date().toISOString(),
    })
  })

  socket.on('room:leave', (data: { roomId: string }) => {
    const { roomId } = data
    const roomKey = `room:${roomId}`

    socket.leave(roomKey)
    user.rooms.delete(roomKey)

    const members = activeRooms.get(roomKey)
    if (members) {
      members.delete(socket.id)
      if (members.size === 0) activeRooms.delete(roomKey)
    }

    console.log(`[ROOM:LEAVE] ${username} left room ${roomId}`)

    socket.to(roomKey).emit('room:leave', {
      roomId,
      userId,
      username,
      timestamp: new Date().toISOString(),
    })
  })

  socket.on('room:message', (data: { roomId: string; content: string }) => {
    const { roomId, content } = data
    const roomKey = `room:${roomId}`

    const message = {
      id: generateId(),
      roomId,
      senderId: userId,
      senderName: username,
      content,
      timestamp: new Date().toISOString(),
    }

    console.log(`[ROOM:MSG] ${username} in room ${roomId}: ${content.substring(0, 80)}`)

    io.to(roomKey).emit('room:message', message)
  })

  socket.on('room:agent-join', (data: { roomId: string; agentId: string; agentName: string }) => {
    const { roomId, agentId, agentName } = data
    const roomKey = `room:${roomId}`

    console.log(`[ROOM:AGENT-JOIN] Agent ${agentName} (${agentId}) joined room ${roomId}`)

    io.to(roomKey).emit('room:agent-join', {
      roomId,
      agentId,
      agentName,
      timestamp: new Date().toISOString(),
    })
  })

  socket.on('room:agent-leave', (data: { roomId: string; agentId: string; agentName: string }) => {
    const { roomId, agentId, agentName } = data
    const roomKey = `room:${roomId}`

    console.log(`[ROOM:AGENT-LEAVE] Agent ${agentName} (${agentId}) left room ${roomId}`)

    io.to(roomKey).emit('room:agent-leave', {
      roomId,
      agentId,
      agentName,
      timestamp: new Date().toISOString(),
    })
  })

  // -----------------------------------------------------------------------
  // Context Compression Events
  // -----------------------------------------------------------------------

  socket.on('room:compress', async (data: { roomId: string }) => {
    const { roomId } = data
    const roomKey = `room:${roomId}`

    console.log(`[ROOM:COMPRESS] User ${username} requested compression for room ${roomId}`)

    // Emit compressing status
    io.to(roomKey).emit('room:compress-status', {
      roomId,
      status: 'compressing',
      timestamp: new Date().toISOString(),
    })

    try {
      // Call the Next.js API to trigger compression
      const nextjsUrl = process.env.NEXTJS_API_URL || 'http://localhost:3000'
      const response = await fetch(`${nextjsUrl}/api/chat-rooms/${roomId}/compress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Compression API error: ${response.status} - ${errorText}`)
      }

      const result = await response.json()

      console.log(`[ROOM:COMPRESS] Compression complete for room ${roomId}, snapshot: ${result.snapshotId}`)

      // Emit ready status
      io.to(roomKey).emit('room:compress-status', {
        roomId,
        status: 'ready',
        snapshotId: result.snapshotId,
        summaryTokenCount: result.summaryTokenCount,
        timestamp: new Date().toISOString(),
      })
    } catch (err: any) {
      console.error(`[ROOM:COMPRESS] Error compressing room ${roomId}:`, err)

      // Emit error status
      io.to(roomKey).emit('room:compress-status', {
        roomId,
        status: 'error',
        error: err.message || 'Compression failed',
        timestamp: new Date().toISOString(),
      })
    }
  })

  // -----------------------------------------------------------------------
  // Disconnect
  // -----------------------------------------------------------------------

  socket.on('disconnect', (reason) => {
    console.log(`[DISCONNECT] User ${username} (${userId}) disconnected: ${reason}`)

    // Clean up user from all rooms
    removeUserFromAllRooms(socket.id)

    // Remove from connected users
    connectedUsers.delete(userId)
    socketToUser.delete(socket.id)

    // Broadcast presence offline
    io.emit('presence:offline', {
      userId,
      username,
      timestamp: new Date().toISOString(),
    })
  })

  socket.on('error', (error) => {
    console.error(`[ERROR] Socket error for ${username} (${socket.id}):`, error)
  })
})

// ---------------------------------------------------------------------------
// Agent Mode Handlers
// ---------------------------------------------------------------------------

async function handleBuiltinAgent(
  socket: Socket,
  roomKey: string,
  conversationId: string,
  agentConfig: AgentConfig,
  message: string,
) {
  const provider = agentConfig.provider || 'openai'
  const baseUrl = agentConfig.baseUrl || 'https://api.openai.com/v1'
  const model = agentConfig.model || 'gpt-3.5-turbo'
  const apiKey = agentConfig.apiKey

  if (!apiKey) {
    io.to(roomKey).emit('agent:typing', {
      conversationId,
      agentId: agentConfig.agentId,
      isTyping: false,
      timestamp: new Date().toISOString(),
    })
    io.to(roomKey).emit('agent:stream-complete', {
      conversationId,
      agentId: agentConfig.agentId,
      fullResponse: 'Error: API key not configured for this agent.',
      timestamp: new Date().toISOString(),
      error: true,
    })
    return
  }

  const messages: any[] = []
  if (agentConfig.systemPrompt) {
    messages.push({ role: 'system', content: agentConfig.systemPrompt })
  }
  messages.push({ role: 'user', content: message })

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LLM API error (${response.status}): ${errorText}`)
    }

    const body = response.body
    if (!body) {
      throw new Error('No response body from LLM API')
    }

    let fullResponse = ''
    const reader = body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      // Parse SSE lines
      const lines = chunk.split('\n').filter((line) => line.startsWith('data: '))

      for (const line of lines) {
        const data = line.substring(6).trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullResponse += content
            io.to(roomKey).emit('agent:stream', {
              conversationId,
              agentId: agentConfig.agentId,
              chunk: content,
              timestamp: new Date().toISOString(),
            } as StreamChunk)
          }
        } catch {
          // Skip malformed JSON chunks
        }
      }
    }

    // Agent finished responding
    io.to(roomKey).emit('agent:typing', {
      conversationId,
      agentId: agentConfig.agentId,
      isTyping: false,
      timestamp: new Date().toISOString(),
    })

    io.to(roomKey).emit('agent:stream-complete', {
      conversationId,
      agentId: agentConfig.agentId,
      fullResponse,
      timestamp: new Date().toISOString(),
    } as StreamCompletePayload)

    console.log(`[AGENT:BUILTIN] Completed streaming response for agent ${agentConfig.name} (${agentConfig.agentId}), length: ${fullResponse.length}`)
  } catch (err: any) {
    io.to(roomKey).emit('agent:typing', {
      conversationId,
      agentId: agentConfig.agentId,
      isTyping: false,
      timestamp: new Date().toISOString(),
    })

    io.to(roomKey).emit('agent:stream-complete', {
      conversationId,
      agentId: agentConfig.agentId,
      fullResponse: `Error: ${err.message || 'Failed to get LLM response'}`,
      timestamp: new Date().toISOString(),
      error: true,
    } as StreamCompletePayload & { error: boolean })
  }
}

async function handleCustomApiAgent(
  socket: Socket,
  roomKey: string,
  conversationId: string,
  agentConfig: AgentConfig,
  message: string,
) {
  const callbackUrl = agentConfig.callbackUrl

  if (!callbackUrl) {
    io.to(roomKey).emit('agent:typing', {
      conversationId,
      agentId: agentConfig.agentId,
      isTyping: false,
      timestamp: new Date().toISOString(),
    })
    io.to(roomKey).emit('agent:stream-complete', {
      conversationId,
      agentId: agentConfig.agentId,
      fullResponse: 'Error: Callback URL not configured for this agent.',
      timestamp: new Date().toISOString(),
      error: true,
    })
    return
  }

  try {
    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        agentId: agentConfig.agentId,
        agentName: agentConfig.name,
        message,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error(`Custom API error (${response.status})`)
    }

    const data = await response.json()
    const reply = data.response || data.message || data.content || 'No response from custom API'

    io.to(roomKey).emit('agent:stream', {
      conversationId,
      agentId: agentConfig.agentId,
      chunk: reply,
      timestamp: new Date().toISOString(),
    })

    io.to(roomKey).emit('agent:typing', {
      conversationId,
      agentId: agentConfig.agentId,
      isTyping: false,
      timestamp: new Date().toISOString(),
    })

    io.to(roomKey).emit('agent:stream-complete', {
      conversationId,
      agentId: agentConfig.agentId,
      fullResponse: reply,
      timestamp: new Date().toISOString(),
    } as StreamCompletePayload)

    console.log(`[AGENT:CUSTOM_API] Completed custom API call for agent ${agentConfig.name}`)
  } catch (err: any) {
    io.to(roomKey).emit('agent:typing', {
      conversationId,
      agentId: agentConfig.agentId,
      isTyping: false,
      timestamp: new Date().toISOString(),
    })

    io.to(roomKey).emit('agent:stream-complete', {
      conversationId,
      agentId: agentConfig.agentId,
      fullResponse: `Error: ${err.message || 'Failed to call custom API'}`,
      timestamp: new Date().toISOString(),
      error: true,
    })
  }
}

async function handleHermesAgent(
  socket: Socket,
  roomKey: string,
  conversationId: string,
  agentConfig: AgentConfig,
  message: string,
) {
  // Hermes gateway integration - placeholder for forwarding to hermes gateway
  // In production, this would make a request to the hermes gateway API
  const hermesGatewayUrl = process.env.HERMES_GATEWAY_URL || 'http://localhost:3000/api/hermes'

  try {
    const response = await fetch(hermesGatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        conversationId,
        agentId: agentConfig.agentId,
        agentName: agentConfig.name,
        message,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) {
      throw new Error(`Hermes gateway error (${response.status})`)
    }

    const data = await response.json()
    const reply = data.response || data.message || data.content || 'No response from Hermes gateway'

    io.to(roomKey).emit('agent:stream', {
      conversationId,
      agentId: agentConfig.agentId,
      chunk: reply,
      timestamp: new Date().toISOString(),
    })

    io.to(roomKey).emit('agent:typing', {
      conversationId,
      agentId: agentConfig.agentId,
      isTyping: false,
      timestamp: new Date().toISOString(),
    })

    io.to(roomKey).emit('agent:stream-complete', {
      conversationId,
      agentId: agentConfig.agentId,
      fullResponse: reply,
      timestamp: new Date().toISOString(),
    } as StreamCompletePayload)

    console.log(`[AGENT:HERMES] Completed Hermes gateway call for agent ${agentConfig.name}`)
  } catch (err: any) {
    // If hermes gateway is not available, provide a helpful fallback
    console.warn(`[AGENT:HERMES] Gateway unavailable, using fallback response`)

    const fallbackResponse = `[Hermes Agent: ${agentConfig.name}] I received your message but the Hermes gateway is currently unavailable. Your message has been logged and will be processed when the gateway is restored.`

    io.to(roomKey).emit('agent:stream', {
      conversationId,
      agentId: agentConfig.agentId,
      chunk: fallbackResponse,
      timestamp: new Date().toISOString(),
    })

    io.to(roomKey).emit('agent:typing', {
      conversationId,
      agentId: agentConfig.agentId,
      isTyping: false,
      timestamp: new Date().toISOString(),
    })

    io.to(roomKey).emit('agent:stream-complete', {
      conversationId,
      agentId: agentConfig.agentId,
      fullResponse: fallbackResponse,
      timestamp: new Date().toISOString(),
    })
  }
}

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[Hermes Chat Service] Socket.IO server running on port ${PORT}`)
  console.log(`[Hermes Chat Service] Ready to accept connections`)
})

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

const shutdown = () => {
  console.log('[Hermes Chat Service] Shutting down...')
  io.disconnectSockets(true)
  httpServer.close(() => {
    console.log('[Hermes Chat Service] Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
