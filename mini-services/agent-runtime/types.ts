/**
 * Hermes Agent Runtime v3 — Shared Types
 *
 * Backward-compatible with existing Socket.IO events from chat-service,
 * plus new types for Pi integration (pi-ai + pi-agent-core).
 */

// ============================================================================
// Legacy Chat Service Types (backward compatibility)
// ============================================================================

export interface ConnectedUser {
  socketId: string
  userId: string
  username: string
  status: 'online' | 'offline' | 'busy'
  connectedAt: Date
  rooms: Set<string>
}

export interface ChatMessage {
  id: string
  conversationId: string
  senderId: string
  senderName: string
  content: string
  timestamp: string
  type: 'text' | 'system' | 'agent'
}

export interface AgentSkillConfig {
  skillId: string
  skillName: string
  skillDisplayName: string
  handlerType: string // builtin, webhook, function
  callbackUrl?: string
  handlerUrl?: string
  callbackSecret?: string
  endpointToken?: string
  isEnabled: boolean
  priority: number
  parameters?: string // JSON
}

export interface AgentConfig {
  agentId: string
  name: string
  mode: 'builtin' | 'custom_api' | 'hermes' | 'acrp'
  provider?: string
  model?: string
  apiKey?: string
  baseUrl?: string
  callbackUrl?: string
  systemPrompt?: string
  skills?: AgentSkillConfig[]
}

export interface AgentMessagePayload {
  conversationId: string
  agentConfig: AgentConfig
  message: string
  userId: string
}

export interface StreamChunk {
  conversationId: string
  agentId: string
  chunk: string
  timestamp: string
}

export interface StreamCompletePayload {
  conversationId: string
  agentId: string
  fullResponse: string
  timestamp: string
}

// ============================================================================
// Thread / Run / Step Types (new runtime)
// ============================================================================

export type RunStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'requires_action'
  | 'cancelled'

export type StepType = 'message_creation' | 'tool_calls' | 'tool_execution'
export type StepStatus = 'in_progress' | 'completed' | 'failed'

export interface ThreadInfo {
  id: string
  agentId: string
  userId: string
  title?: string
  systemPrompt?: string
  status: string
  contextWindow: number
  metadata: string
}

export interface RunInfo {
  id: string
  threadId: string
  status: RunStatus
  inputTokens: number
  outputTokens: number
  totalSteps: number
  requiredAction?: string
  lastError?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

export interface StepInfo {
  id: string
  runId: string
  type: StepType
  status: StepStatus
  detail: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

// ============================================================================
// Pi Integration Types
// ============================================================================

/** Maps to our LLMProvider Prisma model */
export interface LLMProviderConfig {
  id: string
  userId: string
  name: string
  provider: string // openai, anthropic, google, ollama, custom, z-ai
  apiKey?: string
  baseUrl?: string
  models: string // JSON array of model IDs
  defaultModel?: string
  isActive: boolean
  config: string // JSON: { temperature, max_tokens, etc. }
}

/** Maps to our Tool Prisma model */
export interface ToolConfig {
  id: string
  userId?: string
  name: string
  displayName: string
  description: string
  category: string
  parameters: string // JSON Schema string
  handlerType: string // builtin, http, websocket, code
  handlerConfig: string // JSON: { url, method, headers, auth } etc
  icon?: string
  isPublic: boolean
}

/** Maps to our AgentTool Prisma model */
export interface AgentToolConfig {
  id: string
  agentId: string
  toolId: string
  isEnabled: boolean
  config: string // Tool-level config override
  priority: number
  tool?: ToolConfig
}

/** Provider name mapping: our DB provider → pi-ai provider key */
export const PROVIDER_NAME_MAP: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  'google-gemini': 'google',
  deepseek: 'deepseek',
  ollama: 'ollama',
  openrouter: 'openrouter',
  groq: 'groq',
  mistral: 'mistral',
  xai: 'xai',
  together: 'together',
  fireworks: 'fireworks',
  'z-ai': 'zai',
  zai: 'zai',
  custom: 'openai', // Custom endpoints use OpenAI-compatible API
}

/** Environment variable names for API keys per pi-ai provider */
export const PROVIDER_ENV_KEY_MAP: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  ollama: 'OLLAMA_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  groq: 'GROQ_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  xai: 'XAI_API_KEY',
  together: 'TOGETHER_AI_API_KEY',
  fireworks: 'FIREWORKS_API_KEY',
  zai: 'ZAI_API_KEY',
}

