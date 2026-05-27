// ============================================================
// Hermes Agent Runtime 2.0 — Tool Execution Registry
// ============================================================

import type { BuiltinToolImplementation, ExecutionContext, ToolResult, AgentToolConfig } from '../types'
import { getBuiltinTool } from './builtin-tools'
import { executeWsTool } from './ws-tools'

export class ToolRegistry {
  private customBuiltinTools: Map<string, BuiltinToolImplementation> = new Map()

  /**
   * Register a custom built-in tool implementation
   */
  registerBuiltin(name: string, impl: BuiltinToolImplementation): void {
    this.customBuiltinTools.set(name, impl)
  }

  /**
   * Execute a tool based on its configuration
   */
  async execute(
    toolConfig: AgentToolConfig,
    params: Record<string, any>,
    context: ExecutionContext,
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const { handlerType, handlerConfig, name } = toolConfig

    try {
      switch (handlerType) {
        case 'builtin':
          return await this.executeBuiltin(name, params, context)

        case 'http':
          return await this.executeHttp(handlerConfig, params, context)

        case 'websocket':
          return await executeWsTool(toolConfig, params, context)

        case 'webhook':
          // Webhook is an alias for http in this context
          return await this.executeHttp(handlerConfig, params, context)

        default:
          return {
            success: false,
            error: `Unknown handler type: ${handlerType}`,
            duration_ms: Date.now() - startTime,
          }
      }
    } catch (err: any) {
      return {
        success: false,
        error: `Tool execution error: ${err.message}`,
        duration_ms: Date.now() - startTime,
      }
    }
  }

  /**
   * Execute a built-in tool
   */
  private async executeBuiltin(
    name: string,
    params: Record<string, any>,
    context: ExecutionContext,
  ): Promise<ToolResult> {
    // Check custom registered tools first
    const customTool = this.customBuiltinTools.get(name)
    if (customTool) {
      return customTool.execute(params, context)
    }

    // Check built-in tools
    const builtinTool = getBuiltinTool(name)
    if (builtinTool) {
      return builtinTool.execute(params, context)
    }

    return {
      success: false,
      error: `Built-in tool "${name}" not found`,
    }
  }

  /**
   * Execute an HTTP-based tool (callback to external service)
   */
  private async executeHttp(
    handlerConfig: Record<string, any>,
    params: Record<string, any>,
    context: ExecutionContext,
  ): Promise<ToolResult> {
    const startTime = Date.now()
    const url = handlerConfig.callbackUrl || handlerConfig.url

    if (!url) {
      return {
        success: false,
        error: 'No callback URL configured for HTTP tool',
        duration_ms: Date.now() - startTime,
      }
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Hermes-Agent-Id': context.agentId,
        'X-Hermes-Thread-Id': context.threadId,
        'X-Hermes-Run-Id': context.runId,
      }

      // Add auth if configured
      if (handlerConfig.authToken) {
        headers['Authorization'] = `Bearer ${handlerConfig.authToken}`
      }
      if (handlerConfig.callbackSecret) {
        headers['X-Hermes-Signature'] = handlerConfig.callbackSecret
      }
      if (handlerConfig.endpointToken) {
        headers['X-Endpoint-Token'] = handlerConfig.endpointToken
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          agentId: context.agentId,
          threadId: context.threadId,
          runId: context.runId,
          params,
          timestamp: new Date().toISOString(),
        }),
        signal: AbortSignal.timeout(handlerConfig.timeout || 15000),
      })

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP tool callback failed with status ${response.status}`,
          duration_ms: Date.now() - startTime,
        }
      }

      const data = await response.json().catch(() => ({ response: 'Tool executed' }))
      const result = data.response || data.message || data.content || data.result || data

      return {
        success: true,
        data: result,
        duration_ms: Date.now() - startTime,
      }
    } catch (err: any) {
      return {
        success: false,
        error: `HTTP tool execution failed: ${err.message}`,
        duration_ms: Date.now() - startTime,
      }
    }
  }
}

// Singleton instance
export const toolRegistry = new ToolRegistry()
