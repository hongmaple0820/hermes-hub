// ============================================================
// Hermes Agent Runtime 2.0 — Shared Types
// ============================================================

export interface ExecutionContext {
  threadId: string
  runId: string
  agentId: string
  userId: string
  conversationId?: string  // For Socket.IO room key
}

export interface ToolResult {
  success: boolean
  data?: any
  error?: string
  duration_ms?: number
}

export interface LLMConfig {
  provider: string
  model: string
  apiKey: string
  baseUrl: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: object  // JSON Schema
}

export interface StepRecord {
  type: 'message_creation' | 'tool_calls' | 'tool_execution'
  status: 'in_progress' | 'completed' | 'failed'
  detail: Record<string, any>
  startedAt?: Date
  completedAt?: Date
}

export interface AgentConfig {
  id: string
  name: string
  mode: string       // builtin, acrp
  runtime: string    // builtin, remote, workflow
  llmConfig: LLMConfig | null
  tools: AgentToolConfig[]
  endpointConfig: EndpointConfig
  systemPrompt?: string
}

export interface AgentToolConfig {
  id: string
  name: string
  displayName: string
  description: string
  parameters: object
  handlerType: string    // builtin, http, websocket
  handlerConfig: Record<string, any>
  category: string
}

export interface EndpointConfig {
  endpointUrl?: string
  endpointType: 'http' | 'websocket'
  authToken?: string
  agentToken?: string
}

export interface ThreadMessage {
  id: string
  content: string
  type: string
  senderId?: string
  senderType: string
  senderName?: string
  metadata?: string
  createdAt: string
}

// LLM API types
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_call_id?: string
  tool_calls?: LLMToolCall[]
}

export interface LLMToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface LLMStreamDelta {
  role?: string
  content?: string | null
  tool_calls?: Array<{
    index: number
    id?: string
    type?: string
    function?: {
      name?: string
      arguments?: string
    }
  }>
}

export interface LLMStreamChoice {
  index: number
  delta: LLMStreamDelta
  finish_reason: string | null
}

export interface LLMStreamChunk {
  id: string
  object: string
  choices: LLMStreamChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Socket.IO event types
export interface RunStreamEvent {
  runId: string
  threadId: string
  chunk: string
  timestamp: string
}

export interface RunStepUpdateEvent {
  runId: string
  threadId: string
  step: {
    id: string
    type: string
    status: string
    detail: Record<string, any>
    startedAt?: string
    completedAt?: string
  }
}

export interface RunCompleteEvent {
  runId: string
  threadId: string
  status: 'completed' | 'failed' | 'cancelled'
  inputTokens: number
  outputTokens: number
}

export interface RunErrorEvent {
  runId: string
  threadId: string
  error: string
}

// Builtin tool implementation
export interface BuiltinToolImplementation {
  name: string
  description: string
  parameters: object  // JSON Schema
  execute(params: Record<string, any>, context: ExecutionContext): Promise<ToolResult>
}