// ============================================================================
// Socket.IO Event Types
// ============================================================================

/** Events emitted by the server to clients */
export interface ServerToClientEvents {
  // Legacy chat events (backward compatible)
  'connected': (data: { userId: string; username: string; socketId: string; onlineUsers: any[] }) => void
  'chat:join': (data: any) => void
  'chat:leave': (data: any) => void
  'chat:message': (data: ChatMessage) => void
  'chat:typing': (data: { conversationId: string; typingUsers: string[] }) => void
  'chat:members': (data: { conversationId: string; members: string[] }) => void
  'agent:typing': (data: { conversationId: string; agentId: string; agentName?: string; isTyping: boolean; timestamp: string }) => void
  'agent:stream': (data: StreamChunk) => void
  'agent:stream-complete': (data: StreamCompletePayload & { error?: boolean }) => void
  'presence:online': (data: any) => void
  'presence:offline': (data: any) => void
  'presence:update': (data: any) => void

  // New Thread/Run events
  'thread:joined': (data: { threadId: string }) => void
  'thread:left': (data: { threadId: string }) => void
  'run:created': (data: { runId: string; threadId: string; timestamp: string }) => void
  'run:stream': (data: { runId: string; threadId: string; delta: string; timestamp: string }) => void
  'run:step-update': (data: { runId: string; threadId: string; step: StepInfo; timestamp: string }) => void
  'run:complete': (data: { runId: string; threadId: string; status: RunStatus; inputTokens: number; outputTokens: number; timestamp: string }) => void
  'run:error': (data: { runId: string; threadId: string; error: string; timestamp: string }) => void

  // Provider discovery
  'provider:list': (data: { providers: string[] }) => void
  'provider:models': (data: { provider: string; models: any[] }) => void
}

/** Events received by the server from clients */
export interface ClientToServerEvents {
  // Legacy chat events
  'chat:join': (data: { conversationId: string }) => void
  'chat:leave': (data: { conversationId: string }) => void
  'chat:message': (data: { conversationId: string; content: string; type?: 'text' | 'system' }) => void
  'chat:typing': (data: { conversationId: string; isTyping: boolean }) => void
  'agent:message': (data: AgentMessagePayload) => void
  'presence:update': (data: { status: 'online' | 'offline' | 'busy' }) => void

  // New Thread/Run events
  'thread:join': (data: { threadId: string }) => void
  'thread:leave': (data: { threadId: string }) => void
  'thread:message': (data: { threadId: string; content: string; runId?: string }) => void
  'run:cancel': (data: { runId: string; threadId: string }) => void
  'run:steer': (data: { runId: string; threadId: string; content: string }) => void
  'run:follow-up': (data: { runId: string; threadId: string; content: string }) => void
  'provider:list': () => void
  'provider:models': (data: { provider: string }) => void
}

// ============================================================================
// Runtime Execution Types
// ============================================================================

export interface ExecuteRunRequest {
  threadId: string
  agentId: string
  userId: string
  message: string
  providerConfig: LLMProviderConfig
  tools: AgentToolConfig[]
  systemPrompt?: string
  modelOverride?: string
  config?: {
    temperature?: number
    maxTokens?: number
    thinkingLevel?: 'off' | 'low' | 'medium' | 'high'
    toolExecution?: 'parallel' | 'sequential'
  }
}

export interface ExecuteRunResponse {
  runId: string
  threadId: string
  status: RunStatus
}

export interface RunStatusResponse {
  runId: string
  threadId: string
  status: RunStatus
  inputTokens: number
  outputTokens: number
  totalSteps: number
  error?: string
}

// ============================================================================
// Internal HTTP API Types
// ============================================================================

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error'
  version: string
  uptime: number
  activeRuns: number
  piAvailable: boolean
  piAiAvailable: boolean
  piAgentCoreAvailable: boolean
}

export interface ProviderInfo {
  id: string
  name: string
  envKey: string
  configured: boolean
}
