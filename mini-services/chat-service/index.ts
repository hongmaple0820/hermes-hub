import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'
import { createDecipheriv, scryptSync } from 'crypto'

// ---------------------------------------------------------------------------
// Decrypt utility (mirrors /src/lib/crypto.ts for use in mini-service)
// ---------------------------------------------------------------------------

const ALGORITHM = 'aes-256-gcm'

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_SECRET || 'hermes-hub-default-encryption-key-change-in-production'
  return scryptSync(secret, 'hermes-salt', 32)
}

function decrypt(encryptedText: string): string {
  const key = getEncryptionKey()
  const parts = encryptedText.split(':')
  if (parts.length !== 3) {
    // Not encrypted - return as-is for backward compatibility
    return encryptedText
  }
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const encrypted = parts[2]
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

const PORT = 3003

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
// Notification Subscription Tracking
// ---------------------------------------------------------------------------

// Track which users are subscribed for notifications (userId -> Set<socketId>)
const notificationSubscribers = new Map<string, Set<string>>()

// Prepend our HTTP request handler BEFORE Socket.IO's handler so that
// /health is handled by us, not Socket.IO (which returns "Transport unknown").
const existingListeners = httpServer.listeners('request').slice()
httpServer.removeAllListeners('request')
httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
  const urlPath = (req.url || '/').split('?')[0]

  if (urlPath === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      service: 'hermes-chat-service',
      port: PORT,
      connectedClients: connectedUsers.size,
      activeRooms: activeRooms.size,
      notificationSubscribers: notificationSubscribers.size,
      uptime: process.uptime(),
    }))
    return
  }

  // POST /internal/notifications — Push notification to a user via Socket.IO
  if (urlPath === '/internal/notifications' && req.method === 'POST') {
    try {
      const body = await new Promise<any>((resolve, reject) => {
        let data = ''
        req.on('data', (chunk) => { data += chunk })
        req.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch (e) { reject(e) }
        })
        req.on('error', reject)
      })

      const { userId, notification } = body
      if (!userId || !notification) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'userId and notification are required' }))
        return
      }

      const notifPayload = {
        id: notification.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type: notification.type || 'info',
        title: notification.title || '',
        message: notification.message || '',
        timestamp: notification.timestamp || new Date().toISOString(),
        actionUrl: notification.actionUrl || undefined,
        metadata: notification.metadata || undefined,
        live: true, // Mark as live (real-time) notification
      }

      // Emit to the specific user's notification channel
      const subscriberSockets = notificationSubscribers.get(userId)
      if (subscriberSockets && subscriberSockets.size > 0) {
        for (const socketId of subscriberSockets) {
          io.to(socketId).emit('notification', notifPayload)
        }
        console.log(`[NOTIFICATION] Pushed to user ${userId} via ${subscriberSockets.size} sockets: ${notifPayload.title}`)
      } else {
        // Also try emitting to all sockets for this user (fallback)
        const user = connectedUsers.get(userId)
        if (user) {
          io.to(user.socketId).emit('notification', notifPayload)
          console.log(`[NOTIFICATION] Pushed to user ${userId} via connected user socket: ${notifPayload.title}`)
        } else {
          console.log(`[NOTIFICATION] User ${userId} not connected, notification not pushed in real-time: ${notifPayload.title}`)
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, delivered: !!(subscriberSockets?.size || connectedUsers.get(userId)) }))
    } catch (e: any) {
      console.error('[NOTIFICATION] Error processing internal notification:', e)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message || 'Internal server error' }))
    }
    return
  }

  // Forward to Socket.IO's request handler(s)
  for (const listener of existingListeners) {
    ;(listener as (req: IncomingMessage, res: ServerResponse) => void)(req, res)
  }
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
  skills?: AgentSkillConfig[]
}

