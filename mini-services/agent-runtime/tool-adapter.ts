/**
 * Tool Adapter — Maps our Tool/AgentTool DB models to pi-agent-core's AgentTool interface.
 *
 * Responsibilities:
 *   1. Convert JSON Schema parameters to TypeBox schema (or pass through as pi-ai accepts JSON Schema)
 *   2. Create AgentTool objects with proper execute functions
 *   3. Handle different handler types: builtin (use registry), http (fetch callback), websocket (via skill-ws)
 *   4. Support beforeToolCall/afterToolCall hooks for audit and permission
 */

import { Type } from '@earendil-works/pi-ai'
import type { AgentTool } from '@earendil-works/pi-agent-core'
import type { ToolConfig, AgentToolConfig } from './types'
import { getBuiltinTool } from './builtin-tools'

// ============================================================================
// JSON Schema → TypeBox Conversion
// ============================================================================

/**
 * Convert a JSON Schema object to a TypeBox schema.
 * pi-ai's Type utility provides TypeBox-compatible schema builders.
 * For complex schemas, we pass through the raw JSON Schema.
 */
export function jsonSchemaToTypeBox(schema: Record<string, any>): any {
  if (!schema || Object.keys(schema).length === 0) {
    return Type.Object({})
  }

  // If it's already a valid schema with type: 'object', pass it through
  // pi-ai accepts raw JSON Schema in Type.Object
  if (schema.type === 'object') {
    return schema as any
  }

  // For other schema types, wrap in an object
  return Type.Object({ input: schema }) as any
}

/**
 * Parse a JSON Schema string into a schema object.
 */
export function parseParameterSchema(paramStr: string): Record<string, any> {
  try {
    const parsed = JSON.parse(paramStr || '{}')
    return parsed
  } catch {
    return {}
  }
}

// ============================================================================
// Tool Execution: HTTP Handler
// ============================================================================

async function executeHttpTool(
  toolConfig: ToolConfig,
  handlerConfig: { url: string; method?: string; headers?: Record<string, string>; auth?: { type: string; token: string } },
  params: Record<string, any>,
  signal: AbortSignal,
): Promise<{ content: { type: string; text: string }[]; details?: any }> {
  const { url, method = 'POST', headers = {}, auth } = handlerConfig

  // Add auth headers if configured
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  }

  if (auth) {
    if (auth.type === 'bearer') {
      requestHeaders['Authorization'] = `Bearer ${auth.token}`
    } else if (auth.type === 'api_key') {
      requestHeaders['X-API-Key'] = auth.token
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: JSON.stringify(params),
      signal,
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        content: [{ type: 'text', text: `HTTP ${response.status}: ${errorText}` }],
        details: { status: response.status, error: true },
      }
    }

    const data = await response.json()
    const resultText = typeof data === 'string'
      ? data
      : data.response || data.message || data.content || data.result || JSON.stringify(data)

    return {
      content: [{ type: 'text', text: resultText }],
      details: { status: response.status, data },
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        content: [{ type: 'text', text: 'Tool execution was cancelled' }],
        details: { aborted: true },
      }
    }
    return {
      content: [{ type: 'text', text: `HTTP request failed: ${err.message}` }],
      details: { error: true },
    }
  }
}

// ============================================================================
// Tool Execution: WebSocket Handler (via skill-ws service)
// ============================================================================

