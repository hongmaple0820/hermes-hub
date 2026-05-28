/**
 * Hermes Agent Runtime v3 — Main Entry Point
 *
 * Socket.IO server + HTTP internal API on port 3003.
 *
 * Backward compatible with:
 *   - Legacy `agent:message` event (bridged to new runtime)
 *   - Legacy `chat:join/leave/message/typing` events
 *   - `thread:join/leave/message` events (new runtime)
 *   - `run:cancel` event
 *
 * New events:
 *   - `run:steer` — Steer/interrupt an active run
 *   - `run:follow-up` — Queue follow-up work
 *   - `provider:models` — List available models for a provider
 *   - `provider:list` — List all supported providers
 *
 * HTTP endpoints:
 *   - POST /internal/execute-run — Trigger run execution
 *   - GET  /internal/run-status — Get run status
 *   - GET  /internal/health — Health check
 *   - GET  /internal/providers — List supported providers
 *   - GET  /internal/providers/:provider/models — List models for a provider
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'
import {
  type ConnectedUser,
  type ChatMessage,
  type AgentMessagePayload,
  type StreamChunk,
  type StreamCompletePayload,
  type ExecuteRunRequest,
  type HealthResponse,
  type ProviderInfo,
} from './types'
import {
  executeRun,
  steerRun,
  followUpRun,
  abortRun,
  getRunStatus,
  getActiveRunCount,
  getActiveRunForThread,
  handleLegacyAgentMessage,
  shutdownAllRuns,
} from './runtime'
import {
  listProviders,
  listModelsForProvider,
  resolvePiProvider,
  preloadProviderData,
} from './provider-adapter'

// ============================================================================
// Configuration
// ============================================================================

const PORT = 3003
const NEXTJS_API_URL = process.env.NEXTJS_API_URL || 'http://localhost:3000'

// ============================================================================
// Check Pi Availability
// ============================================================================

let piAgentCoreAvailable = false
let piAiAvailable = false

async function checkPiAvailability(): Promise<void> {
  try {
    const piAi = await import('@earendil-works/pi-ai')
    piAiAvailable = typeof piAi.getModel === 'function'
    console.log(`[PI] pi-ai available: ${piAiAvailable}`)
  } catch (err: any) {
    console.warn(`[PI] pi-ai not available: ${err.message}`)
  }

  try {
    const piAgentCore = await import('@earendil-works/pi-agent-core')
    piAgentCoreAvailable = typeof piAgentCore.Agent === 'function'
    console.log(`[PI] pi-agent-core available: ${piAgentCoreAvailable}`)
  } catch (err: any) {
    console.warn(`[PI] pi-agent-core not available: ${err.message}`)
  }
}

checkPiAvailability()

// ============================================================================
// Pre-load Provider Data
// ============================================================================

preloadProviderData()

// ============================================================================
// In-Memory State
// ============================================================================

const connectedUsers = new Map<string, ConnectedUser>()
const socketToUser = new Map<string, string>()
const activeRooms = new Map<string, Set<string>>()
const typingUsers = new Map<string, Set<string>>()

// ============================================================================
// HTTP Server & Socket.IO Setup
// ============================================================================

// We need Socket.IO and HTTP API to coexist on the same port.
// The challenge: Socket.IO with path '/' intercepts ALL HTTP requests.
// Solution: Use Socket.IO's default path (/socket.io/) for the WS protocol,
// but configure the Caddyfile to route both paths. However, since we must
// use path '/' for Caddy compat, we use a different strategy:
//
// 1. Create HTTP server
// 2. Install Socket.IO
// 3. Override the request listener to intercept /internal/* and /health
//    before Socket.IO gets them

const httpServer = createServer()

const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Now Socket.IO has installed its request handler. We need to intercept
// /internal/* and /health requests BEFORE Socket.IO processes them.
// Socket.IO adds its own request listener, so we need to prepend ours.
const socketIOListener = httpServer.listeners('request').slice()
httpServer.removeAllListeners('request')
httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
  const urlPath = (req.url || '/').split('?')[0]

  // Handle our API paths first
  if (urlPath.startsWith('/internal/') || urlPath === '/health') {
    handleHttpRequest(req, res)
    return
  }

  // Let Socket.IO handle everything else
  for (const listener of socketIOListener) {
    ;(listener as (req: IncomingMessage, res: ServerResponse) => void)(req, res)
  }
})

// ============================================================================
// Helpers
// ============================================================================

const generateId = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36)

const getRoomMembers = (roomId: string): string[] => {
  const members = activeRooms.get(roomId)
  return members ? Array.from(members) : []
}

const removeUserFromAllRooms = (socketId: string) => {
  for (const [roomId, members] of activeRooms.entries()) {
    if (members.has(socketId)) {
      members.delete(socketId)
      if (members.size === 0) activeRooms.delete(roomId)
      const typing = typingUsers.get(roomId)
      if (typing) {
        const userId = socketToUser.get(socketId)
        if (userId) {
          typing.delete(userId)
          if (typing.size === 0) typingUsers.delete(roomId)
        }
      }
    }
  }
}

const startTime = Date.now()

// ============================================================================
// Authentication Middleware
// ============================================================================

io.use((socket, next) => {
  const userId = socket.handshake.auth.userId
  const username = socket.handshake.auth.username

  if (!userId) {
    return next(new Error('Authentication error: userId is required'))
  }

  socket.data.userId = userId
  socket.data.username = username || `User-${userId.substring(0, 6)}`

  next()
})

// ============================================================================
// Socket.IO Connection Handler
// ============================================================================

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

  // Send connected info
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

  // ======================================================================
  // Legacy Chat Events (backward compatible with chat-service)
  // ======================================================================

  socket.on('chat:join', (data: { conversationId: string }) => {
    const { conversationId } = data
    const roomKey = `chat:${conversationId}`
    socket.join(roomKey)
    user.rooms.add(roomKey)
    if (!activeRooms.has(roomKey)) activeRooms.set(roomKey, new Set())
    activeRooms.get(roomKey)!.add(socket.id)

    socket.to(roomKey).emit('chat:join', {
      conversationId,
      userId,
      username,
      timestamp: new Date().toISOString(),
    })

    const memberIds = getRoomMembers(roomKey)
      .map((sid) => socketToUser.get(sid))
      .filter(Boolean)

    socket.emit('chat:members', { conversationId, members: memberIds })
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

    const typing = typingUsers.get(roomKey)
    if (typing) {
      typing.delete(userId)
      if (typing.size === 0) typingUsers.delete(roomKey)
    }

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

    io.to(roomKey).emit('chat:message', message)

    // Clear typing state
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

    if (!typingUsers.has(roomKey)) typingUsers.set(roomKey, new Set())
    const typing = typingUsers.get(roomKey)!

    if (isTyping) typing.add(userId)
    else typing.delete(userId)

    if (typing.size === 0) typingUsers.delete(roomKey)

    socket.to(roomKey).emit('chat:typing', {
      conversationId,
      typingUsers: Array.from(typing),
    })
  })

  // ======================================================================
  // Legacy Agent Events (backward compatible, bridged to new runtime)
  // ======================================================================

  socket.on('agent:message', async (data: AgentMessagePayload) => {
    console.log(`[AGENT:MSG] User ${username} sent message to agent ${data.agentConfig.name}`)
    await handleLegacyAgentMessage(io, data)
  })

  // ======================================================================
  // Presence Events
  // ======================================================================

  socket.on('presence:update', (data: { status: 'online' | 'offline' | 'busy' }) => {
    const { status } = data
    const u = connectedUsers.get(userId)
    if (u) u.status = status

    io.emit('presence:update', {
      userId,
      username,
      status,
      timestamp: new Date().toISOString(),
    })
  })

  // ======================================================================
  // Thread Events (new runtime)
  // ======================================================================

  socket.on('thread:join', (data: { threadId: string }) => {
    const { threadId } = data
    const roomKey = `thread:${threadId}`
    socket.join(roomKey)
    user.rooms.add(roomKey)

    if (!activeRooms.has(roomKey)) activeRooms.set(roomKey, new Set())
    activeRooms.get(roomKey)!.add(socket.id)

    console.log(`[THREAD:JOIN] ${username} joined thread ${threadId}`)
    socket.emit('thread:joined', { threadId })
  })

  socket.on('thread:leave', (data: { threadId: string }) => {
    const { threadId } = data
    const roomKey = `thread:${threadId}`
    socket.leave(roomKey)
    user.rooms.delete(roomKey)

    const members = activeRooms.get(roomKey)
    if (members) {
      members.delete(socket.id)
      if (members.size === 0) activeRooms.delete(roomKey)
    }

    console.log(`[THREAD:LEAVE] ${username} left thread ${threadId}`)
    socket.emit('thread:left', { threadId })
  })

  socket.on('thread:message', async (data: { threadId: string; content: string; runId?: string }) => {
    const { threadId, content, runId: existingRunId } = data
    const roomKey = `thread:${threadId}`

    console.log(`[THREAD:MSG] ${username} in thread ${threadId}: ${content.substring(0, 80)}`)

    // If there's already an active run for this thread, steer it
    const activeRunId = getActiveRunForThread(threadId)
    if (activeRunId) {
      const steered = steerRun(activeRunId, content)
      if (steered) {
        io.to(roomKey).emit('run:stream', {
          runId: activeRunId,
          threadId,
          delta: `\n[User interrupted with new message: "${content.substring(0, 100)}"]\n`,
          timestamp: new Date().toISOString(),
        })
        return
      }
    }

    // Otherwise, we need the agent/provider config from the Next.js API
    // to create a new run. For now, emit back that we need the client
    // to use the HTTP API to trigger the run.
    // In the future, we could fetch the config from the DB here.
    socket.emit('run:error', {
      runId: 'pending',
      threadId,
      error: 'Thread message received. Use POST /internal/execute-run to start a run with proper configuration.',
      timestamp: new Date().toISOString(),
    })
  })

  // ======================================================================
  // Run Events (new runtime)
  // ======================================================================

  socket.on('run:cancel', (data: { runId: string; threadId: string }) => {
    const { runId, threadId } = data
    const cancelled = abortRun(runId)
    const roomKey = `thread:${threadId}`

    if (cancelled) {
      io.to(roomKey).emit('run:complete', {
        runId,
        threadId,
        status: 'cancelled',
        inputTokens: 0,
        outputTokens: 0,
        timestamp: new Date().toISOString(),
      })
      console.log(`[RUN:CANCEL] Run ${runId} cancelled by ${username}`)
    }
  })

  socket.on('run:steer', (data: { runId: string; threadId: string; content: string }) => {
    const { runId, threadId, content } = data
    const steered = steerRun(runId, content)
    const roomKey = `thread:${threadId}`

    if (steered) {
      io.to(roomKey).emit('run:stream', {
        runId,
        threadId,
        delta: `\n[User steered: "${content.substring(0, 100)}"]\n`,
        timestamp: new Date().toISOString(),
      })
      console.log(`[RUN:STEER] Run ${runId} steered by ${username}`)
    }
  })

  socket.on('run:follow-up', (data: { runId: string; threadId: string; content: string }) => {
    const { runId, threadId, content } = data
    const queued = followUpRun(runId, content)

    if (queued) {
      console.log(`[RUN:FOLLOW-UP] Follow-up queued for run ${runId} by ${username}`)
    }
  })

  // ======================================================================
  // Provider Discovery Events
  // ======================================================================

  socket.on('provider:list', () => {
    const providers = listProviders()
    socket.emit('provider:list', { providers: providers.map((p) => p.id) })
  })

  socket.on('provider:models', (data: { provider: string }) => {
    const piProvider = resolvePiProvider(data.provider)
    const models = listModelsForProvider(piProvider)
    socket.emit('provider:models', { provider: data.provider, models })
  })

  // ======================================================================
  // Disconnect
  // ======================================================================

  socket.on('disconnect', (reason) => {
    console.log(`[DISCONNECT] User ${username} (${userId}) disconnected: ${reason}`)
    removeUserFromAllRooms(socket.id)
    connectedUsers.delete(userId)
    socketToUser.delete(socket.id)
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

// ============================================================================
// Internal HTTP API
// ============================================================================

async function handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
  try {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`)
    const path = url.pathname

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

  // ====================================================================
  // GET /health
  // ====================================================================

  if (path === '/health' && req.method === 'GET') {
    const health: HealthResponse = {
      status: piAiAvailable && piAgentCoreAvailable ? 'ok' : 'degraded',
      version: '3.0.0',
      uptime: Date.now() - startTime,
      activeRuns: getActiveRunCount(),
      piAvailable: piAgentCoreAvailable,
      piAiAvailable,
      piAgentCoreAvailable,
    }
    jsonResponse(res, 200, health)
    return
  }

  // ====================================================================
  // GET /internal/health
  // ====================================================================

  if (path === '/internal/health' && req.method === 'GET') {
    const health: HealthResponse = {
      status: piAiAvailable && piAgentCoreAvailable ? 'ok' : 'degraded',
      version: '3.0.0',
      uptime: Date.now() - startTime,
      activeRuns: getActiveRunCount(),
      piAvailable: piAgentCoreAvailable,
      piAiAvailable,
      piAgentCoreAvailable,
    }
    jsonResponse(res, 200, health)
    return
  }

  // ====================================================================
  // POST /internal/execute-run
  // ====================================================================

  if (path === '/internal/execute-run' && req.method === 'POST') {
    try {
      const body = await readRequestBody(req)
      const request = JSON.parse(body) as ExecuteRunRequest

      // Validate required fields
      if (!request.threadId || !request.agentId || !request.userId || !request.message) {
        jsonResponse(res, 400, { error: 'Missing required fields: threadId, agentId, userId, message' })
        return
      }

      if (!request.providerConfig) {
        jsonResponse(res, 400, { error: 'Missing providerConfig' })
        return
      }

      const result = await executeRun(io, request)
      jsonResponse(res, 200, result)
    } catch (err: any) {
      console.error('[HTTP:EXECUTE-RUN] Error:', err.message)
      jsonResponse(res, 500, { error: err.message || 'Internal server error' })
    }
    return
  }

  // ====================================================================
  // GET /internal/run-status
  // ====================================================================

  if (path === '/internal/run-status' && req.method === 'GET') {
    try {
      const runId = url.searchParams.get('runId')
      if (!runId) {
        jsonResponse(res, 400, { error: 'Missing runId parameter' })
        return
      }

      const run = getRunStatus(runId)
      if (!run) {
        jsonResponse(res, 404, { error: 'Run not found' })
        return
      }

      jsonResponse(res, 200, {
        runId: run.runId,
        threadId: run.threadId,
        status: run.status,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        totalSteps: run.totalSteps,
      })
    } catch (err: any) {
      console.error('[HTTP:RUN-STATUS] Error:', err.message)
      jsonResponse(res, 500, { error: err.message || 'Failed to get run status' })
    }
    return
  }

  // ====================================================================
  // GET /internal/providers
  // ====================================================================

  if (path === '/internal/providers' && req.method === 'GET') {
    try {
      const providers = listProviders()
      jsonResponse(res, 200, { providers })
    } catch (err: any) {
      console.error('[HTTP:PROVIDERS] Error:', err.message)
      jsonResponse(res, 500, { error: err.message || 'Failed to list providers' })
    }
    return
  }

  // ====================================================================
  // GET /internal/providers/:provider/models
  // ====================================================================

  const providerModelsMatch = path.match(/^\/internal\/providers\/([^/]+)\/models$/)
  if (providerModelsMatch && req.method === 'GET') {
    try {
      const providerName = providerModelsMatch[1]
      const piProvider = resolvePiProvider(providerName)
      const models = listModelsForProvider(piProvider)
      jsonResponse(res, 200, { provider: providerName, piProvider, models })
    } catch (err: any) {
      console.error('[HTTP:PROVIDER-MODELS] Error:', err.message)
      jsonResponse(res, 500, { error: err.message || 'Failed to list models' })
    }
    return
  }

  // ====================================================================
  // 404 — Not Found
  // ====================================================================

  jsonResponse(res, 404, { error: 'Not found' })
  } catch (err: any) {
    console.error('[HTTP] Unhandled error:', err.message || err)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
    }
    if (!res.writableEnded) {
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }))
    }
  }
}

// ============================================================================
// HTTP Helpers
// ============================================================================

function jsonResponse(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

// ============================================================================
// Start Server
// ============================================================================

httpServer.listen(PORT, () => {
  console.log(`[Hermes Agent Runtime v3] Running on port ${PORT}`)
  console.log(`[Hermes Agent Runtime v3] pi-ai: ${piAiAvailable ? '✓' : '✗'}, pi-agent-core: ${piAgentCoreAvailable ? '✓' : '✗'}`)
  console.log(`[Hermes Agent Runtime v3] Ready to accept connections`)
})

// ============================================================================
// Graceful Shutdown
// ============================================================================

const shutdown = () => {
  console.log('[Hermes Agent Runtime v3] Shutting down...')

  // Abort all active runs
  shutdownAllRuns()

  io.disconnectSockets(true)
  httpServer.close(() => {
    console.log('[Hermes Agent Runtime v3] Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Prevent unhandled errors from crashing the process
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason)
})
