// ============================================================
// Hermes Agent Runtime 2.0 — Builtin Executor
// ============================================================
// Handles agents with runtime === "builtin"
// Implements the LLM API call + function calling loop with
// full Run/Step lifecycle tracking.

import type {
  AgentConfig,
  AgentToolConfig,
  ExecutionContext,
  LLMConfig,
  LLMMessage,
  LLMStreamChunk,
  LLMToolCall,
  RunStepUpdateEvent,
  ToolResult,
} from '../types'
import type { Server } from 'socket.io'
import { toolRegistry } from '../tools/registry'

const NEXTJS_API_URL = process.env.NEXTJS_API_URL || 'http://localhost:3000'
const MAX_TOOL_ITERATIONS = 5

// ---------------------------------------------------------------------------
// API helpers to Next.js data layer
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
// Build OpenAI-compatible tool definitions from agent tool configs
// ---------------------------------------------------------------------------

function buildOpenAITools(tools: AgentToolConfig[]): any[] {
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }))
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

export async function executeBuiltin(
  io: Server,
  config: AgentConfig,
  context: ExecutionContext,
  threadMessages: LLMMessage[],
  userMessage: string,
): Promise<{ inputTokens: number; outputTokens: number }> {
  const llm = config.llmConfig
  if (!llm || !llm.apiKey) {
    throw new Error('LLM configuration or API key not available for builtin runtime')
  }

  const roomKey = context.conversationId || `thread:${context.threadId}`
  let totalInputTokens = 0
  let totalOutputTokens = 0

  // Build the message list
  const messages: LLMMessage[] = []

  // System prompt
  if (llm.systemPrompt || config.systemPrompt) {
    messages.push({ role: 'system', content: llm.systemPrompt || config.systemPrompt })
  }

  // Thread context (recent messages)
  messages.push(...threadMessages)

  // Current user message
  messages.push({ role: 'user', content: userMessage })

  // Save user message to thread
  await saveMessage(context.threadId, userMessage, 'user', 'User')

  // Build tool definitions
  const openaiTools = config.tools.length > 0 ? buildOpenAITools(config.tools) : []

  // Function calling loop
  for (let iteration = 0; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
    // Step 1: Create message_creation step
    const msgStep = await createStep(context.runId, 'message_creation', { iteration })

    // Emit step update
    io.to(roomKey).emit('run:step-update', {
      runId: context.runId,
      threadId: context.threadId,
      step: { id: msgStep.id, type: 'message_creation', status: 'in_progress', detail: { iteration } },
    } as RunStepUpdateEvent)

    // Step 2: Call LLM API
    let fullResponse = ''
    let toolCalls: LLMToolCall[] = []
    let hasToolCalls = false
    let chunkInputTokens = 0
    let chunkOutputTokens = 0

    try {
      const requestBody: any = {
        model: llm.model,
        messages,
        stream: true,
        temperature: llm.temperature ?? 0.7,
        max_tokens: llm.maxTokens ?? 2048,
      }
      if (openaiTools.length > 0) {
        requestBody.tools = openaiTools
        requestBody.tool_choice = 'auto'
      }

      const response = await fetch(`${llm.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${llm.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(120000), // 2 minute timeout
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`LLM API error (${response.status}): ${errorText}`)
      }

      const body = response.body
      if (!body) throw new Error('No response body from LLM API')

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
            const parsed: LLMStreamChunk = JSON.parse(data)
            const delta = parsed.choices?.[0]?.delta

            // Track usage
            if (parsed.usage) {
              chunkInputTokens = parsed.usage.prompt_tokens || 0
              chunkOutputTokens = parsed.usage.completion_tokens || 0
            }

            // Handle tool calls
            if (delta?.tool_calls) {
              hasToolCalls = true
              for (const tc of delta.tool_calls) {
                if (!toolCalls[tc.index]) {
                  toolCalls[tc.index] = { id: tc.id || '', type: 'function', function: { name: '', arguments: '' } }
                }
                if (tc.id) toolCalls[tc.index].id = tc.id
                if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name
                if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments
              }
            }

            // Handle regular content
            const content = delta?.content
            if (content) {
              fullResponse += content
              io.to(roomKey).emit('run:stream', {
                runId: context.runId,
                threadId: context.threadId,
                chunk: content,
                timestamp: new Date().toISOString(),
              })
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } catch (err: any) {
      // Complete the step as failed
      await updateStep(context.runId, msgStep.id, 'failed', { error: err.message })
      io.to(roomKey).emit('run:step-update', {
        runId: context.runId,
        threadId: context.threadId,
        step: { id: msgStep.id, type: 'message_creation', status: 'failed', detail: { error: err.message } },
      } as RunStepUpdateEvent)
      throw err
    }

    totalInputTokens += chunkInputTokens
    totalOutputTokens += chunkOutputTokens

    // If no tool calls, complete the message_creation step and we're done
    if (!hasToolCalls || toolCalls.length === 0) {
      toolCalls = toolCalls.filter(Boolean)
      await updateStep(context.runId, msgStep.id, 'completed', { message: fullResponse.substring(0, 500) })
      io.to(roomKey).emit('run:step-update', {
        runId: context.runId,
        threadId: context.threadId,
        step: { id: msgStep.id, type: 'message_creation', status: 'completed', detail: {} },
      } as RunStepUpdateEvent)

      // Save the assistant message to thread
      await saveMessage(context.threadId, fullResponse, 'agent', config.name)

      // Add assistant message to conversation for potential future iterations
      messages.push({ role: 'assistant', content: fullResponse })
      break
    }

    // We have tool calls — complete the message_creation step
    toolCalls = toolCalls.filter(Boolean)
    await updateStep(context.runId, msgStep.id, 'completed', { message: fullResponse.substring(0, 500) })
    io.to(roomKey).emit('run:step-update', {
      runId: context.runId,
      threadId: context.threadId,
      step: { id: msgStep.id, type: 'message_creation', status: 'completed', detail: {} },
    } as RunStepUpdateEvent)

    // Add the assistant message with tool calls to conversation
    messages.push({
      role: 'assistant',
      content: fullResponse || null,
      tool_calls: toolCalls,
    })

    // Step 3: Create tool_calls step
    const toolCallsStep = await createStep(context.runId, 'tool_calls', {
      calls: toolCalls.map(tc => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      })),
    })
    await updateStep(context.runId, toolCallsStep.id, 'completed', {
      callCount: toolCalls.length,
    })
    io.to(roomKey).emit('run:step-update', {
      runId: context.runId,
      threadId: context.threadId,
      step: { id: toolCallsStep.id, type: 'tool_calls', status: 'completed', detail: { callCount: toolCalls.length } },
    } as RunStepUpdateEvent)

    // Step 4: Execute each tool call
    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name
      let toolParams: Record<string, any>
      try {
        toolParams = JSON.parse(toolCall.function.arguments || '{}')
      } catch {
        toolParams = {}
      }

      // Create tool_execution step
      const execStep = await createStep(context.runId, 'tool_execution', {
        callId: toolCall.id,
        name: toolName,
        arguments: toolParams,
      })
      io.to(roomKey).emit('run:step-update', {
        runId: context.runId,
        threadId: context.threadId,
        step: { id: execStep.id, type: 'tool_execution', status: 'in_progress', detail: { name: toolName } },
      } as RunStepUpdateEvent)

      // Execute the tool
      const toolConfig = config.tools.find(t => t.name === toolName)
      let toolResult: ToolResult

      if (toolConfig) {
        toolResult = await toolRegistry.execute(toolConfig, toolParams, context)
      } else {
        toolResult = { success: false, error: `Tool "${toolName}" not found in agent configuration` }
      }

      // Update step with result
      const stepDetail: Record<string, any> = {
        callId: toolCall.id,
        name: toolName,
        success: toolResult.success,
        result: toolResult.data,
        error: toolResult.error,
        duration_ms: toolResult.duration_ms,
      }

      await updateStep(context.runId, execStep.id, toolResult.success ? 'completed' : 'failed', stepDetail)
      io.to(roomKey).emit('run:step-update', {
        runId: context.runId,
        threadId: context.threadId,
        step: {
          id: execStep.id,
          type: 'tool_execution',
          status: toolResult.success ? 'completed' : 'failed',
          detail: stepDetail,
        },
      } as RunStepUpdateEvent)

      // Stream tool result indicator to the user
      const resultPreview = toolResult.success
        ? (typeof toolResult.data === 'string' ? toolResult.data.substring(0, 200) : JSON.stringify(toolResult.data).substring(0, 200))
        : toolResult.error

      io.to(roomKey).emit('run:stream', {
        runId: context.runId,
        threadId: context.threadId,
        chunk: `\n🔧 **${toolName}**: ${resultPreview}\n`,
        timestamp: new Date().toISOString(),
      })

      // Add tool result to messages for the next LLM call
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: toolResult.success
          ? (typeof toolResult.data === 'string' ? toolResult.data : JSON.stringify(toolResult.data))
          : `Error: ${toolResult.error}`,
      })
    }

    // Loop will continue — next iteration will call LLM again with tool results appended
    if (iteration >= MAX_TOOL_ITERATIONS) {
      console.warn(`[BUILTIN] Max tool iterations (${MAX_TOOL_ITERATIONS}) reached for run ${context.runId}`)
      break
    }
  }

  return { inputTokens: totalInputTokens, outputTokens: totalOutputTokens }
}
