/**
 * Skill Plugin Protocol - Core Library
 * Handles skill endpoint generation, callback dispatching, heartbeat checking, and event processing.
 * Similar to Feishu/DingTalk bot platform protocols.
 */

import { db } from '@/lib/db'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SkillEvent {
  type: 'message' | 'command' | 'status' | 'tool_result' | 'heartbeat' | 'tool_call'
  data: Record<string, any>
  timestamp: string
  source: 'system' | 'external'
}

export interface CallbackPayload {
  event: SkillEvent
  agentId: string
  skillId?: string
  pluginId?: string
  signature: string
}

export interface RegistrationPayload {
  endpointToken: string
  agentInfo: {
    name: string
    version?: string
    capabilities?: string[]
    callbackUrl: string
    metadata?: Record<string, any>
  }
}

export interface HeartbeatPayload {
  endpointToken: string
  status: string
  metrics?: Record<string, any>
}

// ---------------------------------------------------------------------------
// Endpoint Token Generation
// ---------------------------------------------------------------------------

export function generateEndpointToken(): string {
  return `sk_${crypto.randomBytes(24).toString('hex')}`
}

export function generateCallbackSecret(): string {
  return `cs_${crypto.randomBytes(32).toString('hex')}`
}

// ---------------------------------------------------------------------------
// Signature Generation / Verification
// ---------------------------------------------------------------------------

export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret)
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}

// ---------------------------------------------------------------------------
// Find Binding by Endpoint Token
// ---------------------------------------------------------------------------

export async function findBindingByToken(endpointToken: string): Promise<{
  type: 'agent_skill' | 'agent_plugin' | 'agent_connection'
  record: any
  agentId: string
} | null> {
  // Check AgentSkill
  const agentSkill = await db.agentSkill.findUnique({
    where: { endpointToken },
    include: { skill: true, agent: true },
  })
  if (agentSkill) {
    return { type: 'agent_skill', record: agentSkill, agentId: agentSkill.agentId }
  }

  // Check AgentPlugin
  const plugin = await db.agentPlugin.findUnique({
    where: { endpointToken },
    include: { agent: true },
  })
  if (plugin) {
    return { type: 'agent_plugin', record: plugin, agentId: plugin.agentId }
  }

  // Check AgentConnection
  const connection = await db.agentConnection.findUnique({
    where: { endpointToken },
    include: { agent: true },
  })
  if (connection) {
    return { type: 'agent_connection', record: connection, agentId: connection.agentId }
  }

  return null
}

// ---------------------------------------------------------------------------
// Send Callback to External Agent
// ---------------------------------------------------------------------------

export async function sendCallback(
  callbackUrl: string,
  callbackSecret: string | null,
  event: SkillEvent,
  agentId: string,
  skillId?: string,
  pluginId?: string,
): Promise<{ success: boolean; response?: any; error?: string }> {
  if (!callbackUrl) {
    return { success: false, error: 'No callback URL configured' }
  }

  try {
    const payload: CallbackPayload = {
      event,
      agentId,
      skillId,
      pluginId,
      signature: callbackSecret ? signPayload(JSON.stringify(event), callbackSecret) : '',
    }

    const response = await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hermes-Signature': payload.signature,
        'X-Hermes-Agent-Id': agentId,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000), // 10s timeout
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `Callback failed (${response.status}): ${errorText}` }
    }

    const data = await response.json().catch(() => ({}))
    return { success: true, response: data }
  } catch (err: any) {
    return { success: false, error: err.message || 'Callback request failed' }
  }
}

// ---------------------------------------------------------------------------
// Register External Agent
// ---------------------------------------------------------------------------

