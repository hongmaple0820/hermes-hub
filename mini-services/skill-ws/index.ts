/**
 * Hermes Skill WebSocket Service + ACRP (Agent Capability Registration Protocol)
 *
 * Dedicated Socket.IO WebSocket server on port 3004.
 *
 * Two authentication modes:
 *   1. endpointToken — Legacy skill-plugin bindings (AgentSkill/AgentPlugin/AgentConnection)
 *   2. agentToken    — ACRP: agents connect at the agent level and register capabilities
 *
 * ACRP flow:
 *   Agent → connects with agentToken → authenticates → registers capabilities →
 *   hub can invoke capabilities remotely → agent returns results
 *
 * Architecture:
 *   External Agent → WebSocket → skill-ws (port 3004) ↔ Next.js API/DB
 *                                       ↕
 *                                 chat-service (port 3003)
 *                                       ↕
 *                                 Frontend (user chat / hub UI)
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// --- Legacy Skill Plugin types ---

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

// --- ACRP types ---

interface ACRPCapability {
  id: string          // e.g., "model.switch"
  name: string        // e.g., "Switch Model"
  description: string // e.g., "Switch the LLM model"
  category: string    // e.g., "model", "skill", "soul", "memory", "gateway", "chat", "im", "system"
  parameters: object  // JSON Schema for input parameters
  uiHints?: object    // { icon, color, confirmRequired, order, group }
  version?: string
}

interface ACRPRegisterData {
  name: string
  version: string
  platform: string   // "hermes-agent", "openclaw", "claude-code", etc.
  capabilities: ACRPCapability[]
  metadata?: object
}

interface ACRPHeartbeatData {
  status?: string
  metrics?: {
    cpu?: number
    memory?: number
    uptime?: number
    taskCount?: number
  }
}

interface ACRPCapabilityResult {
  invocationId: string
  result: any
  error?: string
  duration?: number  // ms
}

interface ACRPStatusData {
  status: string     // "online", "busy", "error"
  metrics?: object   // { cpu, memory, uptime, taskCount, model }
}

interface ACRPEventData {
  type: string  // "message", "notification", "im_event", etc.
  data: any
}

interface ACRPConnectedAgent {
  socketId: string
  agentId: string
  agentToken: string
  name: string
  version: string
  platform: string
  capabilities: ACRPCapability[]
  connectedAt: Date
  lastHeartbeat: Date
}

interface ACRPInvokePayload {
  agentId: string
  capabilityId: string  // e.g., "model.switch"
  params: object
  invocationId: string
  invokedBy: string
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = 3004
const NEXTJS_API_URL = process.env.NEXTJS_API_URL || 'http://localhost:3000'
const HEARTBEAT_INTERVAL = 30 // seconds
const TOOL_CALL_TIMEOUT = 30000 // 30s timeout for tool call responses
const ACRP_INVOKE_TIMEOUT = 60000 // 60s timeout for ACRP capability invocations

// ---------------------------------------------------------------------------
// In-Memory State
// ---------------------------------------------------------------------------

/** Map of agent tracking key (agentId:skillId or agentId:pluginId) → ConnectedAgent (legacy) */
const connectedAgents = new Map<string, ConnectedAgent>()

/** Map of socketId → tracking key (legacy) */
const socketToKey = new Map<string, string>()

/** Map of requestId → PendingToolCall for pending tool call promises (legacy + ACRP) */
const pendingToolCalls = new Map<string, PendingToolCall>()

/** Map of agentId → ACRPConnectedAgent (ACRP) */
const acrpConnectedAgents = new Map<string, ACRPConnectedAgent>()

/** Map of socketId → agentId (ACRP) */
const acrpSocketToAgentId = new Map<string, string>()

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
// Authentication Middleware — supports both endpointToken (legacy) and agentToken (ACRP)
// ---------------------------------------------------------------------------