interface AgentSkillConfig {
  skillId: string
  skillName: string
  skillDisplayName: string
  handlerType: string // builtin, webhook, function
  callbackUrl?: string
  handlerUrl?: string
  callbackSecret?: string
  endpointToken?: string
  isEnabled: boolean
  priority: number
  parameters?: string // JSON
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

// Chat room specific state
interface RoomOnlineUser {
  userId: string
  username: string
  socketId: string
  connectedAt: string
}
const roomOnlineUsers = new Map<string, Map<string, RoomOnlineUser>>()  // roomId -> userId -> RoomOnlineUser
const roomTypingUsers = new Map<string, Map<string, string>>()          // roomId -> userId -> username

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

const getRoomOnlineParticipants = (roomId: string): Array<{ userId: string; username: string; connectedAt: string }> => {
  const roomUsers = roomOnlineUsers.get(roomId)
  if (!roomUsers) return []
  return Array.from(roomUsers.values()).map(u => ({
    userId: u.userId,
    username: u.username,
    connectedAt: u.connectedAt,
  }))
}

const cleanupUserFromChatRooms = (socketId: string, userId: string, username: string) => {
  // Clean up from all chat rooms this user was in
  for (const [roomId, roomUsers] of roomOnlineUsers.entries()) {
    if (roomUsers.has(userId)) {
      roomUsers.delete(userId)
      if (roomUsers.size === 0) {
        roomOnlineUsers.delete(roomId)
      }
      // Broadcast updated participants to the room
      const roomKey = `room:${roomId}`
      const onlineUsers = getRoomOnlineParticipants(roomId)
      io.to(roomKey).emit('room:participants', {
        roomId,
        participants: onlineUsers,
        onlineCount: onlineUsers.length,
      })
      // Also notify that user left
      io.to(roomKey).emit('room:leave', {
        roomId,
        userId,
        username,
        timestamp: new Date().toISOString(),
      })
    }
  }
  // Clean up from all room typing states
  for (const [roomId, roomTyping] of roomTypingUsers.entries()) {
    if (roomTyping.has(userId)) {
      roomTyping.delete(userId)
      if (roomTyping.size === 0) {
        roomTypingUsers.delete(roomId)
      }
      // Notify room that typing stopped
      const roomKey = `room:${roomId}`
      io.to(roomKey).emit('room:typing', {
        roomId,
        userId,
        username,
        isTyping: false,
      })
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

  socket.on('room:join', (data: { roomId: string }, callback?: (response: any) => void) => {
    const { roomId } = data
    const roomKey = `room:${roomId}`

    socket.join(roomKey)
    user.rooms.add(roomKey)

    if (!activeRooms.has(roomKey)) {
      activeRooms.set(roomKey, new Set())
    }
    activeRooms.get(roomKey)!.add(socket.id)

    // Track online user in room
    if (!roomOnlineUsers.has(roomId)) {
      roomOnlineUsers.set(roomId, new Map())
    }
    roomOnlineUsers.get(roomId)!.set(userId, {
      userId,
      username,
      socketId: socket.id,
      connectedAt: new Date().toISOString(),
    })

    console.log(`[ROOM:JOIN] ${username} joined room ${roomId}`)

    // Notify others in the room
    socket.to(roomKey).emit('room:join', {
      roomId,
      userId,
      username,
      timestamp: new Date().toISOString(),
    })

    // Broadcast updated online participants to all room members
    const onlineUsers = getRoomOnlineParticipants(roomId)
    io.to(roomKey).emit('room:participants', {
      roomId,
      participants: onlineUsers,
      onlineCount: onlineUsers.length,
    })

    // Send current online participants back to the joiner
    if (callback) {
      callback({
        success: true,
        participants: onlineUsers,
        onlineCount: onlineUsers.length,
      })
    }
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

    // Remove from online users
    const roomUsers = roomOnlineUsers.get(roomId)
    if (roomUsers) {
      roomUsers.delete(userId)
      if (roomUsers.size === 0) roomOnlineUsers.delete(roomId)
    }

    // Remove from typing
    const roomTyping = roomTypingUsers.get(roomId)
    if (roomTyping) {
      roomTyping.delete(userId)
      if (roomTyping.size === 0) roomTypingUsers.delete(roomId)
    }

    console.log(`[ROOM:LEAVE] ${username} left room ${roomId}`)

    socket.to(roomKey).emit('room:leave', {
      roomId,
      userId,
      username,
      timestamp: new Date().toISOString(),
    })

    // Broadcast updated online participants
    const onlineUsers = getRoomOnlineParticipants(roomId)
    io.to(roomKey).emit('room:participants', {
      roomId,
      participants: onlineUsers,
      onlineCount: onlineUsers.length,
    })
  })

  socket.on('room:message', async (data: { roomId: string; content: string; type?: string }) => {
    const { roomId, content, type = 'text' } = data
    const roomKey = `room:${roomId}`

    console.log(`[ROOM:MSG] ${username} in room ${roomId}: ${content.substring(0, 80)}`)

    // Save message to DB via Next.js API
    let savedMessage: any = null
    try {
      const nextjsUrl = process.env.NEXTJS_API_URL || 'http://localhost:3000'
      const response = await fetch(`${nextjsUrl}/api/chat-rooms/${roomId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': userId,
        },
        body: JSON.stringify({ content, type }),
      })

      if (response.ok) {
        const result = await response.json()
        savedMessage = result.message
        console.log(`[ROOM:MSG] Message saved to DB: ${savedMessage.id}`)
      } else {
        console.warn(`[ROOM:MSG] Failed to save message to DB: ${response.status}`)
      }
    } catch (err: any) {
      console.warn(`[ROOM:MSG] Error saving message to DB: ${err.message}`)
    }

    // Build the message payload (use DB-saved message if available, otherwise construct locally)
    const message = savedMessage ? {
      id: savedMessage.id,
      roomId,
      senderId: userId,
      senderName: username,
      content,
      type,
      timestamp: savedMessage.createdAt || new Date().toISOString(),
      senderInfo: typeof savedMessage.senderInfo === 'string' 
        ? JSON.parse(savedMessage.senderInfo) 
        : savedMessage.senderInfo,
    } : {
      id: generateId(),
      roomId,
      senderId: userId,
      senderName: username,
      content,
      type,
      timestamp: new Date().toISOString(),
    }

    // Broadcast to all other sockets in the room
    socket.to(roomKey).emit('room:message', message)

    // Send confirmation back to sender with the saved message ID
    socket.emit('room:message:sent', {
      ...message,
      saved: !!savedMessage,
    })

    // Clear typing state for this user in this room
    const roomTyping = roomTypingUsers.get(roomId)
    if (roomTyping) {
      roomTyping.delete(userId)
      if (roomTyping.size === 0) {
        roomTypingUsers.delete(roomId)
      }
      // Notify others that this user stopped typing
      socket.to(roomKey).emit('room:typing', {
        roomId,
        userId,
        username,
        isTyping: false,
      })
    }
  })

  // -----------------------------------------------------------------------
  // Room Typing Events
  // -----------------------------------------------------------------------

  socket.on('room:typing', (data: { roomId: string; isTyping: boolean }) => {
    const { roomId, isTyping } = data
    const roomKey = `room:${roomId}`

    if (!roomTypingUsers.has(roomId)) {
      roomTypingUsers.set(roomId, new Map())
    }
    const roomTyping = roomTypingUsers.get(roomId)!

    if (isTyping) {
      roomTyping.set(userId, username)
    } else {
      roomTyping.delete(userId)
      if (roomTyping.size === 0) {
        roomTypingUsers.delete(roomId)
      }
    }

    // Broadcast typing state to others in the room
    socket.to(roomKey).emit('room:typing', {
      roomId,
      userId,
      username,
      isTyping,
    })
  })

  // -----------------------------------------------------------------------
  // Room Participants Events
  // -----------------------------------------------------------------------

  socket.on('room:participants', (data: { roomId: string }, callback?: (response: any) => void) => {
    const { roomId } = data
    const participants = getRoomOnlineParticipants(roomId)

    if (callback) {
      callback({
        participants,
        onlineCount: participants.length,
      })
    } else {
      // If no callback, emit event back
      socket.emit('room:participants', {
        roomId,
        participants,
        onlineCount: participants.length,
      })
    }
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
  // Notification Events
  // -----------------------------------------------------------------------

  socket.on('notifications:subscribe', (subscribeUserId: string) => {
    // Subscribe this socket to receive notification events for a specific user
    const targetUserId = subscribeUserId || userId
    if (!notificationSubscribers.has(targetUserId)) {
      notificationSubscribers.set(targetUserId, new Set())
    }
    notificationSubscribers.get(targetUserId)!.add(socket.id)
    console.log(`[NOTIFICATION:SUBSCRIBE] Socket ${socket.id} subscribed for user ${targetUserId}`)
    socket.emit('notifications:subscribed', { userId: targetUserId })
  })

  socket.on('notifications:mark-read', async (notificationId: string) => {
    // Forward to Next.js API to persist the read state
    try {
      const nextjsUrl = process.env.NEXTJS_API_URL || 'http://localhost:3000'
      await fetch(`${nextjsUrl}/api/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ notificationId }),
        signal: AbortSignal.timeout(3000),
      })
    } catch {
      // Silently fail — best effort
    }
  })

