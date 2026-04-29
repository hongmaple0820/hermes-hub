/**
 * Hermes Skill WebSocket Service
 *
 * Dedicated Socket.IO WebSocket server for the Skill Plugin Protocol on port 3004.
 * External agents connect via WebSocket using an endpoint token and can:
 *   - Receive events (tool_call, message, command) from the hub
 *   - Send events (tool_result, message, status, heartbeat) to the hub
 *   - Maintain persistent connections with automatic heartbeat
 *   - Get real-time bidirectional communication
 *
 * Architecture:
 *   External Agent → WebSocket → skill-ws (port 3004) ↔ Next.js API/DB
 *                                       ↕
 *                                 chat-service (port 3003)
 *                                       ↕
 *                                 Frontend (user chat)
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectedAgent {
  socketId: string
  agentId: string
  skillId?: string
  pluginId?: string
  bindingType: 'agent_skill' | 'agent_plugin' | 'agent_connection'
  endpointToken: string
  connectedAt: Date
  lastHeartbeat: Date
  capabilities: string[]
  name?: string
  version?: string
  platform?: string
}

interface RegistrationData {
  name: string
  version?: string
  capabilities?: string[]
  platform?: string
  metadata?: any
}

interface HeartbeatData {
  status?: string
  metrics?: {
    cpu?: number
    memory?: number
    uptime?: number
    taskCount?: number
  }
}

interface SkillEventData {
  type: 'message' | 'tool_result' | 'status' | 'command'
  data: any
  requestId?: string
}

interface InvokeResponseData {
  requestId: string
  result: any
  error?: string
}

interface InvokePayload {
  agentId: string
  skillName: string
  params: any
  message: string
  conversationId: string
  requestId: string
}

interface PendingToolCall {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timeout: ReturnType<typeof setTimeout>
  createdAt: Date
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = 3004
const NEXTJS_API_URL = process.env.NEXTJS_API_URL || 'http://localhost:3000'
const HEARTBEAT_INTERVAL = 30 // seconds
const TOOL_CALL_TIMEOUT = 30000 // 30s timeout for tool call responses

// ---------------------------------------------------------------------------
// In-Memory State
// ---------------------------------------------------------------------------

/** Map of agent tracking key (agentId:skillId or agentId:pluginId) → ConnectedAgent */
const connectedAgents = new Map<string, ConnectedAgent>()

/** Map of socketId → tracking key */
const socketToKey = new Map<string, string>()

/** Map of requestId → PendingToolCall for pending tool call promises */
const pendingToolCalls = new Map<string, PendingToolCall>()

// ---------------------------------------------------------------------------
// HTTP Server & Socket.IO Setup
// ---------------------------------------------------------------------------

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

// Prepend our HTTP request handler BEFORE Socket.IO's handler so that
// /internal/* and /health paths are handled by us, not Socket.IO.
// Socket.IO with path: '/' would otherwise intercept ALL requests.
const existingListeners = httpServer.listeners('request').slice()
httpServer.removeAllListeners('request')
httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
  const urlPath = (req.url || '/').split('?')[0]
  if (urlPath.startsWith('/internal/') || urlPath === '/health') {
    handleHttpRequest(req, res)
  } else {
    // Pass to Socket.IO's request handler(s)
    for (const listener of existingListeners) {
      ;(listener as (req: IncomingMessage, res: ServerResponse) => void)(req, res)
    }
  }
})

// ---------------------------------------------------------------------------
// Authentication Middleware
// ---------------------------------------------------------------------------

io.use(async (socket, next) => {
  const endpointToken = socket.handshake.auth.endpointToken

  if (!endpointToken) {
    console.warn(`[AUTH] Connection rejected: no endpointToken provided (socket: ${socket.id})`)
    return next(new Error('Authentication error: endpointToken is required'))
  }

  try {
    const response = await fetch(
      `${NEXTJS_API_URL}/api/skill-protocol/validate?token=${encodeURIComponent(endpointToken)}`,
    )

    if (!response.ok) {
      console.warn(`[AUTH] Token validation failed (${response.status}) for socket ${socket.id}`)
      return next(new Error('Authentication error: invalid endpoint token'))
    }

    const data = await response.json()

    if (!data.valid) {
      console.warn(`[AUTH] Token invalid for socket ${socket.id}: ${data.error}`)
      return next(new Error(`Authentication error: ${data.error || 'invalid token'}`))
    }

    // Store binding info on socket.data
    socket.data = {
      endpointToken,
      agentId: data.agentId,
      bindingType: data.bindingType,
      skillId: data.skillId || undefined,
      pluginId: data.pluginId || undefined,
      skillName: data.skillName || undefined,
      connectionId: data.connectionId || undefined,
      isEnabled: data.isEnabled,
    }

    console.log(
      `[AUTH] Socket ${socket.id} authenticated: agentId=${data.agentId}, bindingType=${data.bindingType}` +
        (data.skillId ? `, skillId=${data.skillId}` : '') +
        (data.pluginId ? `, pluginId=${data.pluginId}` : ''),
    )

    next()
  } catch (err: any) {
    console.error(`[AUTH] Validation request failed for socket ${socket.id}:`, err.message)
    next(new Error('Authentication error: validation service unavailable'))
  }
})

