/**
 * Runtime Engine v3 — Core agent execution using pi-agent-core's Agent class
 *
 * Replaces the old raw-fetch-based LLM loop with:
 *   - pi-agent-core's Agent class for structured execution
 *   - Event subscription for streaming, tool calls, and status updates
 *   - Steering (interrupt mid-execution)
 *   - Follow-up (queue work after completion)
 *   - Abort (cancel execution)
 *   - Token tracking from pi events
 *
 * Event mapping:
 *   Pi Event              →  Socket.IO Event
 *   ─────────────────────────────────────────
 *   agent_start           →  run:created
 *   turn_start            →  run:step-update (type: message_creation)
 *   message_update (delta)→  run:stream
 *   tool_execution_start  →  run:step-update (type: tool_execution, status: in_progress)
 *   tool_execution_end    →  run:step-update (type: tool_execution, status: completed)
 *   turn_end              →  run:step-update (type: message_creation, status: completed)
 *   agent_end             →  run:complete
 */

import { Agent } from '@earendil-works/pi-agent-core'
import type { AgentTool } from '@earendil-works/pi-agent-core'
import type { Server } from 'socket.io'
import {
  type ExecuteRunRequest,
  type RunStatus,
  type StepInfo,
  type LLMProviderConfig,
} from './types'
import { createModelForRun, resolvePiProvider, parseProviderConfig } from './provider-adapter'
import { createAgentToolsFromConfigs, createToolsFromSkills } from './tool-adapter'
import { getAllBuiltinTools } from './builtin-tools'

// ============================================================================
// Active Run Tracking
// ============================================================================

interface ActiveRun {
  runId: string
  threadId: string
  agentId: string
  userId: string
  agent: Agent
  status: RunStatus
  startedAt: Date
  inputTokens: number
  outputTokens: number
  totalSteps: number
  cleanup: (() => void) | null
  fullResponse: string
}

const activeRuns = new Map<string, ActiveRun>()      // runId → ActiveRun
const threadRuns = new Map<string, string>()           // threadId → runId

/**
 * Get the number of currently active runs.
 */
export function getActiveRunCount(): number {
  return activeRuns.size
}

/**
 * Shutdown all active runs — abort agents and clean up resources.
 * Called during graceful server shutdown.
 */
export function shutdownAllRuns(): void {
  for (const [runId, run] of activeRuns.entries()) {
    try {
      run.agent?.abort()
      run.cleanup?.()
    } catch {}
  }
  activeRuns.clear()
  threadRuns.clear()
}

/**
 * Get status info for a run.
 */
export function getRunStatus(runId: string): ActiveRun | undefined {
  return activeRuns.get(runId)
}

/**
 * Get the active run ID for a thread.
 */
export function getActiveRunForThread(threadId: string): string | undefined {
  return threadRuns.get(threadId)
}

// ============================================================================
// Run Execution
// ============================================================================

/**
 * Execute a new run using pi-agent-core's Agent class.
 *
 * This creates an Agent instance, subscribes to its events, prompts it,
 * and maps the events to Socket.IO emissions for the frontend.
 */
