// ============================================================
// Hermes Agent Runtime 2.0 — Remote Executor
// ============================================================
// Handles agents with runtime === "remote"
// Supports both HTTP endpoint and WebSocket (via Gateway WS)

import type { AgentConfig, ExecutionContext, EndpointConfig } from '../types'
import type { Server } from 'socket.io'

const NEXTJS_API_URL = process.env.NEXTJS_API_URL || 'http://localhost:3000'
const SKILL_WS_URL = process.env.SKILL_WS_URL || 'http://localhost:3004'

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function createStep(runId: string, type: string, detail: Record<string, any>): Promise<{ id: string }> {
  const res = await fetch(`${NEXTJS_API_URL}/api/runs/${runId}/steps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, status: 'in_progress', detail }),
  })
  if (!res.ok) throw new Error(`Failed to create step: ${res.status}`)
  return res.json().then(d => d.step)
}

async function updateStep(runId: string, stepId: string, status: string, detail?: Record<string, any>): Promise<void> {
  const body: Record<string, any> = { status }
  if (detail) body.detail = detail
  await fetch(`${NEXTJS_API_URL}/api/runs/${runId}/steps/${stepId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function saveMessage(threadId: string, content: string, senderType: string, senderName: string, type: string = 'text'): Promise<void> {
  await fetch(`${NEXTJS_API_URL}/api/threads/${threadId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, type, senderType, senderName }),
  })
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

export async function executeRemote(
  io: Server,
  config: AgentConfig,
  context: ExecutionContext,
  userMessage: string,
): Promise<{ inputTokens: number; outputTokens: number }> {
  const { endpointConfig } = config
  const roomKey = context.conversationId || `thread:${context.threadId}`

  // Save user message to thread
  await saveMessage(context.threadId, userMessage, 'user', 'User')

  // Create message_creation step
  const step = await createStep(context.runId, 'message_creation', {
    runtime: 'remote',
    endpointType: endpointConfig.endpointType,
  })

  io.to(roomKey).emit('run:step-update', {
    runId: context.runId,
    threadId: context.threadId,
    step: { id: step.id, type: 'message_creation', status: 'in_progress', detail: { runtime: 'remote' } },
  })

  let responseText = ''

  try {
    if (endpointConfig.endpointType === 'http') {
      responseText = await executeHttpEndpoint(endpointConfig, config, userMessage, context)
    } else if (endpointConfig.endpointType === 'websocket') {
      responseText = await executeWsEndpoint(endpointConfig, config, userMessage, context)
    } else {
      throw new Error(`Unknown endpoint type: ${endpointConfig.endpointType}`)
    }

    // Complete step
    await updateStep(context.runId, step.id, 'completed', { message: responseText.substring(0, 500) })
    io.to(roomKey).emit('run:step-update', {
      runId: context.runId,
      threadId: context.threadId,
      step: { id: step.id, type: 'message_creation', status: 'completed', detail: {} },
    })

    // Stream the response
    io.to(roomKey).emit('run:stream', {
      runId: context.runId,
      threadId: context.threadId,
      chunk: responseText,
      timestamp: new Date().toISOString(),
    })

    // Save the agent message
    await saveMessage(context.threadId, responseText, 'agent', config.name)
  } catch (err: any) {
    await updateStep(context.runId, step.id, 'failed', { error: err.message })
    io.to(roomKey).emit('run:step-update', {
      runId: context.runId,
      threadId: context.threadId,
      step: { id: step.id, type: 'message_creation', status: 'failed', detail: { error: err.message } },
    })
    throw err
  }

  // Remote execution doesn't have detailed token counts
  return { inputTokens: 0, outputTokens: 0 }
}

// ---------------------------------------------------------------------------
// HTTP endpoint execution
// ---------------------------------------------------------------------------

async function executeHttpEndpoint(
  endpoint: EndpointConfig,
  config: AgentConfig,
  userMessage: string,
  context: ExecutionContext,
): Promise<string> {
  if (!endpoint.endpointUrl) {
    throw new Error('No endpoint URL configured for remote HTTP agent')
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Hermes-Agent-Id': context.agentId,
    'X-Hermes-Thread-Id': context.threadId,
    'X-Hermes-Run-Id': context.runId,
  }

  if (endpoint.authToken) {
    headers['Authorization'] = `Bearer ${endpoint.authToken}`
  }

  const response = await fetch(endpoint.endpointUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      agentId: context.agentId,
      agentName: config.name,
      threadId: context.threadId,
      runId: context.runId,
      message: userMessage,
      timestamp: new Date().toISOString(),
    }),
    signal: AbortSignal.timeout(60000),
  })

  if (!response.ok) {
    throw new Error(`Remote endpoint returned ${response.status}`)
  }

  const data = await response.json()
  return data.response || data.message || data.content || data.result || JSON.stringify(data)
}

// ---------------------------------------------------------------------------
// WebSocket endpoint execution (via Gateway WS / skill-ws)
// ---------------------------------------------------------------------------

async function executeWsEndpoint(
  endpoint: EndpointConfig,
  config: AgentConfig,
  userMessage: string,
  context: ExecutionContext,
): Promise<string> {
  // Check ACRP connection status first
  try {
    const statusRes = await fetch(
      `${SKILL_WS_URL}/internal/acrp-status?agentId=${context.agentId}`,
      { signal: AbortSignal.timeout(3000) },
    )

    if (!statusRes.ok) {
      throw new Error('Skill service unavailable')
    }

    const statusData = await statusRes.json()
    if (!statusData.connected) {
      // Fall back to HTTP endpoint if available
      if (endpoint.endpointUrl) {
        return await executeHttpEndpoint(endpoint, config, userMessage, context)
      }
      throw new Error(`Agent ${config.name} is currently offline`)
    }

    // Find suitable capability
    const chatCapability = statusData.capabilities?.find(
      (cap: any) => cap.category === 'chat' || cap.id === 'chat.reply' || cap.id === 'message',
    )
    const capabilityId = chatCapability?.id || 'chat.reply'

    // Invoke via ACRP
    const invocationId = `run_${context.runId}_${Date.now()}`
    const invokeRes = await fetch(`${SKILL_WS_URL}/internal/acrp-invoke?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: context.agentId,
        capabilityId,
        params: {
          message: userMessage,
          threadId: context.threadId,
          runId: context.runId,
          timestamp: new Date().toISOString(),
        },
        invocationId,
        invokedBy: context.agentId,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (invokeRes.ok) {
      const data = await invokeRes.json()
      if (data.success && data.result) {
        return data.result.response || data.result.message || data.result.content ||
               data.result.result || data.result.text ||
               (typeof data.result === 'string' ? data.result : JSON.stringify(data.result))
      }
      return data.error || 'No response from ACRP agent'
    }

    if (invokeRes.status === 404) {
      return `[${config.name}] I'm currently offline. Please try again later.`
    }
    if (invokeRes.status === 504) {
      return `[${config.name}] Response timed out. Please try again.`
    }
    throw new Error(`ACRP invocation failed (${invokeRes.status})`)
  } catch (err: any) {
    // Fall back to HTTP if WS fails
    if (endpoint.endpointUrl) {
      return await executeHttpEndpoint(endpoint, config, userMessage, context)
    }
    throw err
  }
}