io.use(async (socket, next) => {
  const endpointToken = socket.handshake.auth.endpointToken
  const agentToken = socket.handshake.auth.agentToken

  // --- ACRP authentication via agentToken ---
  if (agentToken && !endpointToken) {
    try {
      const response = await fetch(
        `${NEXTJS_API_URL}/api/acrp/validate-token?token=${encodeURIComponent(agentToken)}`,
      )

      if (!response.ok) {
        console.warn(`[AUTH:ACRP] Token validation failed (${response.status}) for socket ${socket.id}`)
        return next(new Error('Authentication error: invalid agent token'))
      }

      const data = await response.json()

      if (!data.valid) {
        console.warn(`[AUTH:ACRP] Token invalid for socket ${socket.id}: ${data.error}`)
        return next(new Error(`Authentication error: ${data.error || 'invalid agent token'}`))
      }

      // Store ACRP auth info on socket.data
      socket.data = {
        authMode: 'acrp',
        agentToken,
        agentId: data.agentId,
        agentName: data.name,
        agentType: data.agentType,
        agentVersion: data.agentVersion,
        agentPlatform: data.agentPlatform,
      }

      console.log(
        `[AUTH:ACRP] Socket ${socket.id} authenticated: agentId=${data.agentId}, name=${data.name}, type=${data.agentType}`,
      )

      return next()
    } catch (err: any) {
      console.error(`[AUTH:ACRP] Validation request failed for socket ${socket.id}:`, err.message)
      return next(new Error('Authentication error: validation service unavailable'))
    }
  }

  // --- Legacy endpointToken authentication ---
  if (!endpointToken) {
    console.warn(`[AUTH] Connection rejected: no endpointToken or agentToken provided (socket: ${socket.id})`)
    return next(new Error('Authentication error: endpointToken or agentToken is required'))
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
      authMode: 'endpoint',
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
  const authMode = socket.data.authMode as string

  if (authMode === 'acrp') {
    handleACRPConnection(socket)
  } else {
    handleLegacyConnection(socket)
  }
})

// ---------------------------------------------------------------------------
// Legacy Skill Plugin Connection Handler
// ---------------------------------------------------------------------------

function handleLegacyConnection(socket: Socket) {
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
}

// ---------------------------------------------------------------------------
// ACRP Connection Handler
// ---------------------------------------------------------------------------

function handleACRPConnection(socket: Socket) {
  const { agentId, agentToken, agentName, agentType, agentVersion, agentPlatform } = socket.data

  console.log(
    `[CONNECT:ACRP] Agent connected: agentId=${agentId}, name=${agentName}, type=${agentType} (socket: ${socket.id})`,
  )

  // Check if there's an existing ACRP connection for this agent and disconnect it
  const existing = acrpConnectedAgents.get(agentId)
  if (existing) {
    console.log(
      `[CONNECT:ACRP] Replacing existing connection for agent ${agentId} (old socket: ${existing.socketId})`,
    )
    const existingSocket = io.sockets.sockets.get(existing.socketId)
    if (existingSocket) {
      existingSocket.emit('agent:notification', {
        type: 'replaced',
        data: { reason: 'New connection established for the same agent' },
        timestamp: new Date().toISOString(),
      })
      existingSocket.disconnect(true)
    }
    // Clean up old socket mapping
    acrpSocketToAgentId.delete(existing.socketId)
  }

  // Register the ACRP connected agent
  const acrpAgent: ACRPConnectedAgent = {
    socketId: socket.id,
    agentId,
    agentToken,
    name: agentName || 'Unknown Agent',
    version: agentVersion || '0.0.0',
    platform: agentPlatform || agentType || 'custom',
    capabilities: [],
    connectedAt: new Date(),
    lastHeartbeat: new Date(),
  }
  acrpConnectedAgents.set(agentId, acrpAgent)
  acrpSocketToAgentId.set(socket.id, agentId)

  // Update DB: agent is connected via ACRP
  fetch(`${NEXTJS_API_URL}/api/acrp/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agentId,
      status: 'online',
      wsConnected: true,
    }),
  }).catch((err) =>
    console.error(`[CONNECT:ACRP] Failed to update DB status for agent ${agentId}:`, err.message),
  )

  // -----------------------------------------------------------------------
  // agent:register — Agent registers its profile and capabilities
  // -----------------------------------------------------------------------

  socket.on('agent:register', async (data: ACRPRegisterData) => {
    console.log(
      `[ACRP:REGISTER] agentId=${agentId}: name=${data.name}, version=${data.version}, platform=${data.platform}, capabilities=${data.capabilities?.length}`,
    )

    // Update in-memory agent info
    const agent = acrpConnectedAgents.get(agentId)
    if (agent) {
      agent.name = data.name
      agent.version = data.version
      agent.platform = data.platform
      agent.capabilities = data.capabilities || []
      agent.lastHeartbeat = new Date()
    }

    // Sync capabilities to DB via Next.js API
    try {
      const registerResponse = await fetch(`${NEXTJS_API_URL}/api/acrp/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          name: data.name,
          version: data.version,
          platform: data.platform,
          capabilities: data.capabilities,
          metadata: data.metadata,
        }),
      })

      if (!registerResponse.ok) {
        const errText = await registerResponse.text()
        console.error(`[ACRP:REGISTER] DB sync failed for agent ${agentId}: ${errText}`)
      } else {
        const result = await registerResponse.json()
        console.log(
          `[ACRP:REGISTER] Agent ${agentId} registered: synced=${result.syncedCapabilities?.length}, removed=${result.removedCapabilities?.length}`,
        )
      }
    } catch (err: any) {
      console.error(`[ACRP:REGISTER] DB sync error for agent ${agentId}:`, err.message)
    }

    socket.emit('agent:registered', {
      success: true,
      heartbeatInterval: HEARTBEAT_INTERVAL,
      serverTime: new Date().toISOString(),
    })
  })

  // -----------------------------------------------------------------------
  // agent:heartbeat — ACRP agent heartbeat
  // -----------------------------------------------------------------------

  socket.on('agent:heartbeat', async (data: ACRPHeartbeatData) => {
    const agent = acrpConnectedAgents.get(agentId)
    if (agent) {
      agent.lastHeartbeat = new Date()
    }

    // Update DB via ACRP heartbeat API
    try {
      await fetch(`${NEXTJS_API_URL}/api/acrp/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          status: data.status || 'online',
          metrics: data.metrics,
        }),
      })
    } catch (err: any) {
      console.error(`[ACRP:HEARTBEAT] Failed to update DB for agent ${agentId}:`, err.message)
    }

    socket.emit('agent:heartbeat-ack', {
      timestamp: new Date().toISOString(),
      nextInterval: HEARTBEAT_INTERVAL,
    })
  })

  // -----------------------------------------------------------------------
  // capability:result — Agent returns the result of a capability invocation
  // -----------------------------------------------------------------------

  socket.on('capability:result', async (data: ACRPCapabilityResult) => {
    console.log(
      `[ACRP:RESULT] agentId=${agentId}: invocationId=${data.invocationId}` +
        (data.error ? `, error=${data.error}` : ', success') +
        (data.duration ? `, duration=${data.duration}ms` : ''),
    )

    // Resolve pending invocation promise
    const pending = pendingToolCalls.get(data.invocationId)
    if (pending) {
      clearTimeout(pending.timeout)
      pendingToolCalls.delete(data.invocationId)

      if (data.error) {
        pending.reject(new Error(data.error))
      } else {
        pending.resolve(data.result)
      }
    } else {
      console.warn(
        `[ACRP:RESULT] No pending invocation found for invocationId=${data.invocationId}`,
      )
    }

    // Update CapabilityInvocation record in DB
    try {
      await fetch(`${NEXTJS_API_URL}/api/acrp/invocation-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invocationId: data.invocationId,
          agentId,
          capabilityId: data.invocationId, // Will be resolved from the pending call
          result: data.result,
          error: data.error,
          duration: data.duration,
        }),
      })
    } catch (err: any) {
      console.error(`[ACRP:RESULT] Failed to update DB for invocation ${data.invocationId}:`, err.message)
    }
  })

  // -----------------------------------------------------------------------
  // agent:status — Agent sends a status update
  // -----------------------------------------------------------------------

  socket.on('agent:status', async (data: ACRPStatusData) => {
    console.log(`[ACRP:STATUS] agentId=${agentId}: status=${data.status}`)

    // Update DB via ACRP status API
    try {
      await fetch(`${NEXTJS_API_URL}/api/acrp/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          status: data.status,
          metrics: data.metrics,
          wsConnected: true,
        }),
      })
    } catch (err: any) {
      console.error(`[ACRP:STATUS] Failed to update DB for agent ${agentId}:`, err.message)
    }
  })

  // -----------------------------------------------------------------------
  // agent:event — Agent sends a general event
  // -----------------------------------------------------------------------

  socket.on('agent:event', async (data: ACRPEventData) => {
    console.log(`[ACRP:EVENT] agentId=${agentId}: type=${data.type}`)

    // Process different event types
    try {
      if (data.type === 'message') {
        // Agent sent a message — create in conversation
        const { conversationId, content, senderName } = data.data
        if (conversationId && content) {
          await fetch(`${NEXTJS_API_URL}/api/conversations/${conversationId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content,
              senderType: 'agent',
              senderName: senderName || acrpAgent.name || 'ACRP Agent',
              type: 'text',
              metadata: JSON.stringify({
                source: 'acrp_ws',
                agentId,
                eventType: data.type,
              }),
            }),
          })
        }
      } else if (data.type === 'notification' || data.type === 'im_event') {
        // Notifications and IM events — store for potential future use
        console.log(`[ACRP:EVENT] Agent ${agentId} sent ${data.type} event, stored for processing`)
      }
    } catch (err: any) {
      console.error(`[ACRP:EVENT] Error processing event from agent ${agentId}:`, err.message)
    }
  })

  // -----------------------------------------------------------------------
  // Disconnect (ACRP)
  // -----------------------------------------------------------------------

  socket.on('disconnect', (reason) => {
    console.log(`[DISCONNECT:ACRP] Agent ${agentId} disconnected: ${reason}`)

    // Remove from tracking
    acrpConnectedAgents.delete(agentId)
    acrpSocketToAgentId.delete(socket.id)

    // Update DB: agent is disconnected
    fetch(`${NEXTJS_API_URL}/api/acrp/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        status: 'offline',
        wsConnected: false,
      }),
    }).catch((err) =>
      console.error(
        `[DISCONNECT:ACRP] Failed to update DB status for agent ${agentId}:`,
        err.message,
      ),
    )
  })

  socket.on('error', (error) => {
    console.error(`[ERROR:ACRP] Socket error for agent ${agentId} (${socket.id}):`, error)
  })
}

// ---------------------------------------------------------------------------
// Internal HTTP API (for chat-service and hub UI to call)
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

  // =======================================================================
  // ACRP Internal API Endpoints
  // =======================================================================

  // -----------------------------------------------------------------------
  // POST /internal/acrp-invoke — Invoke a capability on a connected ACRP agent
  // -----------------------------------------------------------------------

  if (path === '/internal/acrp-invoke' && req.method === 'POST') {
    try {
      const body = await readRequestBody(req)
      const { agentId, capabilityId, params, invocationId, invokedBy } =
        JSON.parse(body) as ACRPInvokePayload

      if (!agentId || !capabilityId || !invocationId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(
          JSON.stringify({
            error: 'Missing required fields: agentId, capabilityId, invocationId',
          }),
        )
        return
      }

      // Find the connected ACRP agent
      const acrpAgent = acrpConnectedAgents.get(agentId)

      if (!acrpAgent) {
        console.warn(`[ACRP:INVOKE] Agent not connected: ${agentId}`)
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'ACRP agent not connected' }))
        return
      }

      const socket = io.sockets.sockets.get(acrpAgent.socketId)
      if (!socket) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'ACRP agent socket not found' }))
        return
      }

      // Emit capability:invoke to the agent
      socket.emit('capability:invoke', {
        invocationId,
        capabilityId,
        params: params || {},
        invokedBy: invokedBy || 'system',
        timestamp: new Date().toISOString(),
      })

      console.log(
        `[ACRP:INVOKE] Sent capability:invoke to agent ${agentId} for ${capabilityId} (invocationId: ${invocationId})`,
      )

      // Optionally wait for the response
      const waitForResponse = url.searchParams.get('wait') === 'true'

      if (waitForResponse) {
        // Create a promise that resolves when the agent responds
        const responsePromise = new Promise<any>((resolve, reject) => {
          const timeout = setTimeout(() => {
            pendingToolCalls.delete(invocationId)
            reject(new Error('ACRP capability invocation timed out'))
          }, ACRP_INVOKE_TIMEOUT)

          pendingToolCalls.set(invocationId, {
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
        // Fire and forget — set up pending call with safety timeout
        const timeout = setTimeout(() => {
          pendingToolCalls.delete(invocationId)
          console.warn(`[ACRP:INVOKE] Capability invocation timed out: ${invocationId}`)
        }, ACRP_INVOKE_TIMEOUT)

        pendingToolCalls.set(invocationId, {
          resolve: () => {},
          reject: () => {},
          timeout,
          createdAt: new Date(),
        })

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: true, invocationId }))
      }
    } catch (err: any) {
      console.error('[ACRP:INVOKE] Error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }))
    }
    return
  }

  // -----------------------------------------------------------------------
  // GET /internal/acrp-status — Get ACRP agent connection status
  // -----------------------------------------------------------------------

  if (path === '/internal/acrp-status' && req.method === 'GET') {
    try {
      const agentId = url.searchParams.get('agentId')

      if (!agentId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing agentId parameter' }))
        return
      }

      const agent = acrpConnectedAgents.get(agentId)

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          connected: !!agent,
          lastHeartbeat: agent?.lastHeartbeat?.toISOString() || null,
          socketId: agent?.socketId || null,
          capabilities: agent?.capabilities || [],
          agentType: agent?.platform || null,
          agentVersion: agent?.version || null,
          name: agent?.name || null,
          connectedAt: agent?.connectedAt?.toISOString() || null,
        }),
      )
    } catch (err: any) {
      console.error('[ACRP:STATUS] Error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }))
    }
    return
  }

  // -----------------------------------------------------------------------
  // POST /internal/acrp-notify — Send notification to ACRP agent
  // -----------------------------------------------------------------------

  if (path === '/internal/acrp-notify' && req.method === 'POST') {
    try {
      const body = await readRequestBody(req)
      const { agentId, type, data: notificationData, command, params: commandParams } = JSON.parse(body)

      if (!agentId) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing required field: agentId' }))
        return
      }

      const acrpAgent = acrpConnectedAgents.get(agentId)
      if (!acrpAgent) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'ACRP agent not connected' }))
        return
      }

      const socket = io.sockets.sockets.get(acrpAgent.socketId)
      if (!socket) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'ACRP agent socket not found' }))
        return
      }

      // If command is provided, send agent:command; otherwise send agent:notification
      if (command) {
        socket.emit('agent:command', {
          command,
          params: commandParams || {},
          timestamp: new Date().toISOString(),
        })
      } else {
        socket.emit('agent:notification', {
          type: type || 'info',
          data: notificationData,
          timestamp: new Date().toISOString(),
        })
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: true, notified: true }))
    } catch (err: any) {
      console.error('[ACRP:NOTIFY] Error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message || 'Internal server error' }))
    }
    return
  }

  // =======================================================================
  // Legacy Skill Plugin Internal API Endpoints
  // =======================================================================

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
          const sock = io.sockets.sockets.get(value.socketId)
          if (sock?.data?.skillName === skillName) {
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
  // GET /internal/status — Check agent connection status (legacy)
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
            const sock = io.sockets.sockets.get(value.socketId)
            if (sock?.data?.skillName === skillName) {
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
  // POST /internal/notify — Send notification to a connected agent (legacy)
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

      // Find all connected sockets for this agent (legacy)
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

      // Also try ACRP connection
      const acrpAgent = acrpConnectedAgents.get(agentId)
      if (acrpAgent) {
        const socket = io.sockets.sockets.get(acrpAgent.socketId)
        if (socket) {
          socket.emit('agent:notification', {
            type,
            data: notificationData,
            timestamp: new Date().toISOString(),
          })
          notified++
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
  // GET /internal/agents — List all connected agents (legacy + ACRP)
  // -----------------------------------------------------------------------

  if (path === '/internal/agents' && req.method === 'GET') {
    try {
      const legacyAgents = Array.from(connectedAgents.values()).map((a) => ({
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
        authMode: 'endpoint',
      }))

      const acrpAgents = Array.from(acrpConnectedAgents.values()).map((a) => ({
        agentId: a.agentId,
        name: a.name,
        version: a.version,
        platform: a.platform,
        capabilities: a.capabilities.map((c) => c.id),
        connectedAt: a.connectedAt.toISOString(),
        lastHeartbeat: a.lastHeartbeat.toISOString(),
        socketId: a.socketId,
        authMode: 'acrp',
      }))

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          agents: [...legacyAgents, ...acrpAgents],
          legacyCount: legacyAgents.length,
          acrpCount: acrpAgents.length,
          count: legacyAgents.length + acrpAgents.length,
        }),
      )
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
        acrpConnectedAgents: acrpConnectedAgents.size,
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
// Stale Heartbeat Cleanup (both legacy + ACRP)
// ---------------------------------------------------------------------------

const STALE_THRESHOLD = 90_000 // 90 seconds

setInterval(() => {
  const now = Date.now()

  // Clean up stale legacy connections
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

  // Clean up stale ACRP connections
  for (const [agentId, agent] of acrpConnectedAgents.entries()) {
    const timeSinceHeartbeat = now - agent.lastHeartbeat.getTime()
    if (timeSinceHeartbeat > STALE_THRESHOLD) {
      console.warn(
        `[STALE:ACRP] Agent ${agentId} last heartbeat was ${Math.round(timeSinceHeartbeat / 1000)}s ago, disconnecting`,
      )

      const socket = io.sockets.sockets.get(agent.socketId)
      if (socket) {
        socket.emit('agent:notification', {
          type: 'heartbeat_timeout',
          data: { reason: 'No heartbeat received within threshold' },
          timestamp: new Date().toISOString(),
        })
        socket.disconnect(true)
      }

      // Clean up tracking
      acrpConnectedAgents.delete(agentId)
      acrpSocketToAgentId.delete(agent.socketId)

      // Update DB
      fetch(`${NEXTJS_API_URL}/api/acrp/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, status: 'offline', wsConnected: false }),
      }).catch((err) =>
        console.error(`[STALE:ACRP] Failed to update DB status for agent ${agentId}:`, err.message),
      )
    }
  }

  // Clean up expired pending tool calls
  for (const [requestId, pending] of pendingToolCalls.entries()) {
    const elapsed = now - pending.createdAt.getTime()
    if (elapsed > Math.max(TOOL_CALL_TIMEOUT, ACRP_INVOKE_TIMEOUT) * 2) {
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
  console.log(`[Hermes Skill WS] Auth modes: endpointToken (legacy), agentToken (ACRP)`)
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
  acrpConnectedAgents.clear()
  acrpSocketToAgentId.clear()

  httpServer.close(() => {
    console.log('[Hermes Skill WS] Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