export async function executeRun(
  io: Server,
  request: ExecuteRunRequest,
): Promise<{ runId: string; threadId: string; status: RunStatus }> {
  const {
    threadId,
    agentId,
    userId,
    message,
    providerConfig,
    tools: toolConfigs,
    systemPrompt,
    modelOverride,
    config: runConfig,
  } = request

  const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const roomKey = `thread:${threadId}`

  console.log(`[RUNTIME] Starting run ${runId} for thread ${threadId}, agent ${agentId}`)

  // 1. Create model from provider config
  let model: any
  let cleanup: (() => void) | null = null
  let usePiAgent = true

  try {
    const result = createModelForRun(providerConfig)
    model = result.model
    cleanup = result.cleanup
  } catch (err: any) {
    console.warn(`[RUNTIME] Failed to create pi-ai model: ${err.message}. Will try fallback.`)
    usePiAgent = false
  }

  // 2. Assemble tools
  let tools: AgentTool[] = []

  // Add built-in tools always
  tools.push(...getAllBuiltinTools())

  // Add DB-configured tools if provided
  if (toolConfigs && toolConfigs.length > 0) {
    tools.push(...createAgentToolsFromConfigs(toolConfigs))
  }

  // 3. Build system prompt
  const finalSystemPrompt = systemPrompt || 'You are a helpful AI assistant. Use the available tools when needed to provide accurate and helpful responses.'

  // 4. Parse config options
  const providerOpts = parseProviderConfig(providerConfig.config)
  const temperature = runConfig?.temperature ?? providerOpts.temperature
  const maxTokens = runConfig?.maxTokens ?? providerOpts.maxTokens
  const thinkingLevel = runConfig?.thinkingLevel ?? 'off'
  const toolExecution = runConfig?.toolExecution ?? 'parallel'

  // 5. If pi-agent-core is not available, fall back to direct streaming
  if (!usePiAgent) {
    return executeRunFallback(io, runId, threadId, agentId, userId, message, providerConfig, finalSystemPrompt, tools, roomKey)
  }

  // 6. Create pi-agent-core Agent instance
  let agent: Agent
  try {
    agent = new Agent({
      initialState: {
        systemPrompt: finalSystemPrompt,
        model,
        thinkingLevel,
        tools,
        messages: [],
      },
      toolExecution,
      beforeToolCall: async ({ toolCall, args }) => {
        console.log(`[RUNTIME:${runId}] Tool call: ${toolCall.name} with args:`, JSON.stringify(args).substring(0, 200))
        // Could add permission checks here
        return undefined // Allow execution
      },
      afterToolCall: async ({ toolCall, result }) => {
        console.log(`[RUNTIME:${runId}] Tool result: ${toolCall.name} → ${(JSON.stringify(result)).substring(0, 200)}`)
        return undefined
      },
    })
  } catch (err: any) {
    console.error(`[RUNTIME:${runId}] Failed to create Agent: ${err.message}`)
    cleanup?.()
    // Emit error
    io.to(roomKey).emit('run:error', {
      runId,
      threadId,
      error: `Failed to create agent: ${err.message}`,
      timestamp: new Date().toISOString(),
    })
    return { runId, threadId, status: 'failed' }
  }

  // 7. Track the active run
  const activeRun: ActiveRun = {
    runId,
    threadId,
    agentId,
    userId,
    agent,
    status: 'in_progress',
    startedAt: new Date(),
    inputTokens: 0,
    outputTokens: 0,
    totalSteps: 0,
    cleanup,
    fullResponse: '',
  }
  activeRuns.set(runId, activeRun)
  threadRuns.set(threadId, runId)

  // 8. Subscribe to agent events and map to Socket.IO
  let currentStepId: string | null = null
  let currentToolStepId: string | null = null

  agent.subscribe((event: any) => {
    try {
      handleAgentEvent(io, roomKey, runId, threadId, agentId, activeRun, event)
    } catch (err: any) {
      console.error(`[RUNTIME:${runId}] Error handling agent event:`, err.message)
    }
  })

  // 9. Emit run:created
  io.to(roomKey).emit('run:created', {
    runId,
    threadId,
    timestamp: new Date().toISOString(),
  })

  // 10. Prompt the agent (async, don't await to allow event streaming)
  agent.prompt(message).then(() => {
    // Run completed successfully
    activeRun.status = 'completed'
    activeRun.cleanup = null

    io.to(roomKey).emit('run:complete', {
      runId,
      threadId,
      status: 'completed',
      inputTokens: activeRun.inputTokens,
      outputTokens: activeRun.outputTokens,
      timestamp: new Date().toISOString(),
    })

    // Persist run result via Next.js API
    persistRunResult(runId, 'completed', activeRun.inputTokens, activeRun.outputTokens, activeRun.totalSteps).catch((err) =>
      console.error(`[RUNTIME:${runId}] Failed to persist run result:`, err.message),
    )

    console.log(`[RUNTIME:${runId}] Run completed. Input: ${activeRun.inputTokens}, Output: ${activeRun.outputTokens}, Steps: ${activeRun.totalSteps}`)
  }).catch((err: any) => {
    activeRun.status = 'failed'

    io.to(roomKey).emit('run:error', {
      runId,
      threadId,
      error: err.message || 'Run failed',
      timestamp: new Date().toISOString(),
    })

    // Persist run failure
    persistRunResult(runId, 'failed', activeRun.inputTokens, activeRun.outputTokens, activeRun.totalSteps, err.message).catch(() => {})

    console.error(`[RUNTIME:${runId}] Run failed:`, err.message)
  }).finally(() => {
    // Cleanup
    cleanup?.()
    activeRuns.delete(runId)
    threadRuns.delete(threadId)
  })

  return { runId, threadId, status: 'in_progress' }
}