async function executeWebSocketTool(
  toolConfig: ToolConfig,
  handlerConfig: { agentId: string; capabilityId?: string },
  params: Record<string, any>,
  signal: AbortSignal,
): Promise<{ content: { type: string; text: string }[]; details?: any }> {
  const SKILL_WS_URL = process.env.SKILL_WS_URL || 'http://localhost:3004'
  const { agentId, capabilityId = toolConfig.name } = handlerConfig
  const invocationId = `tool_${Date.now()}_${Math.random().toString(36).slice(2)}`

  try {
    // First check if agent is connected via ACRP
    const statusRes = await fetch(
      `${SKILL_WS_URL}/internal/acrp-status?agentId=${agentId}`,
      { signal: AbortSignal.timeout(3000) },
    )

    if (!statusRes.ok) {
      return {
        content: [{ type: 'text', text: `Remote agent not available (service error)` }],
        details: { error: true },
      }
    }

    const statusData = await statusRes.json()
    if (!statusData.connected) {
      return {
        content: [{ type: 'text', text: `Remote agent is offline` }],
        details: { offline: true },
      }
    }

    // Try ACRP invocation
    const invokeRes = await fetch(`${SKILL_WS_URL}/internal/acrp-invoke?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        capabilityId,
        params,
        invocationId,
        invokedBy: 'agent-runtime',
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (invokeRes.ok) {
      const data = await invokeRes.json()
      if (data.success && data.result) {
        const text = data.result.response || data.result.message || data.result.content ||
          data.result.result || JSON.stringify(data.result)
        return {
          content: [{ type: 'text', text }],
          details: { invocationId, source: 'acrp' },
        }
      } else {
        return {
          content: [{ type: 'text', text: data.error || 'No result from remote agent' }],
          details: { invocationId, error: true },
        }
      }
    } else {
      return {
        content: [{ type: 'text', text: `Remote agent invocation failed (${invokeRes.status})` }],
        details: { error: true, status: invokeRes.status },
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      return {
        content: [{ type: 'text', text: 'Tool execution was cancelled' }],
        details: { aborted: true },
      }
    }
    return {
      content: [{ type: 'text', text: `WebSocket tool failed: ${err.message}` }],
      details: { error: true },
    }
  }
}

// ============================================================================
// DB Tool Config → pi AgentTool Conversion
// ============================================================================

/**
 * Convert a ToolConfig from our DB into a pi-agent-core AgentTool.
 */
export function createAgentToolFromConfig(toolConfig: ToolConfig): AgentTool {
  const paramSchema = parseParameterSchema(toolConfig.parameters)

  // Check if it's a builtin tool — use the registry
  if (toolConfig.handlerType === 'builtin') {
    const builtin = getBuiltinTool(toolConfig.name)
    if (builtin) {
      return builtin
    }
    // If not found in registry, create a stub that returns an error
    return createStubTool(toolConfig)
  }

  // Parse handler config
  const handlerConfig = parseHandlerConfig(toolConfig.handlerConfig)

  // Create the execute function based on handler type
  const execute = async (
    toolCallId: string,
    params: any,
    signal: AbortSignal,
    onUpdate?: (update: any) => void,
  ) => {
    if (toolConfig.handlerType === 'http') {
      return executeHttpTool(toolConfig, handlerConfig, params, signal)
    } else if (toolConfig.handlerType === 'websocket') {
      return executeWebSocketTool(toolConfig, handlerConfig, params, signal)
    } else if (toolConfig.handlerType === 'code') {
      // Code execution — sandbox (future)
      return {
        content: [{ type: 'text', text: 'Code execution is not yet supported' }],
        details: { unsupported: true },
      }
    } else {
      return {
        content: [{ type: 'text', text: `Unknown handler type: ${toolConfig.handlerType}` }],
        details: { error: true },
      }
    }
  }

  return {
    name: toolConfig.name,
    label: toolConfig.displayName,
    description: toolConfig.description,
    parameters: paramSchema,
    execute,
  }
}

/**
 * Convert an array of AgentToolConfig (with nested ToolConfig) into pi AgentTool[].
 */
export function createAgentToolsFromConfigs(configs: AgentToolConfig[]): AgentTool[] {
  const tools: AgentTool[] = []

  for (const config of configs) {
    if (!config.isEnabled) continue
    if (!config.tool) continue

    try {
      const tool = createAgentToolFromConfig(config.tool)
      tools.push(tool)
    } catch (err: any) {
      console.warn(`[TOOL-ADAPTER] Failed to create tool ${config.tool.name}: ${err.message}`)
    }
  }

  // Sort by priority
  tools.sort((a, b) => {
    const aConfig = configs.find(c => c.tool?.name === a.name)
    const bConfig = configs.find(c => c.tool?.name === b.name)
    return (aConfig?.priority ?? 0) - (bConfig?.priority ?? 0)
  })

  return tools
}

/**
 * Create a stub tool that returns an error message.
 */
function createStubTool(toolConfig: ToolConfig): AgentTool {
  return {
    name: toolConfig.name,
    label: toolConfig.displayName,
    description: toolConfig.description || 'Tool not available',
    parameters: Type.Object({}),
    execute: async () => ({
      content: [{ type: 'text', text: `Tool "${toolConfig.name}" is not currently available` }],
      details: { unavailable: true },
    }),
  }
}

/**
 * Parse handler config JSON string.
 */
function parseHandlerConfig(configStr: string): Record<string, any> {
  try {
    return JSON.parse(configStr || '{}')
  } catch {
    return {}
  }
}

// ============================================================================
// Legacy AgentSkillConfig → pi AgentTool Conversion
// ============================================================================

/**
 * Convert legacy AgentSkillConfig objects (from agent:message events) into pi AgentTool[].
 * This maintains backward compatibility with the chat-service's skill-based approach.
 */
export function createToolsFromSkills(skills: import('./types').AgentSkillConfig[]): AgentTool[] {
  return skills
    .filter(skill => skill.isEnabled)
    .map(skill => {
      // Parse parameters from skill config
      let paramProperties: Record<string, any> = {}
      let required: string[] = []
      try {
        const params = JSON.parse(skill.parameters || '[]')
        if (Array.isArray(params)) {
          for (const param of params) {
            paramProperties[param.name] = {
              type: param.type || 'string',
              description: param.description || '',
            }
            if (param.required) required.push(param.name)
          }
        }
      } catch {}

      const schema = {
        type: 'object' as const,
        properties: paramProperties,
        ...(required.length > 0 ? { required } : {}),
      }

      const execute = async (
        toolCallId: string,
        params: any,
        signal: AbortSignal,
      ) => {
        const SKILL_WS_URL = process.env.SKILL_WS_URL || 'http://localhost:3004'

        // Try WebSocket invocation first
        let wsConnected = false
        try {
          const statusRes = await fetch(
            `${SKILL_WS_URL}/internal/status`,
            { signal: AbortSignal.timeout(3000) },
          )
          if (statusRes.ok) {
            const statusData = await statusRes.json()
            wsConnected = statusData.connected === true
          }
        } catch {}

        if (wsConnected) {
          const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`
          try {
            const invokeRes = await fetch(`${SKILL_WS_URL}/internal/invoke?wait=true`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                skillName: skill.skillName,
                params,
                requestId,
              }),
              signal: AbortSignal.timeout(30000),
            })

            if (invokeRes.ok) {
              const data = await invokeRes.json()
              if (data.success && data.result) {
                const text = data.result.response || data.result.message || data.result.content ||
                  data.result.result || JSON.stringify(data.result)
                return {
                  content: [{ type: 'text', text }],
                  details: { query: params },
                }
              }
              return {
                content: [{ type: 'text', text: data.error || 'WS invocation returned no result' }],
              }
            }
          } catch {}
        }

        // Fallback: HTTP callback
        const targetUrl = skill.callbackUrl || skill.handlerUrl
        if (targetUrl) {
          try {
            const response = await fetch(targetUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                skillName: skill.skillName,
                arguments: params,
                timestamp: new Date().toISOString(),
              }),
              signal: AbortSignal.timeout(15000),
            })

            if (response.ok) {
              const data = await response.json().catch(() => ({ response: 'Skill executed' }))
              const text = data.response || data.message || data.content || data.result || JSON.stringify(data)
              return {
                content: [{ type: 'text', text }],
                details: { query: params },
              }
            }
            return {
              content: [{ type: 'text', text: `Skill callback failed (${response.status})` }],
            }
          } catch (err: any) {
            return {
              content: [{ type: 'text', text: `Skill callback failed: ${err.message}` }],
            }
          }
        }

        return {
          content: [{ type: 'text', text: `No callback/handler configured for skill "${skill.skillDisplayName}"` }],
        }
      }

      return {
        name: `skill_${skill.skillName}`,
        label: skill.skillDisplayName,
        description: skill.skillDisplayName,
        parameters: schema,
        execute,
      }
    })
}