// ---------------------------------------------------------------------------
// Socket.IO Event Handlers
// ---------------------------------------------------------------------------

io.on('connection', (socket: Socket) => {
  const { endpointToken, agentId, bindingType, skillId, pluginId } = socket.data

  // Build the tracking key
  const trackingKey = skillId
    ? `${agentId}:${skillId}`
    : pluginId
      ? `${agentId}:${pluginId}`
      : `${agentId}:connection`

  console.log(`[CONNECT] Agent connected: ${trackingKey} (socket: ${socket.id})`)

  // Check if there's an existing connection for this agent and disconnect it
  const existing = connectedAgents.get(trackingKey)
  if (existing) {
    console.log(
      `[CONNECT] Replacing existing connection for ${trackingKey} (old socket: ${existing.socketId})`,
    )
    const existingSocket = io.sockets.sockets.get(existing.socketId)
    if (existingSocket) {
      existingSocket.emit('skill:notification', {
        type: 'replaced',
        data: { reason: 'New connection established for the same binding' },
      })
      existingSocket.disconnect(true)
    }
  }

  // Register the connected agent
  const connectedAgent: ConnectedAgent = {
    socketId: socket.id,
    agentId,
    skillId,
    pluginId,
    bindingType,
    endpointToken,
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
    capabilities: [],
  }
  connectedAgents.set(trackingKey, connectedAgent)
  socketToKey.set(socket.id, trackingKey)

  // Update DB connection status
  updateConnectionStatus(endpointToken, 'connected').catch((err) =>
    console.error(`[CONNECT] Failed to update DB status for ${trackingKey}:`, err.message),
  )

  // -----------------------------------------------------------------------
  // skill:register — Agent → Server
  // -----------------------------------------------------------------------

  socket.on('skill:register', async (data: RegistrationData) => {
    console.log(
      `[REGISTER] ${trackingKey}: name=${data.name}, version=${data.version}, capabilities=${data.capabilities?.join(',')}`,
    )

    // Update connected agent info
    const agent = connectedAgents.get(trackingKey)
    if (agent) {
      agent.name = data.name
      agent.version = data.version
      agent.capabilities = data.capabilities || []
      agent.platform = data.platform
      agent.lastHeartbeat = new Date()
    }

    // Update DB via Next.js API
    try {
      await fetch(`${NEXTJS_API_URL}/api/skill-protocol/ws-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointToken,
          status: 'connected',
          agentInfo: {
            name: data.name,
            version: data.version,
            capabilities: data.capabilities,
            platform: data.platform,
            metadata: data.metadata,
          },
        }),
      })
    } catch (err: any) {
      console.error(`[REGISTER] Failed to update DB for ${trackingKey}:`, err.message)
    }

    socket.emit('skill:registered', {
      success: true,
      heartbeatInterval: HEARTBEAT_INTERVAL,
      events: ['message', 'command', 'status', 'tool_result', 'tool_call', 'heartbeat'],
      serverTime: new Date().toISOString(),
    })

    console.log(`[REGISTER] ${trackingKey} registered successfully`)
  })

  // -----------------------------------------------------------------------
  // skill:heartbeat — Agent → Server
  // -----------------------------------------------------------------------

  socket.on('skill:heartbeat', async (data: HeartbeatData) => {
    const agent = connectedAgents.get(trackingKey)
    if (agent) {
      agent.lastHeartbeat = new Date()
    }

    // Update DB via Next.js heartbeat API
    try {
      await fetch(`${NEXTJS_API_URL}/api/skill-protocol/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointToken,
          status: data.status || 'online',
          metrics: data.metrics,
        }),
      })
    } catch (err: any) {
      console.error(`[HEARTBEAT] Failed to update DB for ${trackingKey}:`, err.message)
    }

    socket.emit('skill:heartbeat-ack', {
      timestamp: new Date().toISOString(),
      nextInterval: HEARTBEAT_INTERVAL,
    })
  })

  // -----------------------------------------------------------------------
  // skill:event — Agent → Server
  // -----------------------------------------------------------------------

  socket.on('skill:event', async (data: SkillEventData) => {
    console.log(
      `[EVENT] ${trackingKey}: type=${data.type}${data.requestId ? `, requestId=${data.requestId}` : ''}`,
    )

    const eventId = crypto.randomUUID()

    try {
      switch (data.type) {
        case 'message': {
          // External agent sent a message — create in conversation
          const { conversationId, content, senderName } = data.data
          if (conversationId && content) {
            await fetch(`${NEXTJS_API_URL}/api/conversations/${conversationId}/messages`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                content,
                senderType: 'agent',
                senderName: senderName || connectedAgent.name || 'External Agent',
                type: 'text',
                metadata: JSON.stringify({
                  source: 'skill_ws',
                  eventId,
                  agentId,
                  skillId,
                  pluginId,
                  bindingType,
                }),
              }),
            })
          }
          break
        }

        case 'tool_result': {
          // External agent returned a tool execution result
          const { requestId } = data
          if (requestId && pendingToolCalls.has(requestId)) {
            // Resolve the pending tool call promise
            const pending = pendingToolCalls.get(requestId)!
            clearTimeout(pending.timeout)
            pendingToolCalls.delete(requestId)

            if (data.data?.error) {
              pending.reject(new Error(data.data.error))
            } else {
              pending.resolve(data.data)
            }

            console.log(`[EVENT] Resolved pending tool call: ${requestId}`)
          } else {
            // No pending call — store in DB via events API
            await fetch(`${NEXTJS_API_URL}/api/skill-protocol/events`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                endpointToken,
                event: {
                  type: 'tool_result',
                  data: data.data,
                  timestamp: new Date().toISOString(),
                  source: 'external',
                },
              }),
            })
          }
          break
        }

        case 'status': {
          // External agent status update
          const { status } = data.data
          await fetch(`${NEXTJS_API_URL}/api/skill-protocol/ws-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpointToken,
              status: status === 'online' ? 'connected' : status,
            }),
          })
          break
        }

        case 'command': {
          // External agent sent a command — forward to events API
          await fetch(`${NEXTJS_API_URL}/api/skill-protocol/events`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpointToken,
              event: {
                type: 'command',
                data: data.data,
                timestamp: new Date().toISOString(),
                source: 'external',
              },
            }),
          })
          break
        }

        default:
          console.warn(`[EVENT] Unknown event type from ${trackingKey}: ${data.type}`)
      }
    } catch (err: any) {
      console.error(`[EVENT] Error processing event from ${trackingKey}:`, err.message)
    }

    socket.emit('skill:event-ack', {
      success: true,
      eventId,
      timestamp: new Date().toISOString(),
    })
  })

  // -----------------------------------------------------------------------
  // skill:invoke-response — Agent → Server
  // -----------------------------------------------------------------------

  socket.on('skill:invoke-response', (data: InvokeResponseData) => {
    console.log(
      `[INVOKE-RESPONSE] ${trackingKey}: requestId=${data.requestId}` +
        (data.error ? `, error=${data.error}` : ', success'),
    )

    const pending = pendingToolCalls.get(data.requestId)
    if (pending) {
      clearTimeout(pending.timeout)
      pendingToolCalls.delete(data.requestId)

      if (data.error) {
        pending.reject(new Error(data.error))
      } else {
        pending.resolve(data.result)
      }
    } else {
      console.warn(
        `[INVOKE-RESPONSE] No pending call found for requestId=${data.requestId}`,
      )
    }
  })

  // -----------------------------------------------------------------------
  // Disconnect
  // -----------------------------------------------------------------------

  socket.on('disconnect', (reason) => {
    console.log(`[DISCONNECT] ${trackingKey} disconnected: ${reason}`)

    // Remove from tracking
    connectedAgents.delete(trackingKey)
    socketToKey.delete(socket.id)

    // Update DB status to disconnected
    updateConnectionStatus(endpointToken, 'disconnected').catch((err) =>
      console.error(
        `[DISCONNECT] Failed to update DB status for ${trackingKey}:`,
        err.message,
      ),
    )
  })

  socket.on('error', (error) => {
    console.error(`[ERROR] Socket error for ${trackingKey} (${socket.id}):`, error)
  })
})

// ---------------------------------------------------------------------------
// Internal HTTP API (for chat-service to call)
// ---------------------------------------------------------------------------

async function handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`)
  const path = url.pathname

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // -----------------------------------------------------------------------
  // POST /internal/invoke — Trigger a skill invocation on a connected agent
  // -----------------------------------------------------------------------

  if (path === '/internal/invoke' && req.method === 'POST') {
    try {
      const body = await readRequestBody(req)
      const { agentId, skillName, params, message, conversationId, requestId } =
        JSON.parse(body) as InvokePayload

      if (!agentId || !skillName || !requestId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            error: 'Missing required fields: agentId, skillName, requestId',
          }),
        )
        return
      }

      // Find the connected agent socket by checking all connected agents for this agentId
      let agent: ConnectedAgent | undefined

      for (const [key, value] of connectedAgents.entries()) {
        if (value.agentId === agentId) {
          // Check if this agent has the matching skill
          const socket = io.sockets.sockets.get(value.socketId)
          if (socket?.data?.skillName === skillName) {
            agent = value
            break
          }
          // Also check by skillId in the tracking key
          if (key.includes(skillName)) {
            agent = value
            break
          }
        }
      }

      // Fallback: try the tracking key format agentId:skillName
      if (!agent) {
        agent = connectedAgents.get(`${agentId}:${skillName}`)
      }

      if (!agent) {
        console.warn(`[INVOKE] Agent not connected: ${agentId}:${skillName}`)
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Agent not connected' }))
        return
      }

      const socket = io.sockets.sockets.get(agent.socketId)
      if (!socket) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Agent socket not found' }))
        return
      }

      // Emit the invoke event to the agent
      socket.emit('skill:invoke', {
        requestId,
        skillName,
        params: params || {},
        message: message || '',
        conversationId: conversationId || '',
        timestamp: new Date().toISOString(),
      })

      console.log(
        `[INVOKE] Sent skill:invoke to ${agent.socketId} for ${skillName} (requestId: ${requestId})`,
      )

      // Optionally wait for the response
      const waitForResponse = url.searchParams.get('wait') === 'true'

      if (waitForResponse) {
        // Create a promise that resolves when the agent responds
        const responsePromise = new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => {
            pendingToolCalls.delete(requestId)
            reject(new Error('Tool call timed out'))
          }, TOOL_CALL_TIMEOUT)

          pendingToolCalls.set(requestId, {
            resolve,
            reject,
            timeout,
            createdAt: new Date(),
          })
        })

        try {
          const result = await responsePromise
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: true, result }))
        } catch (err: any) {
          res.writeHead(504, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: err.message }))
        }
      } else {
        // Just fire and forget — set up pending call anyway so we can handle the response
        const timeout = setTimeout(() => {
          pendingToolCalls.delete(requestId)
          console.warn(`[INVOKE] Tool call timed out: ${requestId}`)
        }, TOOL_CALL_TIMEOUT)

        pendingToolCalls.set(requestId, {
          resolve: () => {},
          reject: () => {},
          timeout,
          createdAt: new Date(),
        })

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, requestId }))
      }
    } catch (err: any) {
      console.error('[INVOKE] Error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }))
    }
    return
  }

  // -----------------------------------------------------------------------
  // GET /internal/status — Check agent connection status
  // -----------------------------------------------------------------------

  if (path === '/internal/status' && req.method === 'GET') {
    try {
      const agentId = url.searchParams.get('agentId')
      const skillName = url.searchParams.get('skillName')

      if (!agentId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing agentId parameter' }))
        return
      }

      // Find connected agent
      let agent: ConnectedAgent | undefined

      if (skillName) {
        // Look for a specific skill binding
        for (const [, value] of connectedAgents.entries()) {
          if (value.agentId === agentId) {
            const socket = io.sockets.sockets.get(value.socketId)
            if (socket?.data?.skillName === skillName) {
              agent = value
              break
            }
          }
        }
      } else {
        // Return any connection for this agent
        for (const [, value] of connectedAgents.entries()) {
          if (value.agentId === agentId) {
            agent = value
            break
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          connected: !!agent,
          lastHeartbeat: agent?.lastHeartbeat?.toISOString() || null,
          socketId: agent?.socketId || null,
          name: agent?.name || null,
          capabilities: agent?.capabilities || [],
          bindingType: agent?.bindingType || null,
        }),
      )
    } catch (err: any) {
      console.error('[STATUS] Error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }))
    }
    return
  }

  // -----------------------------------------------------------------------
  // POST /internal/notify — Send notification to a connected agent
  // -----------------------------------------------------------------------

  if (path === '/internal/notify' && req.method === 'POST') {
    try {
      const body = await readRequestBody(req)
      const { agentId, type, data: notificationData } = JSON.parse(body)

      if (!agentId || !type) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing required fields: agentId, type' }))
        return
      }

      // Find all connected sockets for this agent
      let notified = 0
      for (const [, agent] of connectedAgents.entries()) {
        if (agent.agentId === agentId) {
          const socket = io.sockets.sockets.get(agent.socketId)
          if (socket) {
            socket.emit('skill:notification', {
              type,
              data: notificationData,
              timestamp: new Date().toISOString(),
            })
            notified++
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, notified }))
    } catch (err: any) {
      console.error('[NOTIFY] Error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }))
    }
    return
  }

  // -----------------------------------------------------------------------
  // GET /internal/agents — List all connected agents
  // -----------------------------------------------------------------------

  if (path === '/internal/agents' && req.method === 'GET') {
    try {
      const agents = Array.from(connectedAgents.values()).map((a) => ({
        agentId: a.agentId,
        skillId: a.skillId,
        pluginId: a.pluginId,
        bindingType: a.bindingType,
        name: a.name,
        version: a.version,
        platform: a.platform,
        capabilities: a.capabilities,
        connectedAt: a.connectedAt.toISOString(),
        lastHeartbeat: a.lastHeartbeat.toISOString(),
        socketId: a.socketId,
      }))

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ agents, count: agents.length }))
    } catch (err: any) {
      console.error('[AGENTS] Error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }))
    }
    return
  }

  // -----------------------------------------------------------------------
  // Health check
  // -----------------------------------------------------------------------

  if (path === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'hermes-skill-ws',
        port: PORT,
        connectedAgents: connectedAgents.size,
        pendingToolCalls: pendingToolCalls.size,
        uptime: process.uptime(),
      }),
    )
    return
  }

  // 404 for everything else
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