// ============================================================================
// Agent Event Handler
// ============================================================================

function handleAgentEvent(
  io: Server,
  roomKey: string,
  runId: string,
  threadId: string,
  agentId: string,
  activeRun: ActiveRun,
  event: any,
) {
  const timestamp = new Date().toISOString()

  switch (event.type) {
    case 'agent_start': {
      // Agent has started processing
      activeRun.status = 'in_progress'
      break
    }

    case 'turn_start': {
      // A new turn/message creation has started
      activeRun.totalSteps++
      const stepId = `step_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const step: StepInfo = {
        id: stepId,
        runId,
        type: 'message_creation',
        status: 'in_progress',
        detail: '{}',
        startedAt: timestamp,
        createdAt: timestamp,
      }

      io.to(roomKey).emit('run:step-update', { runId, threadId, step, timestamp })
      break
    }

    case 'message_start': {
      // LLM started generating a message
      break
    }

    case 'message_update': {
      // Streaming text delta from the LLM
      // Pi event structure: { type: "message_update", message, assistantMessageEvent }
      // assistantMessageEvent can be: { type: "text_delta", delta: string }
      //                                 { type: "thinking_delta", delta: string }
      //                                 { type: "toolcall_delta", ... }
      const assistantEvent = event.assistantMessageEvent
      if (assistantEvent?.type === 'text_delta' && assistantEvent.delta) {
        activeRun.fullResponse += assistantEvent.delta
        io.to(roomKey).emit('run:stream', {
          runId,
          threadId,
          delta: assistantEvent.delta,
          timestamp,
        })
      } else if (assistantEvent?.type === 'thinking_delta' && assistantEvent.delta) {
        // Forward thinking/reasoning tokens as a separate event type
        io.to(roomKey).emit('run:thinking', {
          runId,
          threadId,
          delta: assistantEvent.delta,
          timestamp,
        })
      }

      // Track tokens from message usage if available
      const msgUsage = event.message?.usage
      if (msgUsage) {
        activeRun.inputTokens = msgUsage.input || msgUsage.inputTokens || activeRun.inputTokens
        activeRun.outputTokens = msgUsage.output || msgUsage.outputTokens || activeRun.outputTokens
      }
      break
    }

    case 'message_end': {
      // LLM finished generating a message
      // Track token usage from the complete message
      const endUsage = event.message?.usage
      if (endUsage) {
        activeRun.inputTokens = endUsage.input || endUsage.inputTokens || activeRun.inputTokens
        activeRun.outputTokens = endUsage.output || endUsage.outputTokens || activeRun.outputTokens
      }

      const step: StepInfo = {
        id: `step_${Date.now()}`,
        runId,
        type: 'message_creation',
        status: 'completed',
        detail: JSON.stringify({ messageLength: activeRun.fullResponse.length }),
        completedAt: timestamp,
        createdAt: timestamp,
      }

      io.to(roomKey).emit('run:step-update', { runId, threadId, step, timestamp })
      break
    }

    case 'tool_execution_start': {
      // A tool is being executed
      // Pi event: { type: "tool_execution_start", toolCallId, toolName, args }
      activeRun.totalSteps++
      const toolName = event.toolName || 'unknown'
      const toolArgs = event.args || {}
      const step: StepInfo = {
        id: `step_${Date.now()}`,
        runId,
        type: 'tool_execution',
        status: 'in_progress',
        detail: JSON.stringify({ name: toolName, arguments: toolArgs }),
        startedAt: timestamp,
        createdAt: timestamp,
      }

      io.to(roomKey).emit('run:step-update', { runId, threadId, step, timestamp })

      // Also stream a visual indicator
      io.to(roomKey).emit('run:stream', {
        runId,
        threadId,
        delta: `\n🔧 **Using tool: ${toolName}**\n`,
        timestamp,
      })
      break
    }

    case 'tool_execution_update': {
      // Tool execution progress
      // Pi event: { type: "tool_execution_update", toolCallId, toolName, args, partialResult }
      break
    }

    case 'tool_execution_end': {
      // Tool execution completed
      // Pi event: { type: "tool_execution_end", toolCallId, toolName, result, isError }
      const toolName = event.toolName || 'unknown'
      const toolResult = event.result
      const isError = event.isError

      const step: StepInfo = {
        id: `step_${Date.now()}`,
        runId,
        type: 'tool_execution',
        status: isError ? 'failed' : 'completed',
        detail: JSON.stringify({
          name: toolName,
          result: typeof toolResult === 'string' ? toolResult.substring(0, 500) : toolResult,
          isError,
        }),
        completedAt: timestamp,
        createdAt: timestamp,
      }

      io.to(roomKey).emit('run:step-update', { runId, threadId, step, timestamp })

      // Stream a brief result indicator
      if (toolResult) {
        const resultText = typeof toolResult === 'string'
          ? toolResult.substring(0, 200)
          : JSON.stringify(toolResult).substring(0, 200)
        activeRun.fullResponse += `\n🔧 ${toolName}: ${resultText}\n`
        io.to(roomKey).emit('run:stream', {
          runId,
          threadId,
          delta: `\n🔧 **${toolName} result**: ${resultText}\n`,
          timestamp,
        })
      }
      break
    }

    case 'turn_end': {
      // Turn completed
      break
    }

    case 'agent_end': {
      // Agent has finished all processing
      break
    }

    default: {
      // Unknown event type — log but don't crash
      console.log(`[RUNTIME:${runId}] Unknown agent event: ${event.type}`)
    }
  }
}

// ============================================================================
// Steering, Follow-up, and Abort
// ============================================================================

/**
 * Steer (interrupt) an active run with a new message.
 */
export function steerRun(runId: string, content: string): boolean {
  const run = activeRuns.get(runId)
  if (!run || run.status !== 'in_progress') return false

  try {
    run.agent.steer({
      role: 'user',
      content,
      timestamp: Date.now(),
    })
    console.log(`[RUNTIME:${runId}] Steered with: ${content.substring(0, 100)}`)
    return true
  } catch (err: any) {
    console.error(`[RUNTIME:${runId}] Failed to steer: ${err.message}`)
    return false
  }
}

/**
 * Queue follow-up work after the current run finishes.
 */
export function followUpRun(runId: string, content: string): boolean {
  const run = activeRuns.get(runId)
  if (!run || run.status !== 'in_progress') return false

  try {
    run.agent.followUp({
      role: 'user',
      content,
      timestamp: Date.now(),
    })
    console.log(`[RUNTIME:${runId}] Queued follow-up: ${content.substring(0, 100)}`)
    return true
  } catch (err: any) {
    console.error(`[RUNTIME:${runId}] Failed to queue follow-up: ${err.message}`)
    return false
  }
}

/**
 * Abort an active run.
 */
export function abortRun(runId: string): boolean {
  const run = activeRuns.get(runId)
  if (!run) return false

  try {
    run.agent.abort()
    run.status = 'cancelled'
    run.cleanup?.()
    activeRuns.delete(runId)
    // Also clean up threadRuns
    for (const [tid, rid] of threadRuns.entries()) {
      if (rid === runId) {
        threadRuns.delete(tid)
        break
      }
    }
    console.log(`[RUNTIME:${runId}] Run aborted`)
    return true
  } catch (err: any) {
    console.error(`[RUNTIME:${runId}] Failed to abort: ${err.message}`)
    return false
  }
}

// ============================================================================
// Legacy Agent Message Handler (backward compatibility)
// ============================================================================

/**
 * Handle the legacy `agent:message` event from chat-service.
 * Bridges to the new pi-agent-core runtime while maintaining the same
 * Socket.IO event format (agent:typing, agent:stream, agent:stream-complete).
 */
export async function handleLegacyAgentMessage(
  io: Server,
  data: import('./types').AgentMessagePayload,
): Promise<void> {
  const { conversationId, agentConfig, message, userId } = data
  const roomKey = `chat:${conversationId}`

  console.log(`[RUNTIME:LEGACY] Agent message for ${agentConfig.name} (${agentConfig.agentId})`)

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
      await handleLegacyBuiltinAgent(io, roomKey, conversationId, agentConfig, message)
    } else if (agentConfig.mode === 'custom_api') {
      await handleLegacyCustomApiAgent(io, roomKey, conversationId, agentConfig, message)
    } else if (agentConfig.mode === 'hermes') {
      await handleLegacyHermesAgent(io, roomKey, conversationId, agentConfig, message)
    } else if (agentConfig.mode === 'acrp') {
      await handleLegacyAcrpAgent(io, roomKey, conversationId, agentConfig, message)
    } else {
      throw new Error(`Unknown agent mode: ${agentConfig.mode}`)
    }
  } catch (err: any) {
    console.error(`[RUNTIME:LEGACY] Error:`, err.message)

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
}

/**
 * Handle builtin mode agent using pi-agent-core.
 */
async function handleLegacyBuiltinAgent(
  io: Server,
  roomKey: string,
  conversationId: string,
  agentConfig: import('./types').AgentConfig,
  message: string,
): Promise<void> {
  const provider = agentConfig.provider || 'openai'
  const model = agentConfig.model || 'gpt-4o-mini'
  const apiKey = agentConfig.apiKey

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

  // Build provider config from agent config
  const providerConfig: LLMProviderConfig = {
    id: 'legacy',
    userId: 'legacy',
    name: agentConfig.name,
    provider,
    apiKey,
    baseUrl: agentConfig.baseUrl,
    models: JSON.stringify([model]),
    defaultModel: model,
    isActive: true,
    config: '{}',
  }

  // Build tools from skills
  const tools: AgentTool[] = [...getAllBuiltinTools()]
  if (agentConfig.skills && agentConfig.skills.length > 0) {
    tools.push(...createToolsFromSkills(agentConfig.skills))
  }

  // Set API key
  const piProvider = resolvePiProvider(provider)
  const envKey = `${piProvider.toUpperCase()}_API_KEY`
  const prevKey = process.env[envKey]
  process.env[envKey] = apiKey

  // Set base URL if custom
  let prevBaseUrl: string | undefined
  if (providerConfig.baseUrl && (provider === 'custom' || provider === 'ollama')) {
    const baseEnvKey = provider === 'ollama' ? 'OLLAMA_API_BASE' : 'OPENAI_BASE_URL'
    prevBaseUrl = process.env[baseEnvKey]
    process.env[baseEnvKey] = providerConfig.baseUrl!
  }

  try {
    // Try using pi-agent-core
    const { getModel } = await import('@earendil-works/pi-ai')
    const piModel = getModel(piProvider, model)

    const agent = new Agent({
      initialState: {
        systemPrompt: agentConfig.systemPrompt || 'You are a helpful AI assistant.',
        model: piModel,
        thinkingLevel: 'off',
        tools,
        messages: [],
      },
      toolExecution: 'parallel',
    })

    let fullResponse = ''

    agent.subscribe((event: any) => {
      const ts = new Date().toISOString()

      if (event.type === 'message_update') {
        // Pi event: { type: "message_update", message, assistantMessageEvent }
        const assistantEvent = event.assistantMessageEvent
        if (assistantEvent?.type === 'text_delta' && assistantEvent.delta) {
          fullResponse += assistantEvent.delta
          io.to(roomKey).emit('agent:stream', {
            conversationId,
            agentId: agentConfig.agentId,
            chunk: assistantEvent.delta,
            timestamp: ts,
          })
        }
      } else if (event.type === 'tool_execution_start') {
        const toolName = event.toolName || 'unknown'
        io.to(roomKey).emit('agent:stream', {
          conversationId,
          agentId: agentConfig.agentId,
          chunk: `\n🔧 **Using tool: ${toolName}**\n`,
          timestamp: ts,
        })
      } else if (event.type === 'tool_execution_end') {
        const toolName = event.toolName || 'unknown'
        const result = event.result
        if (result) {
          const resultText = typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200)
          fullResponse += `\n🔧 ${toolName}: ${resultText}\n`
          io.to(roomKey).emit('agent:stream', {
            conversationId,
            agentId: agentConfig.agentId,
            chunk: `\n🔧 **${toolName} result**: ${resultText}\n`,
            timestamp: ts,
          })
        }
      }
    })

    await agent.prompt(message)

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
    })

    console.log(`[RUNTIME:LEGACY] Completed builtin agent response, length: ${fullResponse.length}`)
  } catch (err: any) {
    console.warn(`[RUNTIME:LEGACY] Pi-agent-core failed: ${err.message}. Using raw fetch fallback.`)

    // Fallback to raw OpenAI-compatible streaming
    await rawFetchFallback(io, roomKey, conversationId, agentConfig, message)
  } finally {
    // Restore env
    if (prevKey === undefined) delete process.env[envKey]
    else process.env[envKey] = prevKey

    if (prevBaseUrl !== undefined) {
      const baseEnvKey = provider === 'ollama' ? 'OLLAMA_API_BASE' : 'OPENAI_BASE_URL'
      if (prevBaseUrl === undefined) delete process.env[baseEnvKey]
      else process.env[baseEnvKey] = prevBaseUrl
    }
  }
}

/**
 * Raw OpenAI-compatible streaming fallback when pi-agent-core is unavailable.
 */
async function rawFetchFallback(
  io: Server,
  roomKey: string,
  conversationId: string,
  agentConfig: import('./types').AgentConfig,
  message: string,
): Promise<void> {
  const baseUrl = agentConfig.baseUrl || 'https://api.openai.com/v1'
  const model = agentConfig.model || 'gpt-3.5-turbo'
  const apiKey = agentConfig.apiKey!

  const messages: any[] = []
  if (agentConfig.systemPrompt) {
    messages.push({ role: 'system', content: agentConfig.systemPrompt })
  }
  messages.push({ role: 'user', content: message })

  // Build tool definitions from skills
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

  const requestBody: any = { model, messages, stream: true }
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
  if (!body) throw new Error('No response body from LLM API')

  let fullResponse = ''
  const reader = body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines = chunk.split('\n').filter((line) => line.startsWith('data: '))

    for (const line of lines) {
      const data = line.substring(6).trim()
      if (data === '[DONE]') continue

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) {
          fullResponse += content
          io.to(roomKey).emit('agent:stream', {
            conversationId,
            agentId: agentConfig.agentId,
            chunk: content,
            timestamp: new Date().toISOString(),
          })
        }
      } catch {}
    }
  }

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
  })
}

/**
 * Handle custom_api mode agent.
 */
async function handleLegacyCustomApiAgent(
  io: Server,
  roomKey: string,
  conversationId: string,
  agentConfig: import('./types').AgentConfig,
  message: string,
): Promise<void> {
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
      fullResponse: 'Error: Callback URL not configured for this agent.',
      timestamp: new Date().toISOString(),
      error: true,
    })
    return
  }

  const response = await fetch(callbackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      agentId: agentConfig.agentId,
      agentName: agentConfig.name,
      message,
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
  })
}

/**
 * Handle hermes mode agent.
 */
async function handleLegacyHermesAgent(
  io: Server,
  roomKey: string,
  conversationId: string,
  agentConfig: import('./types').AgentConfig,
  message: string,
): Promise<void> {
  const hermesGatewayUrl = process.env.HERMES_GATEWAY_URL || 'http://localhost:3000/api/hermes'

  try {
    const response = await fetch(hermesGatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId,
        agentId: agentConfig.agentId,
        agentName: agentConfig.name,
        message,
        timestamp: new Date().toISOString(),
      }),
    })

    if (!response.ok) throw new Error(`Hermes gateway error (${response.status})`)

    const data = await response.json()
    const reply = data.response || data.message || data.content || 'No response from Hermes gateway'

    io.to(roomKey).emit('agent:stream', {
      conversationId,
      agentId: agentConfig.agentId,
      chunk: reply,
      timestamp: new Date().toISOString(),
    })
  } catch {
    const fallback = `[Hermes Agent: ${agentConfig.name}] I received your message but the Hermes gateway is currently unavailable.`
    io.to(roomKey).emit('agent:stream', {
      conversationId,
      agentId: agentConfig.agentId,
      chunk: fallback,
      timestamp: new Date().toISOString(),
    })
  }

  io.to(roomKey).emit('agent:typing', {
    conversationId,
    agentId: agentConfig.agentId,
    isTyping: false,
    timestamp: new Date().toISOString(),
  })

  io.to(roomKey).emit('agent:stream-complete', {
    conversationId,
    agentId: agentConfig.agentId,
    fullResponse: '',
    timestamp: new Date().toISOString(),
  })
}

/**
 * Handle ACRP mode agent — forward via skill-ws service.
 */
async function handleLegacyAcrpAgent(
  io: Server,
  roomKey: string,
  conversationId: string,
  agentConfig: import('./types').AgentConfig,
  message: string,
): Promise<void> {
  const SKILL_WS_URL = process.env.SKILL_WS_URL || 'http://localhost:3004'

  try {
    const statusRes = await fetch(
      `${SKILL_WS_URL}/internal/acrp-status?agentId=${agentConfig.agentId}`,
      { signal: AbortSignal.timeout(3000) },
    )

    if (!statusRes.ok) throw new Error('Skill service unavailable')

    const statusData = await statusRes.json()
    if (!statusData.connected) {
      io.to(roomKey).emit('agent:typing', {
        conversationId,
        agentId: agentConfig.agentId,
        isTyping: false,
        timestamp: new Date().toISOString(),
      })
      io.to(roomKey).emit('agent:stream-complete', {
        conversationId,
        agentId: agentConfig.agentId,
        fullResponse: `[${agentConfig.name}] I'm currently offline. Please try again later.`,
        timestamp: new Date().toISOString(),
        error: true,
      })
      return
    }

    const capabilityId = statusData.capabilities?.find(
      (cap: any) => cap.category === 'chat' || cap.id === 'chat.reply' || cap.id === 'message',
    )?.id || 'chat.reply'

    const invocationId = `chat_${Date.now()}_${Math.random().toString(36).slice(2)}`

    const invokeRes = await fetch(`${SKILL_WS_URL}/internal/acrp-invoke?wait=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: agentConfig.agentId,
        capabilityId,
        params: { message, conversationId, timestamp: new Date().toISOString() },
        invocationId,
        invokedBy: agentConfig.agentId,
      }),
      signal: AbortSignal.timeout(60000),
    })

    let reply = ''
    if (invokeRes.ok) {
      const data = await invokeRes.json()
      if (data.success && data.result) {
        reply = data.result.response || data.result.message || data.result.content ||
          data.result.result || data.result.text ||
          (typeof data.result === 'string' ? data.result : JSON.stringify(data.result))
      } else {
        reply = data.error || `[${agentConfig.name}] No response received.`
      }
    } else if (invokeRes.status === 404) {
      reply = `[${agentConfig.name}] I'm currently offline.`
    } else if (invokeRes.status === 504) {
      reply = `[${agentConfig.name}] Response timed out.`
    } else {
      reply = `[${agentConfig.name}] Failed to get response.`
    }

    io.to(roomKey).emit('agent:stream', {
      conversationId,
      agentId: agentConfig.agentId,
      chunk: reply,
      timestamp: new Date().toISOString(),
    })
  } catch (err: any) {
    io.to(roomKey).emit('agent:stream', {
      conversationId,
      agentId: agentConfig.agentId,
      chunk: `[${agentConfig.name}] Error: ${err.message || 'Service unavailable'}`,
      timestamp: new Date().toISOString(),
    })
  }

  io.to(roomKey).emit('agent:typing', {
    conversationId,
    agentId: agentConfig.agentId,
    isTyping: false,
    timestamp: new Date().toISOString(),
  })

  io.to(roomKey).emit('agent:stream-complete', {
    conversationId,
    agentId: agentConfig.agentId,
    fullResponse: '',
    timestamp: new Date().toISOString(),
  })
}