export async function registerExternalAgent(data: RegistrationPayload): Promise<{
  success: boolean
  binding?: any
  error?: string
}> {
  const binding = await findBindingByToken(data.endpointToken)
  if (!binding) {
    return { success: false, error: 'Invalid endpoint token' }
  }

  const registrationInfo = JSON.stringify({
    name: data.agentInfo.name,
    version: data.agentInfo.version,
    capabilities: data.agentInfo.capabilities,
    metadata: data.agentInfo.metadata,
    registeredAt: new Date().toISOString(),
  })

  const callbackUrl = data.agentInfo.callbackUrl

  if (binding.type === 'agent_skill') {
    const updated = await db.agentSkill.update({
      where: { id: binding.record.id },
      data: {
        callbackUrl,
        callbackSecret: generateCallbackSecret(),
        isEnabled: true,
      },
    })
    // Also update the skill's registration info
    await db.skill.update({
      where: { id: binding.record.skillId },
      data: {
        callbackUrl,
        registeredAt: new Date(),
        lastHeartbeat: new Date(),
        registrationInfo,
      },
    })
    return { success: true, binding: updated }
  }

  if (binding.type === 'agent_plugin') {
    const updated = await db.agentPlugin.update({
      where: { id: binding.record.id },
      data: {
        callbackUrl,
        callbackSecret: generateCallbackSecret(),
        registeredAt: new Date(),
        lastHeartbeat: new Date(),
        registrationInfo,
        isEnabled: true,
      },
    })
    return { success: true, binding: updated }
  }

  if (binding.type === 'agent_connection') {
    const updated = await db.agentConnection.update({
      where: { id: binding.record.id },
      data: {
        status: 'connected',
        registeredAt: new Date(),
        registrationInfo,
        lastPing: new Date(),
      },
    })
    return { success: true, binding: updated }
  }

  return { success: false, error: 'Unknown binding type' }
}

// ---------------------------------------------------------------------------
// Process Heartbeat
// ---------------------------------------------------------------------------

export async function processHeartbeat(data: HeartbeatPayload): Promise<{
  success: boolean
  nextHeartbeat?: number
  error?: string
}> {
  const binding = await findBindingByToken(data.endpointToken)
  if (!binding) {
    return { success: false, error: 'Invalid endpoint token' }
  }

  const now = new Date()

  if (binding.type === 'agent_skill') {
    await db.skill.update({
      where: { id: binding.record.skillId },
      data: { lastHeartbeat: now },
    })
  } else if (binding.type === 'agent_plugin') {
    await db.agentPlugin.update({
      where: { id: binding.record.id },
      data: { lastHeartbeat: now },
    })
  } else if (binding.type === 'agent_connection') {
    await db.agentConnection.update({
      where: { id: binding.record.id },
      data: { status: 'connected', lastPing: now },
    })
  }

  // Determine next heartbeat interval
  let interval = 30 // default
  if (binding.type === 'agent_connection') {
    interval = binding.record.heartbeatInterval || 30
  }

  return { success: true, nextHeartbeat: interval }
}

// ---------------------------------------------------------------------------
// Process Inbound Event (from external agent)
// ---------------------------------------------------------------------------

export async function processInboundEvent(
  endpointToken: string,
  event: SkillEvent,
): Promise<{
  success: boolean
  eventId: string
  error?: string
}> {
  const binding = await findBindingByToken(endpointToken)
  if (!binding) {
    return { success: false, eventId: '', error: 'Invalid endpoint token' }
  }

  const eventId = crypto.randomUUID()

  // Update invoke count for skill
  if (binding.type === 'agent_skill') {
    await db.agentSkill.update({
      where: { id: binding.record.id },
      data: {
        lastInvokedAt: new Date(),
        invokeCount: { increment: 1 },
      },
    })
  }

  // Process event based on type
  switch (event.type) {
    case 'message': {
      // External agent sent a message — could be a response to a previous callback
      // or a proactive message from the external agent
      const { conversationId, content, senderName } = event.data

      if (conversationId) {
        // Create message in conversation
        await db.message.create({
          data: {
            conversationId,
            content: content || '',
            type: 'text',
            senderType: 'agent',
            senderName: senderName || binding.record.agent?.name || 'External Agent',
            metadata: JSON.stringify({
              source: 'skill_protocol',
              eventId,
              agentId: binding.agentId,
              skillId: binding.type === 'agent_skill' ? binding.record.skillId : undefined,
              pluginId: binding.type === 'agent_plugin' ? binding.record.id : undefined,
            }),
          },
        })
      }
      break
    }

    case 'command': {
      // External agent sent a command
      // Commands can trigger actions within the system
      const { command, args } = event.data
      // Command processing can be extended later
      break
    }

    case 'status': {
      // External agent status update
      const { status } = event.data
      await db.agent.update({
        where: { id: binding.agentId },
        data: { status: status || 'online' },
      })
      break
    }

    case 'tool_result': {
      // External agent returned a tool execution result
      // This is used when the LLM calls a skill as a tool and the external agent processes it
      break
    }

    default:
      // Unknown event type - still acknowledge
      break
  }

  return { success: true, eventId }
}

