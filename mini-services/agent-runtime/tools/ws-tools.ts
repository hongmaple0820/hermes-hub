// ============================================================
// Hermes Agent Runtime 2.0 — WebSocket Tool Execution
// ============================================================

import type { AgentToolConfig, ExecutionContext, ToolResult } from '../types'

const SKILL_WS_URL = process.env.SKILL_WS_URL || 'http://localhost:3004'

/**
 * Execute a tool via WebSocket by forwarding to the skill-ws service.
 * This handles both legacy skills connected via endpointToken and
 * ACRP agents connected via agentToken.
 */
export async function executeWsTool(
  toolConfig: AgentToolConfig,
  params: Record<string, any>,
  context: ExecutionContext,
): Promise<ToolResult> {
  const startTime = Date.now()
  const { handlerConfig, name, id } = toolConfig

  try {
    // Step 1: Check if the agent is connected via ACRP WebSocket
    const acrpStatus = await checkAcrpStatus(context.agentId)
    if (acrpStatus.connected) {
      return await invokeViaAcrp(context, params, acrpStatus)
    }

    // Step 2: Check if the skill is connected via legacy WebSocket
    const skillStatus = await checkSkillWsStatus(context.agentId, id)
    if (skillStatus.connected) {
      return await invokeViaSkillWs(context, name, params)
    }

    // Step 3: Fall back to HTTP callback if configured
    const callbackUrl = handlerConfig.callbackUrl
    if (callbackUrl) {
      return await invokeViaHttpCallback(callbackUrl, toolConfig, params, context)
    }

    return {
      success: false,
      error: `Tool "${name}" is not connected via WebSocket and no callback URL is configured`,
      duration_ms: Date.now() - startTime,
    }
  } catch (err: any) {
    return {
      success: false,
      error: `WebSocket tool execution failed: ${err.message}`,
      duration_ms: Date.now() - startTime,
    }
  }
}

/**
 * Check if agent is connected via ACRP
 */
async function checkAcrpStatus(agentId: string): Promise<{ connected: boolean; capabilities?: any[] }> {
  try {
    const res = await fetch(
      `${SKILL_WS_URL}/internal/acrp-status?agentId=${agentId}`,
      { signal: AbortSignal.timeout(3000) },
    )
    if (!res.ok) return { connected: false }
    const data = await res.json()
    return { connected: data.connected === true, capabilities: data.capabilities }
  } catch {
    return { connected: false }
  }
}

/**
 * Check if skill is connected via legacy WebSocket
 */
async function checkSkillWsStatus(agentId: string, skillId: string): Promise<{ connected: boolean }> {
  try {
    const res = await fetch(
      `${SKILL_WS_URL}/internal/status?agentId=${agentId}&skillId=${skillId}`,
      { signal: AbortSignal.timeout(3000) },
    )
    if (!res.ok) return { connected: false }
    const data = await res.json()
    return { connected: data.connected === true }
  } catch {
    return { connected: false }
  }
}

/**
 * Invoke a tool via ACRP WebSocket
 */
async function invokeViaAcrp(
  context: ExecutionContext,
  params: Record<string, any>,
  status: { connected: boolean; capabilities?: any[] },
): Promise<ToolResult> {
  const startTime = Date.now()

  // Find a suitable capability
  const chatCap = status.capabilities?.find(
    (cap: any) => cap.category === 'chat' || cap.id === 'chat.reply' || cap.id === 'message',
  )
  const capabilityId = chatCap?.id || 'chat.reply'
  const invocationId = `tool_${Date.now()}_${Math.random().toString(36).slice(2)}`

  try {
    const res = await fetch(`${SKILL_WS_URL}/internal/acrp-invoke?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: context.agentId,
        capabilityId,
        params,
        invocationId,
        invokedBy: context.agentId,
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) {
      return {
        success: false,
        error: `ACRP invocation failed (${res.status})`,
        duration_ms: Date.now() - startTime,
      }
    }

    const data = await res.json()
    if (data.success && data.result) {
      const result = data.result.response || data.result.message || data.result.content ||
                     data.result.result || data.result.text ||
                     (typeof data.result === 'string' ? data.result : JSON.stringify(data.result))
      return { success: true, data: result, duration_ms: Date.now() - startTime }
    }

    return {
      success: false,
      error: data.error || 'ACRP invocation returned no result',
      duration_ms: Date.now() - startTime,
    }
  } catch (err: any) {
    return {
      success: false,
      error: `ACRP invocation error: ${err.message}`,
      duration_ms: Date.now() - startTime,
    }
  }
}

/**
 * Invoke a tool via legacy skill WebSocket
 */
async function invokeViaSkillWs(
  context: ExecutionContext,
  skillName: string,
  params: Record<string, any>,
): Promise<ToolResult> {
  const startTime = Date.now()
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`

  try {
    const res = await fetch(`${SKILL_WS_URL}/internal/invoke?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: context.agentId,
        skillName,
        params,
        threadId: context.threadId,
        requestId,
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      return {
        success: false,
        error: `Skill WS invocation failed (${res.status})`,
        duration_ms: Date.now() - startTime,
      }
    }

    const data = await res.json()
    if (data.success && data.result) {
      const result = data.result.response || data.result.message || data.result.content ||
                     data.result.result || JSON.stringify(data.result)
      return { success: true, data: result, duration_ms: Date.now() - startTime }
    }

    return {
      success: false,
      error: data.error || 'Skill WS invocation returned no result',
      duration_ms: Date.now() - startTime,
    }
  } catch (err: any) {
    return {
      success: false,
      error: `Skill WS timeout: ${err.message}`,
      duration_ms: Date.now() - startTime,
    }
  }
}

/**
 * Fall back to HTTP callback for tools that have a callback URL but are not connected via WS
 */
async function invokeViaHttpCallback(
  callbackUrl: string,
  toolConfig: AgentToolConfig,
  params: Record<string, any>,
  context: ExecutionContext,
): Promise<ToolResult> {
  const startTime = Date.now()

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Hermes-Agent-Id': context.agentId,
      'X-Hermes-Tool-Id': toolConfig.id,
    }

    if (toolConfig.handlerConfig.endpointToken) {
      headers['X-Endpoint-Token'] = toolConfig.handlerConfig.endpointToken
    }

    const res = await fetch(callbackUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        agentId: context.agentId,
        toolName: toolConfig.name,
        toolDisplayName: toolConfig.displayName,
        params,
        threadId: context.threadId,
        runId: context.runId,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      return {
        success: false,
        error: `HTTP callback failed (${res.status})`,
        duration_ms: Date.now() - startTime,
      }
    }

    const data = await res.json().catch(() => ({ response: 'Tool executed' }))
    const result = data.response || data.message || data.content || data.result || JSON.stringify(data)

    return { success: true, data: result, duration_ms: Date.now() - startTime }
  } catch (err: any) {
    return {
      success: false,
      error: `HTTP callback failed: ${err.message}`,
      duration_ms: Date.now() - startTime,
    }
  }
}