// ============================================================================
// Fallback Run Execution (when pi-agent-core Agent class is unavailable)
// ============================================================================

async function executeRunFallback(
  io: Server,
  runId: string,
  threadId: string,
  agentId: string,
  userId: string,
  message: string,
  providerConfig: LLMProviderConfig,
  systemPrompt: string,
  tools: AgentTool[],
  roomKey: string,
): Promise<{ runId: string; threadId: string; status: RunStatus }> {
  console.log(`[RUNTIME:${runId}] Using fallback execution (raw fetch)`)

  const piProvider = resolvePiProvider(providerConfig.provider)
  const modelId = providerConfig.defaultModel || 'gpt-4o-mini'

  // Set API key
  const envKey = `${piProvider.toUpperCase()}_API_KEY`
  const prevKey = process.env[envKey]
  if (providerConfig.apiKey) {
    process.env[envKey] = providerConfig.apiKey
  }

  // Set base URL if custom
  let prevBaseUrl: string | undefined
  if (providerConfig.baseUrl) {
    const baseEnvKey = providerConfig.provider === 'ollama' ? 'OLLAMA_API_BASE' : 'OPENAI_BASE_URL'
    prevBaseUrl = process.env[baseEnvKey]
    process.env[baseEnvKey] = providerConfig.baseUrl
  }

  // Track run
  const activeRun: ActiveRun = {
    runId,
    threadId,
    agentId,
    userId,
    agent: null as any, // No pi Agent in fallback
    status: 'in_progress',
    startedAt: new Date(),
    inputTokens: 0,
    outputTokens: 0,
    totalSteps: 0,
    cleanup: null,
    fullResponse: '',
  }
  activeRuns.set(runId, activeRun)
  threadRuns.set(threadId, runId)

  // Emit run:created
  io.to(roomKey).emit('run:created', {
    runId,
    threadId,
    timestamp: new Date().toISOString(),
  })

  // Execute in background
  ;(async () => {
    try {
      const baseUrl = providerConfig.baseUrl || (piProvider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.openai.com/v1')
      const apiKey = providerConfig.apiKey || ''

      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ]

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ model: modelId, messages, stream: true }),
      })

      if (!response.ok) {
        throw new Error(`LLM API error (${response.status})`)
      }

      const body = response.body
      if (!body) throw new Error('No response body')

      const reader = body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter((line) => line.startsWith('data: '))

        for (const line of lines) {
          const data = line.substring(6).trim()
          if (data === '[DONE]') continue

          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              activeRun.fullResponse += content
              io.to(roomKey).emit('run:stream', {
                runId,
                threadId,
                delta: content,
                timestamp: new Date().toISOString(),
              })
            }
          } catch {}
        }
      }

      // Complete
      activeRun.status = 'completed'
      io.to(roomKey).emit('run:complete', {
        runId,
        threadId,
        status: 'completed',
        inputTokens: activeRun.inputTokens,
        outputTokens: activeRun.outputTokens,
        timestamp: new Date().toISOString(),
      })
    } catch (err: any) {
      activeRun.status = 'failed'
      io.to(roomKey).emit('run:error', {
        runId,
        threadId,
        error: err.message,
        timestamp: new Date().toISOString(),
      })
    } finally {
      // Restore env
      if (prevKey === undefined) delete process.env[envKey]
      else process.env[envKey] = prevKey

      if (prevBaseUrl !== undefined) {
        const baseEnvKey = providerConfig.provider === 'ollama' ? 'OLLAMA_API_BASE' : 'OPENAI_BASE_URL'
        if (prevBaseUrl === undefined) delete process.env[baseEnvKey]
        else process.env[baseEnvKey] = prevBaseUrl
      }

      activeRuns.delete(runId)
      threadRuns.delete(threadId)
    }
  })()

  return { runId, threadId, status: 'in_progress' }
}

// ============================================================================
// Persistence
// ============================================================================

const NEXTJS_API_URL = process.env.NEXTJS_API_URL || 'http://localhost:3000'

/**
 * Persist run result to the Next.js API.
 */
async function persistRunResult(
  runId: string,
  status: string,
  inputTokens: number,
  outputTokens: number,
  totalSteps: number,
  lastError?: string,
): Promise<void> {
  try {
    await fetch(`${NEXTJS_API_URL}/api/runs/${runId}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        inputTokens,
        outputTokens,
        totalSteps,
        lastError,
        completedAt: new Date().toISOString(),
      }),
    })
  } catch (err: any) {
    console.warn(`[RUNTIME] Failed to persist run result: ${err.message}`)
  }
}