// ---------------------------------------------------------------------------
// Build Tool Definitions from Agent Skills
// Used to inject skills as "tools" into LLM function calling
// ---------------------------------------------------------------------------

export async function buildToolDefinitionsForAgent(agentId: string): Promise<any[]> {
  const agentSkills = await db.agentSkill.findMany({
    where: { agentId, isEnabled: true },
    include: { skill: true },
    orderBy: { priority: 'asc' },
  })

  return agentSkills.map((as) => {
    const skill = as.skill
    let parameters: any[] = []
    try {
      parameters = JSON.parse(skill.parameters)
    } catch {}

    const properties: Record<string, any> = {}
    const required: string[] = []

    for (const param of parameters) {
      properties[param.name] = {
        type: param.type || 'string',
        description: param.description || '',
      }
      if (param.required) {
        required.push(param.name)
      }
    }

    return {
      type: 'function',
      function: {
        name: `skill_${skill.name}`,
        description: skill.description,
        parameters: {
          type: 'object',
          properties,
          required,
        },
      },
    }
  })
}

// ---------------------------------------------------------------------------
// Invoke a Skill (during chat)
// ---------------------------------------------------------------------------

export async function invokeSkill(
  agentId: string,
  skillName: string,
  params: Record<string, any>,
  message: string,
): Promise<{ success: boolean; result?: any; error?: string }> {
  // Find the skill
  const skill = await db.skill.findUnique({
    where: { name: skillName },
  })
  if (!skill) {
    return { success: false, error: `Skill "${skillName}" not found` }
  }

  // Find the agent-skill binding
  const agentSkill = await db.agentSkill.findUnique({
    where: { agentId_skillId: { agentId, skillId: skill.id } },
  })
  if (!agentSkill || !agentSkill.isEnabled) {
    return { success: false, error: `Skill "${skillName}" not installed or disabled on this agent` }
  }

  // Update invocation stats
  await db.agentSkill.update({
    where: { id: agentSkill.id },
    data: {
      lastInvokedAt: new Date(),
      invokeCount: { increment: 1 },
    },
  })

  // Invoke based on handler type
  if (skill.handlerType === 'builtin' && skill.handlerUrl) {
    // Built-in handler — the handlerUrl is a path to a built-in module
    // For now, return a placeholder response
    return {
      success: true,
      result: {
        type: 'builtin',
        skill: skill.displayName,
        message: `Built-in skill "${skill.displayName}" executed successfully`,
        params,
      },
    }
  }

  if (skill.handlerType === 'webhook' || skill.handlerType === 'function') {
    // Use the callback URL if available, otherwise use the handler URL
    const targetUrl = agentSkill.callbackUrl || skill.callbackUrl || skill.handlerUrl
    if (!targetUrl) {
      return { success: false, error: `No callback/handler URL configured for skill "${skillName}"` }
    }

    try {
      const event: SkillEvent = {
        type: 'tool_call',
        data: {
          skillName: skill.name,
          skillDisplayName: skill.displayName,
          params,
          message,
        },
        timestamp: new Date().toISOString(),
        source: 'system',
      }

      const result = await sendCallback(
        targetUrl,
        agentSkill.callbackSecret || skill.callbackSecret,
        event,
        agentId,
        skill.id,
      )

      return result
    } catch (err: any) {
      return { success: false, error: err.message || 'Skill invocation failed' }
    }
  }

  return { success: false, error: `Unknown handler type: ${skill.handlerType}` }
}

// ---------------------------------------------------------------------------
// Check Stale Heartbeats
// ---------------------------------------------------------------------------

export async function checkStaleHeartbeats(): Promise<number> {
  const staleThreshold = new Date(Date.now() - 90_000) // 90 seconds

  // Check connections
  const staleConnections = await db.agentConnection.findMany({
    where: {
      status: 'connected',
      lastPing: { lt: staleThreshold },
      registeredAt: { not: null },
    },
  })

  for (const conn of staleConnections) {
    await db.agentConnection.update({
      where: { id: conn.id },
      data: { status: 'disconnected' },
    })
  }

  return staleConnections.length
}