async function updateConnectionStatus(endpointToken: string, status: string): Promise<void> {
  const response = await fetch(`${NEXTJS_API_URL}/api/skill-protocol/ws-status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpointToken, status }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`ws-status API error (${response.status}): ${errorText}`)
  }
}

// ---------------------------------------------------------------------------
// Stale Heartbeat Cleanup
// ---------------------------------------------------------------------------

const STALE_THRESHOLD = 90_000 // 90 seconds

setInterval(() => {
  const now = Date.now()
  for (const [key, agent] of connectedAgents.entries()) {
    const timeSinceHeartbeat = now - agent.lastHeartbeat.getTime()
    if (timeSinceHeartbeat > STALE_THRESHOLD) {
      console.warn(
        `[STALE] Agent ${key} last heartbeat was ${Math.round(timeSinceHeartbeat / 1000)}s ago, disconnecting`,
      )

      const socket = io.sockets.sockets.get(agent.socketId)
      if (socket) {
        socket.emit('skill:notification', {
          type: 'heartbeat_timeout',
          data: { reason: 'No heartbeat received within threshold' },
        })
        socket.disconnect(true)
      }

      // Clean up tracking
      connectedAgents.delete(key)
      socketToKey.delete(agent.socketId)

      // Update DB
      updateConnectionStatus(agent.endpointToken, 'disconnected').catch((err) =>
        console.error(`[STALE] Failed to update DB status for ${key}:`, err.message),
      )
    }
  }

  // Clean up expired pending tool calls
  for (const [requestId, pending] of pendingToolCalls.entries()) {
    const elapsed = now - pending.createdAt.getTime()
    if (elapsed > TOOL_CALL_TIMEOUT * 2) {
      // Double timeout as safety net
      clearTimeout(pending.timeout)
      pendingToolCalls.delete(requestId)
      console.warn(`[CLEANUP] Removed expired pending tool call: ${requestId}`)
    }
  }
}, 30_000) // Run every 30 seconds

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`[Hermes Skill WS] Socket.IO server running on port ${PORT}`)
  console.log(`[Hermes Skill WS] WebSocket endpoint: ws://localhost:${PORT}`)
  console.log(`[Hermes Skill WS] Internal API: http://localhost:${PORT}/internal/*`)
  console.log(`[Hermes Skill WS] Health check: http://localhost:${PORT}/health`)
  console.log(`[Hermes Skill WS] Ready to accept agent connections`)
})

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

const shutdown = () => {
  console.log('[Hermes Skill WS] Shutting down...')

  // Reject all pending tool calls
  for (const [requestId, pending] of pendingToolCalls.entries()) {
    clearTimeout(pending.timeout)
    pending.reject(new Error('Server shutting down'))
  }
  pendingToolCalls.clear()

  // Disconnect all sockets
  io.disconnectSockets(true)
  connectedAgents.clear()
  socketToKey.clear()

  httpServer.close(() => {
    console.log('[Hermes Skill WS] Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
