// ============================================================
// Hermes Agent Runtime 2.0 — Main Entry Point
// ============================================================
// Socket.IO server + HTTP internal API on port 3003

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { Server, Socket } from 'socket.io'
import { AgentRuntime } from './runtime'

const PORT = 3003
const NEXTJS_API_URL = process.env.NEXTJS_API_URL || 'http://localhost:3000'

// ---------------------------------------------------------------------------
// Active runs tracking (for cancellation and status queries)
// ---------------------------------------------------------------------------

interface ActiveRun {
  runId: string
  threadId: string
  agentId: string
  userId: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled'
  startedAt: Date
  abortController?: AbortController
}

const activeRuns = new Map<string, ActiveRun>()

// ---------------------------------------------------------------------------
// HTTP request handler (runs BEFORE Socket.IO's handler)
// ---------------------------------------------------------------------------

function handleHttpRequest(req: IncomingMessage, res: ServerResponse) {
  // Only handle /internal/* paths — everything else falls through to Socket.IO
  if (!req.url?.startsWith('/internal/')) {
    return // Let Socket.IO handle it
  }

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`)

  // POST /internal/execute-run — Trigger run execution
  if (req.method === 'POST' && url.pathname === '/internal/execute-run') {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', async () => {
      try {
        const { runId, threadId, agentId, userMessage, userId } = JSON.parse(body)

        if (!runId || !threadId || !agentId || !userMessage || !userId) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Missing required fields: runId, threadId, agentId, userMessage, userId' }))
          return
        }

        // Execute the run asynchronously
        runtime.executeRun(runId, threadId, agentId, userId, userMessage).catch(err => {
          console.error(`[INTERNAL] Unhandled error in run ${runId}:`, err)
        })

        res.writeHead(202, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ runId, status: 'started' }))
      } catch (err: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
      }
    })
    return
  }

  // GET /internal/run-status?runId=xxx — Get current run status
  if (req.method === 'GET' && url.pathname === '/internal/run-status') {
    const runId = url.searchParams.get('runId')
    if (!runId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'runId is required' }))
      return
    }

    const runStatus = runtime.getRunStatus(runId)
    if (runStatus) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        runId: runStatus.runId,
        threadId: runStatus.threadId,
        agentId: runStatus.agentId,
        status: runStatus.status,
        startedAt: runStatus.startedAt,
      }))
    } else {
      // Check DB for completed/failed runs
      fetch(`${NEXTJS_API_URL}/api/runs/${runId}`)
        .then(r => r.json())
        .then(data => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(data.run || { runId, status: 'unknown' }))
        })
        .catch(() => {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Run not found' }))
        })
    }
    return
  }

  // GET /internal/health — Health check
  if (req.method === 'GET' && url.pathname === '/internal/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      status: 'ok',
      service: 'hermes-agent-runtime',
      version: '2.0.0',
      activeRuns: activeRuns.size,
      uptime: process.uptime(),
    }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
}

// ---------------------------------------------------------------------------
// HTTP Server + Socket.IO
// ---------------------------------------------------------------------------

const httpServer = createServer(handleHttpRequest)
const io = new Server(httpServer, {
  // Use default path /socket.io/ — the frontend must also set path option
  // For Caddy compatibility, the client connects to io({ path: '/' })
  // But we keep default path here so our /internal/* HTTP API works
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// Initialize the runtime engine
const runtime = new AgentRuntime(io)

// Make activeRuns accessible to the runtime
runtime.setActiveRunsMap(activeRuns)

// ---------------------------------------------------------------------------
// Socket.IO Authentication Middleware
// ---------------------------------------------------------------------------

io.use((socket, next) => {
  const userId = socket.handshake.auth.userId

  if (!userId) {
    return next(new Error('Authentication error: userId is required'))
  }

  socket.data.userId = userId
  socket.data.connectedAt = new Date()

  next()
})

// ---------------------------------------------------------------------------
// Socket.IO Event Handlers
// ---------------------------------------------------------------------------

io.on('connection', (socket: Socket) => {
  const userId: string = socket.data.userId

  console.log(`[RUNTIME:CONNECT] User ${userId} connected via socket ${socket.id}`)

  // Send connection confirmation
  socket.emit('connected', {
    userId,
    socketId: socket.id,
    timestamp: new Date().toISOString(),
  })

  // -----------------------------------------------------------------------
  // Thread Events
  // -----------------------------------------------------------------------

  socket.on('thread:join', (data: { threadId: string }) => {
    const { threadId } = data
    const roomKey = `thread:${threadId}`

    socket.join(roomKey)
    console.log(`[THREAD:JOIN] User ${userId} joined thread ${threadId}`)

    socket.to(roomKey).emit('thread:user-joined', {
      threadId,
      userId,
      timestamp: new Date().toISOString(),
    })
  })

  socket.on('thread:leave', (data: { threadId: string }) => {
    const { threadId } = data
    const roomKey = `thread:${threadId}`

    socket.leave(roomKey)
    console.log(`[THREAD:LEAVE] User ${userId} left thread ${threadId}`)

    socket.to(roomKey).emit('thread:user-left', {
      threadId,
      userId,
      timestamp: new Date().toISOString(),
    })
  })

  socket.on('thread:message', async (data: {
    threadId: string
    content: string
    agentId: string
  }) => {
    const { threadId, content, agentId } = data

    if (!content || !agentId) {
      socket.emit('run:error', {
        runId: '',
        threadId,
        error: 'content and agentId are required',
      })
      return
    }

    console.log(`[THREAD:MSG] User ${userId} sent message to agent ${agentId} in thread ${threadId}`)

    try {
      // Create a Run via the Next.js API
      const runRes = await fetch(`${NEXTJS_API_URL}/api/threads/${threadId}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!runRes.ok) {
        throw new Error(`Failed to create run: ${runRes.status}`)
      }

      const { run } = await runRes.json()

      // Execute the run asynchronously
      runtime.executeRun(run.id, threadId, agentId, userId, content).catch(err => {
        console.error(`[THREAD:MSG] Unhandled error in run ${run.id}:`, err)
      })
    } catch (err: any) {
      console.error(`[THREAD:MSG] Error creating run:`, err)
      socket.emit('run:error', {
        runId: '',
        threadId,
        error: err.message || 'Failed to start run',
      })
    }
  })

  // -----------------------------------------------------------------------
  // Run Events
  // -----------------------------------------------------------------------

  socket.on('run:cancel', (data: { runId: string }) => {
    const { runId } = data

    const cancelled = runtime.cancelRun(runId)
    if (cancelled) {
      console.log(`[RUN:CANCEL] Run ${runId} cancelled by user ${userId}`)
      socket.emit('run:complete', {
        runId,
        threadId: '',
        status: 'cancelled',
        inputTokens: 0,
        outputTokens: 0,
      })
    } else {
      socket.emit('run:error', {
        runId,
        threadId: '',
        error: 'Run not found or not in progress',
      })
    }
  })

  // -----------------------------------------------------------------------
  // Legacy Compatibility Events (for existing ChatView)
  // -----------------------------------------------------------------------

  socket.on('chat:join', (data: { conversationId: string }) => {
    const { conversationId } = data
    const roomKey = `chat:${conversationId}`
    socket.join(roomKey)
    console.log(`[CHAT:JOIN] User ${userId} joined conversation ${conversationId}`)
  })

  socket.on('chat:leave', (data: { conversationId: string }) => {
    const { conversationId } = data
    const roomKey = `chat:${conversationId}`
    socket.leave(roomKey)
    console.log(`[CHAT:LEAVE] User ${userId} left conversation ${conversationId}`)
  })

  socket.on('chat:message', (data: { conversationId: string; content: string; type?: string }) => {
    const { conversationId, content, type = 'text' } = data
    const roomKey = `chat:${conversationId}`

    const message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      conversationId,
      senderId: userId,
      content,
      type,
      timestamp: new Date().toISOString(),
    }

    io.to(roomKey).emit('chat:message', message)
  })

  socket.on('chat:typing', (data: { conversationId: string; isTyping: boolean }) => {
    const { conversationId, isTyping } = data
    const roomKey = `chat:${conversationId}`
    socket.to(roomKey).emit('chat:typing', {
      conversationId,
      userId,
      isTyping,
    })
  })

  // Legacy agent:message handler — bridges old ChatView to new Run model
  socket.on('agent:message', async (data: {
    conversationId: string
    agentConfig: {
      agentId: string
      name: string
      mode: string
      provider?: string
      model?: string
      apiKey?: string
      baseUrl?: string
      callbackUrl?: string
      systemPrompt?: string
      skills?: any[]
    }
    message: string
    userId: string
  }) => {
    const { conversationId, agentConfig, message } = data
    const roomKey = `chat:${conversationId}`

    console.log(`[AGENT:MSG] User ${userId} sent message to agent ${agentConfig.name} (${agentConfig.agentId})`)

    // Notify typing
    io.to(roomKey).emit('agent:typing', {
      conversationId,
      agentId: agentConfig.agentId,
      agentName: agentConfig.name,
      isTyping: true,
      timestamp: new Date().toISOString(),
    })

    try {
      if (agentConfig.mode === 'builtin') {
        await handleLegacyBuiltin(io, socket, roomKey, conversationId, agentConfig, message)
      } else if (agentConfig.mode === 'custom_api' || agentConfig.mode === 'hermes') {
        await handleLegacyRemote(io, socket, roomKey, conversationId, agentConfig, message)
      } else if (agentConfig.mode === 'acrp') {
        await handleLegacyAcrp(io, socket, roomKey, conversationId, agentConfig, message)
      } else {
        io.to(roomKey).emit('agent:typing', {
          conversationId, agentId: agentConfig.agentId, isTyping: false,
        })
        io.to(roomKey).emit('agent:stream-complete', {
          conversationId, agentId: agentConfig.agentId,
          fullResponse: `Error: Unknown agent mode "${agentConfig.mode}"`, error: true,
        })
      }
    } catch (err: any) {
      console.error(`[AGENT:MSG] Error:`, err)
      io.to(roomKey).emit('agent:typing', { conversationId, agentId: agentConfig.agentId, isTyping: false })
      io.to(roomKey).emit('agent:stream-complete', {
        conversationId, agentId: agentConfig.agentId,
        fullResponse: `Error: ${err.message || 'Internal server error'}`, error: true,
      })
    }
  })

  // -----------------------------------------------------------------------
  // Disconnect
  // -----------------------------------------------------------------------

  socket.on('disconnect', (reason) => {
    console.log(`[RUNTIME:DISCONNECT] User ${userId} disconnected: ${reason}`)
  })

  socket.on('error', (error) => {
    console.error(`[RUNTIME:ERROR] Socket error for ${socket.id}:`, error)
  })
})

