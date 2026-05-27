// ============================================================
// Hermes Agent Runtime 2.0 — Core Execution Engine
// ============================================================
// Manages the Thread → Run → Step lifecycle.
// Routes execution to the appropriate executor based on agent.runtime.

import type {
  AgentConfig,
  ExecutionContext,
  LLMMessage,
  ThreadMessage,
} from './types'
import type { Server } from 'socket.io'
import { executeBuiltin } from './executors/builtin'
import { executeRemote } from './executors/remote'

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
// API helpers to Next.js data layer
// ---------------------------------------------------------------------------

async function updateRunStatus(runId: string, updates: Record<string, any>): Promise<void> {
  await fetch(`${NEXTJS_API_URL}/api/runs/${runId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })
}

async function fetchAgentConfig(agentId: string): Promise<AgentConfig> {
  const res = await fetch(`${NEXTJS_API_URL}/api/agents/${agentId}/runtime-config`)
  if (!res.ok) throw new Error(`Failed to fetch agent config: ${res.status}`)
  const data = await res.json()
  return data.agentConfig
}

async function fetchThreadMessages(threadId: string): Promise<ThreadMessage[]> {
  const res = await fetch(`${NEXTJS_API_URL}/api/threads/${threadId}/messages`)
  if (!res.ok) throw new Error(`Failed to fetch thread messages: ${res.status}`)
  const data = await res.json()
  return data.messages || []
}

// ---------------------------------------------------------------------------
// Convert thread messages to LLM conversation format
// ---------------------------------------------------------------------------

function threadToLLMMessages(messages: ThreadMessage[], maxMessages: number = 50): LLMMessage[] {
  // Take the most recent messages, limited by maxMessages
  const recent = messages.slice(-maxMessages)

  return recent.map(msg => {
    const role = msg.senderType === 'user' ? 'user' as const :
                 msg.senderType === 'agent' ? 'assistant' as const :
                 'system' as const
    return { role, content: msg.content }
  })
}

// ---------------------------------------------------------------------------
// Main runtime class
// ---------------------------------------------------------------------------

export class AgentRuntime {
  private io: Server
  private _activeRuns: Map<string, ActiveRun> = activeRuns

  constructor(io: Server) {
    this.io = io
  }

  /**
   * Set the shared activeRuns map (used by index.ts for health endpoint)
   */
  setActiveRunsMap(map: Map<string, any>): void {
    this._activeRuns = map as Map<string, ActiveRun>
  }

  /**
   * Main entry point — execute a run
   */
  async executeRun(
    runId: string,
    threadId: string,
    agentId: string,
    userId: string,
    userMessage: string,
  ): Promise<void> {
    const roomKey = `thread:${threadId}`

    // Register the active run
    const abortController = new AbortController()
    const run: ActiveRun = {
      runId,
      threadId,
      agentId,
      userId,
      status: 'in_progress',
      startedAt: new Date(),
      abortController,
    }
    activeRuns.set(runId, run)

    try {
      // Update run status to in_progress
      await updateRunStatus(runId, {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      })

      // Emit run:created
      this.io.to(roomKey).emit('run:created', { runId, threadId })

      // Load agent config
      const agentConfig = await this.loadAgentConfig(agentId)

      // Load thread context
      const threadMessages = await this.loadThreadContext(threadId)
      const llmMessages = threadToLLMMessages(threadMessages)

      // Build execution context
      const context: ExecutionContext = {
        threadId,
        runId,
        agentId,
        userId,
        conversationId: roomKey,
      }

      // Route to appropriate executor
      const result = await this.routeToExecutor(agentConfig.runtime, agentConfig, context, llmMessages, userMessage)

      // Update run as completed
      await updateRunStatus(runId, {
        status: 'completed',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        completedAt: new Date().toISOString(),
      })

      run.status = 'completed'

      // Emit completion
      this.io.to(roomKey).emit('run:complete', {
        runId,
        threadId,
        status: 'completed',
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      })

      console.log(`[RUNTIME] Run ${runId} completed successfully (${result.inputTokens}+${result.outputTokens} tokens)`)
    } catch (err: any) {
      console.error(`[RUNTIME] Run ${runId} failed:`, err.message)

      // Update run as failed
      try {
        await updateRunStatus(runId, {
          status: 'failed',
          lastError: err.message,
          completedAt: new Date().toISOString(),
        })
      } catch (updateErr) {
        console.error(`[RUNTIME] Failed to update run ${runId} status:`, updateErr)
      }

      run.status = 'failed'

      // Emit error
      this.io.to(roomKey).emit('run:error', {
        runId,
        threadId,
        error: err.message || 'Internal server error',
      })
    } finally {
      activeRuns.delete(runId)
    }
  }

  /**
   * Cancel a running execution
   */
  cancelRun(runId: string): boolean {
    const run = activeRuns.get(runId)
    if (!run) return false
    if (run.status !== 'in_progress') return false

    run.abortController?.abort()
    run.status = 'cancelled'

    updateRunStatus(runId, {
      status: 'cancelled',
      completedAt: new Date().toISOString(),
    }).catch(err => console.error(`[RUNTIME] Failed to cancel run ${runId}:`, err))

    return true
  }

  /**
   * Get the status of an active run
   */
  getRunStatus(runId: string): ActiveRun | undefined {
    return activeRuns.get(runId)
  }

  /**
   * Load agent config from the Next.js API
   */
  private async loadAgentConfig(agentId: string): Promise<AgentConfig> {
    return fetchAgentConfig(agentId)
  }

  /**
   * Load thread context (recent messages)
   */
  private async loadThreadContext(threadId: string): Promise<ThreadMessage[]> {
    return fetchThreadMessages(threadId)
  }

  /**
   * Route to appropriate executor based on agent.runtime
   */
  private async routeToExecutor(
    runtime: string,
    config: AgentConfig,
    context: ExecutionContext,
    threadMessages: LLMMessage[],
    userMessage: string,
  ): Promise<{ inputTokens: number; outputTokens: number }> {
    switch (runtime) {
      case 'builtin':
        return executeBuiltin(this.io, config, context, threadMessages, userMessage)

      case 'remote':
        return executeRemote(this.io, config, context, userMessage)

      case 'workflow':
        // Workflow runtime — future implementation
        // For now, treat as builtin
        console.warn(`[RUNTIME] Workflow runtime not yet implemented, falling back to builtin for agent ${context.agentId}`)
        return executeBuiltin(this.io, config, context, threadMessages, userMessage)

      default:
        // Default to builtin
        console.warn(`[RUNTIME] Unknown runtime "${runtime}", defaulting to builtin for agent ${context.agentId}`)
        return executeBuiltin(this.io, config, context, threadMessages, userMessage)
    }
  }
}