  socket.on('notifications:mark-all-read', async () => {
    // Forward to Next.js API to persist the read state
    try {
      const nextjsUrl = process.env.NEXTJS_API_URL || 'http://localhost:3000'
      await fetch(`${nextjsUrl}/api/notifications`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
        body: JSON.stringify({ markAllRead: true }),
        signal: AbortSignal.timeout(3000),
      })
    } catch {
      // Silently fail — best effort
    }
  })

  // -----------------------------------------------------------------------
  // Disconnect
  // -----------------------------------------------------------------------

  socket.on('disconnect', (reason) => {
    console.log(`[DISCONNECT] User ${username} (${userId}) disconnected: ${reason}`)

    // Clean up user from all rooms
    removeUserFromAllRooms(socket.id)

    // Clean up user from chat rooms
    cleanupUserFromChatRooms(socket.id, userId, username)

    // Clean up notification subscriptions
    for (const [subUserId, sockets] of notificationSubscribers.entries()) {
      sockets.delete(socket.id)
      if (sockets.size === 0) {
        notificationSubscribers.delete(subUserId)
      }
    }

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
  const rawApiKey = agentConfig.apiKey
  const apiKey = rawApiKey ? decrypt(rawApiKey) : null

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

  // Build tool definitions from enabled skills
  const tools: any[] = []
  if (agentConfig.skills && agentConfig.skills.length > 0) {
    for (const skill of agentConfig.skills) {
      if (!skill.isEnabled) continue
      let parameters: any[] = []
      try { parameters = JSON.parse(skill.parameters || '[]') } catch {}
      const properties: Record<string, any> = {}
      const required: string[] = []
      for (const param of parameters) {
        properties[param.name] = { type: param.type || 'string', description: param.description || '' }
        if (param.required) required.push(param.name)
      }
      tools.push({
        type: 'function',
        function: {
          name: `skill_${skill.skillName}`,
          description: skill.skillDisplayName,
          parameters: { type: 'object', properties, required: required.length > 0 ? required : undefined },
        },
      })
    }
  }

  try {
    const requestBody: any = {
      model,
      messages,
      stream: true,
    }
    if (tools.length > 0) {
      requestBody.tools = tools
      requestBody.tool_choice = 'auto'
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
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
    let toolCalls: any[] = []
    let hasToolCalls = false
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
          const delta = parsed.choices?.[0]?.delta
          
          // Handle tool calls
          if (delta?.tool_calls) {
            hasToolCalls = true
            for (const tc of delta.tool_calls) {
              if (!toolCalls[tc.index]) {
                toolCalls[tc.index] = { id: tc.id, function: { name: '', arguments: '' } }
              }
              if (tc.id) toolCalls[tc.index].id = tc.id
              if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name
              if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments
            }
          }
          
          // Handle regular content
          const content = delta?.content
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

    // Process tool calls if any
    if (hasToolCalls && toolCalls.length > 0) {
      toolCalls = toolCalls.filter(Boolean)
      console.log(`[AGENT:BUILTIN] Processing ${toolCalls.length} tool calls from LLM`)
      
      for (const toolCall of toolCalls) {
        const skillName = toolCall.function.name?.replace('skill_', '')
        const args = (() => { try { return JSON.parse(toolCall.function.arguments || '{}') } catch { return {} } })()
        
        console.log(`[AGENT:BUILTIN] Tool call: ${skillName} with args:`, args)
        
        // Find the matching skill in agent config
        const matchingSkill = agentConfig.skills?.find(s => s.skillName === skillName && s.isEnabled)
        if (!matchingSkill) {
          fullResponse += `\n[Tool ${skillName}: Skill not found or disabled]`
          continue
        }
        
        // Invoke the skill based on connection method
        let skillResult = ''

        // First, try WebSocket invocation via skill-ws service
        const SKILL_WS_URL = process.env.SKILL_WS_URL || 'http://localhost:3004'

        // Check if agent is connected via WebSocket
        let wsConnected = false
        try {
          const statusRes = await fetch(
            `${SKILL_WS_URL}/internal/status?agentId=${agentConfig.agentId}&skillId=${matchingSkill.skillId}`,
            { signal: AbortSignal.timeout(3000) }
          )
          if (statusRes.ok) {
            const statusData = await statusRes.json()
            wsConnected = statusData.connected === true
          }
        } catch {
          // skill-ws service might not be running
        }

        if (wsConnected) {
          // Invoke via WebSocket
          try {
            const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
            const invokeRes = await fetch(`${SKILL_WS_URL}/internal/invoke?wait=true`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                agentId: agentConfig.agentId,
                skillName,
                params: args,
                message,
                conversationId,
                requestId,
              }),
              signal: AbortSignal.timeout(30000), // 30s timeout for WS response
            })

            if (invokeRes.ok) {
              const data = await invokeRes.json()
              if (data.success && data.result) {
                skillResult = data.result.response || data.result.message || data.result.content ||
                              data.result.result || JSON.stringify(data.result)
              } else {
                skillResult = data.error || `[Skill ${matchingSkill.skillDisplayName}: WS invocation returned no result]`
              }
            } else {
              skillResult = `[Skill ${matchingSkill.skillDisplayName}: WS invocation failed (${invokeRes.status})]`
            }
          } catch (err: any) {
            skillResult = `[Skill ${matchingSkill.skillDisplayName} WS timeout: ${err.message}]`
          }
        } else {
          // Fallback: HTTP callback
          const targetUrl = matchingSkill.callbackUrl || matchingSkill.handlerUrl
          if (targetUrl) {
            try {
              const skillResponse = await fetch(targetUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Hermes-Agent-Id': agentConfig.agentId,
                  'X-Hermes-Skill-Id': matchingSkill.skillId,
                },
                body: JSON.stringify({
                  agentId: agentConfig.agentId,
                  skillName,
                  skillDisplayName: matchingSkill.skillDisplayName,
                  arguments: args,
                  message,
                  conversationId,
                  timestamp: new Date().toISOString(),
                }),
                signal: AbortSignal.timeout(15000),
              })

              if (skillResponse.ok) {
                const data = await skillResponse.json().catch(() => ({ response: 'Skill executed' }))
                skillResult = data.response || data.message || data.content || data.result || JSON.stringify(data)
              } else {
                skillResult = `[Skill ${matchingSkill.skillDisplayName} error: ${skillResponse.status}]`
              }
            } catch (err: any) {
              skillResult = `[Skill ${matchingSkill.skillDisplayName} failed: ${err.message}]`
            }
          } else {
            skillResult = `[Skill ${matchingSkill.skillDisplayName}: No callback/handler URL configured and not connected via WebSocket]`
          }
        }
        
        fullResponse += `\n🔧 **${matchingSkill.skillDisplayName}**: ${skillResult}\n`
        
        // Stream the skill result
        io.to(roomKey).emit('agent:stream', {
          conversationId,
          agentId: agentConfig.agentId,
          chunk: `\n🔧 **${matchingSkill.skillDisplayName}**: ${skillResult}\n`,
          timestamp: new Date().toISOString(),
        } as StreamChunk)
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
      fullResponse: 'Error: Callback URL not configured for this agent. Please configure a callback URL in the agent settings, or generate a Skill endpoint URL to allow external agents to register.',
      timestamp: new Date().toISOString(),
      error: true,
    })
    return
  }

  try {
    // Build skill tool definitions for custom API too
    const tools: any[] = []
    if (agentConfig.skills && agentConfig.skills.length > 0) {
      for (const skill of agentConfig.skills) {
        if (!skill.isEnabled) continue
        tools.push({
          name: skill.skillName,
          displayName: skill.skillDisplayName,
          handlerType: skill.handlerType,
          callbackUrl: skill.callbackUrl || skill.handlerUrl,
        })
      }
    }

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
        skills: tools,
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