// ---------------------------------------------------------------------------
// Legacy Agent Handlers (compatibility with existing ChatView)
// ---------------------------------------------------------------------------

async function handleLegacyBuiltin(
  io: Server,
  socket: Socket,
  roomKey: string,
  conversationId: string,
  agentConfig: any,
  message: string,
) {
  const baseUrl = agentConfig.baseUrl || 'https://api.openai.com/v1'
  const model = agentConfig.model || 'gpt-3.5-turbo'
  const apiKey = agentConfig.apiKey

  if (!apiKey) {
    io.to(roomKey).emit('agent:typing', { conversationId, agentId: agentConfig.agentId, isTyping: false })
    io.to(roomKey).emit('agent:stream-complete', {
      conversationId, agentId: agentConfig.agentId,
      fullResponse: 'Error: API key not configured for this agent.', error: true,
    })
    return
  }

  const messages: any[] = []
  if (agentConfig.systemPrompt) messages.push({ role: 'system', content: agentConfig.systemPrompt })
  messages.push({ role: 'user', content: message })

  // Build tool definitions from skills
  const tools: any[] = []
  if (agentConfig.skills?.length > 0) {
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
    const requestBody: any = { model, messages, stream: true }
    if (tools.length > 0) { requestBody.tools = tools; requestBody.tool_choice = 'auto' }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(120000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`LLM API error (${response.status}): ${errorText}`)
    }

    const body = response.body
    if (!body) throw new Error('No response body')

    let fullResponse = ''
    let toolCalls: any[] = []
    let hasToolCalls = false
    const reader = body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '))

      for (const line of lines) {
        const data = line.substring(6).trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const delta = parsed.choices?.[0]?.delta

          if (delta?.tool_calls) {
            hasToolCalls = true
            for (const tc of delta.tool_calls) {
              if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: tc.id, function: { name: '', arguments: '' } }
              if (tc.id) toolCalls[tc.index].id = tc.id
              if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name
              if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments
            }
          }

          const content = delta?.content
          if (content) {
            fullResponse += content
            io.to(roomKey).emit('agent:stream', {
              conversationId, agentId: agentConfig.agentId, chunk: content, timestamp: new Date().toISOString(),
            })
          }
        } catch {}
      }
    }

    // Process tool calls
    if (hasToolCalls && toolCalls.length > 0) {
      toolCalls = toolCalls.filter(Boolean)
      for (const toolCall of toolCalls) {
        const skillName = toolCall.function.name?.replace('skill_', '')
        const args = (() => { try { return JSON.parse(toolCall.function.arguments || '{}') } catch { return {} } })()

        const matchingSkill = agentConfig.skills?.find((s: any) => s.skillName === skillName && s.isEnabled)
        if (!matchingSkill) {
          fullResponse += `\n[Tool ${skillName}: Skill not found or disabled]`
          continue
        }

        let skillResult = ''
        const SKILL_WS_URL = process.env.SKILL_WS_URL || 'http://localhost:3004'

        let wsConnected = false
        try {
          const statusRes = await fetch(`${SKILL_WS_URL}/internal/status?agentId=${agentConfig.agentId}&skillId=${matchingSkill.skillId}`, { signal: AbortSignal.timeout(3000) })
          if (statusRes.ok) { const sd = await statusRes.json(); wsConnected = sd.connected === true }
        } catch {}

        if (wsConnected) {
          try {
            const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
            const invokeRes = await fetch(`${SKILL_WS_URL}/internal/invoke?wait=true`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ agentId: agentConfig.agentId, skillName, params: args, message, conversationId, requestId }),
              signal: AbortSignal.timeout(30000),
            })
            if (invokeRes.ok) {
              const d = await invokeRes.json()
              skillResult = d.success && d.result
                ? (d.result.response || d.result.message || d.result.content || d.result.result || JSON.stringify(d.result))
                : (d.error || `[Skill ${matchingSkill.skillDisplayName}: WS returned no result]`)
            } else { skillResult = `[Skill ${matchingSkill.skillDisplayName}: WS failed (${invokeRes.status})]` }
          } catch (err: any) { skillResult = `[Skill ${matchingSkill.skillDisplayName} WS timeout: ${err.message}]` }
        } else {
          const targetUrl = matchingSkill.callbackUrl || matchingSkill.handlerUrl
          if (targetUrl) {
            try {
              const sr = await fetch(targetUrl, {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Hermes-Agent-Id': agentConfig.agentId, 'X-Hermes-Skill-Id': matchingSkill.skillId },
                body: JSON.stringify({ agentId: agentConfig.agentId, skillName, skillDisplayName: matchingSkill.skillDisplayName, arguments: args, message, conversationId, timestamp: new Date().toISOString() }),
                signal: AbortSignal.timeout(15000),
              })
              if (sr.ok) {
                const d = await sr.json().catch(() => ({ response: 'Skill executed' }))
                skillResult = d.response || d.message || d.content || d.result || JSON.stringify(d)
              } else { skillResult = `[Skill ${matchingSkill.skillDisplayName} error: ${sr.status}]` }
            } catch (err: any) { skillResult = `[Skill ${matchingSkill.skillDisplayName} failed: ${err.message}]` }
          } else { skillResult = `[Skill ${matchingSkill.skillDisplayName}: No callback URL configured]` }
        }

        fullResponse += `\n🔧 **${matchingSkill.skillDisplayName}**: ${skillResult}\n`
        io.to(roomKey).emit('agent:stream', { conversationId, agentId: agentConfig.agentId, chunk: `\n🔧 **${matchingSkill.skillDisplayName}**: ${skillResult}\n`, timestamp: new Date().toISOString() })
      }
    }

    io.to(roomKey).emit('agent:typing', { conversationId, agentId: agentConfig.agentId, isTyping: false })
    io.to(roomKey).emit('agent:stream-complete', { conversationId, agentId: agentConfig.agentId, fullResponse, timestamp: new Date().toISOString() })
  } catch (err: any) {
    io.to(roomKey).emit('agent:typing', { conversationId, agentId: agentConfig.agentId, isTyping: false })
    io.to(roomKey).emit('agent:stream-complete', { conversationId, agentId: agentConfig.agentId, fullResponse: `Error: ${err.message || 'Failed to get LLM response'}`, error: true })
  }
}

