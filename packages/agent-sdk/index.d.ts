/**
 * @hermes-hub/agent-sdk — TypeScript Type Definitions
 *
 * These types describe the public API of the Hermes Hub Agent SDK.
 */

declare module '@hermes-hub/agent-sdk' {

  // =========================================================================
  // Types
  // =========================================================================

  /** Capability categories in the ACRP protocol */
  export type CapabilityCategory =
    | 'model'
    | 'skill'
    | 'soul'
    | 'memory'
    | 'gateway'
    | 'chat'
    | 'system'
    | 'general'

  /** JSON Schema parameter definition */
  export interface ParameterDef {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    description?: string
    default?: any
    items?: ParameterDef
    properties?: Record<string, ParameterDef>
    required?: string[]
    enum?: any[]
  }

  /** Capability parameters schema */
  export interface CapabilityParameters {
    type: 'object'
    properties: Record<string, ParameterDef>
    required?: string[]
  }

  /** UI hints for displaying a capability */
  export interface UIHints {
    confirmRequired?: boolean
    timeout?: number
    icon?: string
    color?: string
    order?: number
    group?: string
  }

  /** A capability that an agent can register and handle */
  export interface Capability {
    capabilityId: string
    name: string
    description: string
    category: CapabilityCategory
    icon?: string
    parameters: CapabilityParameters
    handler: (params: Record<string, any>) => Promise<any>
    uiHints?: UIHints
    version?: string
  }

  /** Auto-reconnect configuration */
  export interface ReconnectConfig {
    enabled?: boolean
    initialDelay?: number
    maxDelay?: number
    maxRetries?: number
  }

  /** HermesAgent constructor configuration */
  export interface HermesAgentConfig {
    token: string
    name?: string
    version?: string
    platform?: string
    capabilities?: Capability[]
    wsUrl?: string
    heartbeatInterval?: number
    invocationTimeout?: number
    reconnect?: ReconnectConfig
    autoRegister?: boolean
    autoHandleInvocations?: boolean
    metadata?: Record<string, any>
  }

  /** Event data for 'connected' event */
  export interface ConnectedEvent {
    agentId: string | null
    agentName: string | null
    message?: string
  }

  /** Event data for 'disconnected' event */
  export interface DisconnectedEvent {
    reason: string
  }

  /** Event data for 'invocation' event */
  export interface InvocationEvent {
    invocationId: string
    capabilityId: string
    parameters: Record<string, any>
    invokedBy?: string
    requestedAt?: string
    handle: () => Promise<any>
  }

  /** Event data for 'command' event */
  export interface CommandEvent {
    command: string
    params: Record<string, any>
    commandId?: string
  }

  /** Event data for 'error' event */
  export interface ErrorEvent {
    message: string
    code?: string
  }

  /** Event data for 'heartbeat' event */
  export interface HeartbeatEvent {
    timestamp: string
    nextInterval?: number
  }

  /** Event data for 'reconnecting' event */
  export interface ReconnectingEvent {
    attempt: number
    delay: number
  }

  /** Event data for 'chat:message' event */
  export interface ChatMessageEvent {
    conversationId: string
    content: string
    senderId: string
    senderName: string
  }

  /** Agent status information */
  export interface AgentStatus {
    connected: boolean
    agentId: string | null
    agentName: string | null
    capabilities: string[]
    uptime: number
    lastHeartbeat: string | null
    reconnectAttempt: number
  }

  // =========================================================================
  // Event names enum
  // =========================================================================

  export const Events: {
    CONNECTED: 'connected'
    DISCONNECTED: 'disconnected'
    INVOCATION: 'invocation'
    COMMAND: 'command'
    ERROR: 'error'
    HEARTBEAT: 'heartbeat'
    RECONNECTING: 'reconnecting'
    CHAT_MESSAGE: 'chat:message'
  }

  // =========================================================================
  // HermesAgent class
  // =========================================================================

  export class HermesAgent {
    constructor(config: HermesAgentConfig)

    /** Start the agent — connect, register, start heartbeat */
    start(): Promise<void>

    /** Stop the agent — disconnect gracefully */
    stop(): Promise<void>

    /** Send a capability result back to Hermes Hub */
    sendResult(invocationId: string, result: any, success?: boolean): void

    /** Add a capability (re-registers if connected) */
    addCapability(capability: Capability): void

    /** Remove a capability by ID (re-registers if connected) */
    removeCapability(capabilityId: string): boolean

    /** Get current agent status */
    getStatus(): AgentStatus

    /** Send a status update */
    sendStatus(status: string, metrics?: Record<string, any>): void

    /** Send a custom event */
    sendEvent(type: string, data: any): void

    /** Send a chat message to a conversation */
    sendChatMessage(conversationId: string, content: string, senderName?: string): void

    /** Acknowledge a command */
    acknowledgeCommand(
      commandId: string,
      status: 'received' | 'executing' | 'completed' | 'failed',
      result?: any,
      error?: string
    ): void

    /** Get a capability by ID */
    getCapability(capabilityId: string): Capability | undefined

    /** Get all registered capabilities */
    getCapabilities(): Capability[]

    // Event emitter methods (from eventemitter3)
    on(event: 'connected', handler: (data: ConnectedEvent) => void): this
    on(event: 'disconnected', handler: (data: DisconnectedEvent) => void): this
    on(event: 'invocation', handler: (data: InvocationEvent) => void): this
    on(event: 'command', handler: (data: CommandEvent) => void): this
    on(event: 'error', handler: (data: ErrorEvent) => void): this
    on(event: 'heartbeat', handler: (data: HeartbeatEvent) => void): this
    on(event: 'reconnecting', handler: (data: ReconnectingEvent) => void): this
    on(event: 'chat:message', handler: (data: ChatMessageEvent) => void): this
    on(event: string, handler: (...args: any[]) => void): this

    once(event: 'connected', handler: (data: ConnectedEvent) => void): this
    once(event: 'disconnected', handler: (data: DisconnectedEvent) => void): this
    once(event: 'invocation', handler: (data: InvocationEvent) => void): this
    once(event: 'command', handler: (data: CommandEvent) => void): this
    once(event: 'error', handler: (data: ErrorEvent) => void): this
    once(event: 'heartbeat', handler: (data: HeartbeatEvent) => void): this
    once(event: 'reconnecting', handler: (data: ReconnectingEvent) => void): this
    once(event: 'chat:message', handler: (data: ChatMessageEvent) => void): this
    once(event: string, handler: (...args: any[]) => void): this

    off(event: string, handler?: (...args: any[]) => void): this
    emit(event: string, ...args: any[]): boolean
    removeAllListeners(event?: string): this
  }

  // Default export
  const HermesAgentDefault: typeof HermesAgent
  export default HermesAgentDefault
}

declare module '@hermes-hub/agent-sdk/types' {
  export * from '@hermes-hub/agent-sdk'
}