async function handleLegacyRemote(
  io: Server, socket: Socket, roomKey: string, conversationId: string, agentConfig: any, message: string,
) {
  const callbackUrl = agentConfig.callbackUrl
  if (!callbackUrl) {
    io.to(roomKey).emit('agent:typing', { conversationId, agentId: agentConfig.agentId, isTyping: false })
    io.to(roomKey).emit('agent:stream-complete', { conversationId, agentId: agentConfig.agentId, fullResponse: 'Error: Callback URL not configured for this agent.', error: true })
    return
  }

  try {
    const response = await fetch(callbackUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, agentId: agentConfig.agentId, agentName: agentConfig.name, message, timestamp: new Date().toISOString() }),
    })
    if (!response.ok) throw new Error(`Custom API error (${response.status})`)
    const data = await response.json()
    const reply = data.response || data.message || data.content || 'No response from custom API'

    io.to(roomKey).emit('agent:stream', { conversationId, agentId: agentConfig.agentId, chunk: reply, timestamp: new Date().toISOString() })
    io.to(roomKey).emit('agent:typing', { conversationId, agentId: agentConfig.agentId, isTyping: false })
    io.to(roomKey).emit('agent:stream-complete', { conversationId, agentId: agentConfig.agentId, fullResponse: reply, timestamp: new Date().toISOString() })
  } catch (err: any) {
    io.to(roomKey).emit('agent:typing', { conversationId, agentId: agentConfig.agentId, isTyping: false })
    io.to(roomKey).emit('agent:stream-complete', { conversationId, agentId: agentConfig.agentId, fullResponse: `Error: ${err.message || 'Failed to call custom API'}`, error: true })
  }
}

async function handleLegacyAcrp(
  io: Server, socket: Socket, roomKey: string, conversationId: string, agentConfig: any, message: string,
) {
  const SKILL_WS_URL = process.env.SKILL_WS_URL || 'http://localhost:3004'

  try {
    const statusRes = await fetch(`${SKILL_WS_URL}/internal/acrp-status?agentId=${agentConfig.agentId}`, { signal: AbortSignal.timeout(3000) })
    if (!statusRes.ok) throw new Error('Skill service unavailable')
    const statusData = await statusRes.json()
    if (!statusData.connected) {
      io.to(roomKey).emit('agent:typing', { conversationId, agentId: agentConfig.agentId, isTyping: false })
      io.to(roomKey).emit('agent:stream-complete', { conversationId, agentId: agentConfig.agentId, fullResponse: `[${agentConfig.name}] I'm currently offline. Please try again later.`, error: true })
      return
    }

    const chatCapability = statusData.capabilities?.find((cap: any) => cap.category === 'chat' || cap.id === 'chat.reply' || cap.id === 'message')
    const capabilityId = chatCapability?.id || 'chat.reply'
    const invocationId = `chat_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const invokeRes = await fetch(`${SKILL_WS_URL}/internal/acrp-invoke?wait=true`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agentConfig.agentId, capabilityId, params: { message, conversationId, timestamp: new Date().toISOString() }, invocationId, invokedBy: agentConfig.agentId }),
      signal: AbortSignal.timeout(60000),
    })

    let reply = ''
    if (invokeRes.ok) {
      const data = await invokeRes.json()
      if (data.success && data.result) {
        reply = data.result.response || data.result.message || data.result.content || data.result.result || data.result.text || (typeof data.result === 'string' ? data.result : JSON.stringify(data.result))
      } else { reply = data.error || `[${agentConfig.name}] No response received.` }
    } else if (invokeRes.status === 404) { reply = `[${agentConfig.name}] I'm currently offline.` }
    else if (invokeRes.status === 504) { reply = `[${agentConfig.name}] Response timed out.` }
    else { reply = `[${agentConfig.name}] Failed to get response.` }

    io.to(roomKey).emit('agent:stream', { conversationId, agentId: agentConfig.agentId, chunk: reply, timestamp: new Date().toISOString() })
    io.to(roomKey).emit('agent:typing', { conversationId, agentId: agentConfig.agentId, isTyping: false })
    io.to(roomKey).emit('agent:stream-complete', { conversationId, agentId: agentConfig.agentId, fullResponse: reply, timestamp: new Date().toISOString() })
  } catch (err: any) {
    io.to(roomKey).emit('agent:typing', { conversationId, agentId: agentConfig.agentId, isTyping: false })
    io.to(roomKey).emit('agent:stream-complete', { conversationId, agentId: agentConfig.agentId, fullResponse: `[${agentConfig.name}] Error: ${err.message || 'Service unavailable'}`, error: true })
  }
}

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------

httpServer.listen(PORT, () => {
  console.log(`[Hermes Agent Runtime] Socket.IO server running on port ${PORT}`)
  console.log(`[Hermes Agent Runtime] Internal API available at /internal/*`)
  console.log(`[Hermes Agent Runtime] Ready to accept connections`)
})

// ---------------------------------------------------------------------------
// Graceful Shutdown
// ---------------------------------------------------------------------------

const shutdown = () => {
  console.log('[Hermes Agent Runtime] Shutting down...')
  io.disconnectSockets(true)
  httpServer.close(() => {
    console.log('[Hermes Agent Runtime] Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
