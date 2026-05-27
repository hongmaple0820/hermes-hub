/**
 * @hermes-hub/agent-sdk — Type definitions
 *
 * These JSDoc type annotations provide IDE autocompletion and documentation
 * for the SDK's configuration objects, events, and capabilities.
 */

'use strict'

/**
 * @typedef {'model' | 'skill' | 'soul' | 'memory' | 'gateway' | 'chat' | 'system' | 'general'} CapabilityCategory
 *
 * Capability categories in the ACRP protocol:
 * - `model`   — LLM model switching, configuration
 * - `skill`   — Skill execution and management
 * - `soul`    — Personality and behavior management
 * - `memory`  — Memory and context management
 * - `gateway` — External service integration
 * - `chat`    — Chat and conversation handling
 * - `system`  — System-level operations
 * - `general` — General-purpose capabilities
 */

/**
 * @typedef {object} ParameterDef
 * @property {string} type - JSON Schema type ('string', 'number', 'boolean', 'object', 'array')
 * @property {string} [description] - Human-readable description of the parameter
 * @property {*} [default] - Default value for the parameter
 * @property {ParameterDef} [items] - For array type, the schema for array items
 * @property {Record<string, ParameterDef>} [properties] - For object type, the schema for properties
 * @property {string[]} [required] - For object type, required property names
 * @property {*[]} [enum] - Enum values for the parameter
 */

/**
 * @typedef {object} CapabilityParameters
 * @property {'object'} type - Must be 'object'
 * @property {Record<string, ParameterDef>} properties - Parameter definitions
 * @property {string[]} [required] - Required parameter names
 */

/**
 * @typedef {object} UIHints
 * @property {boolean} [confirmRequired=false] - Whether user confirmation is required before invocation
 * @property {number} [timeout=30000] - Timeout in milliseconds for the capability handler
 * @property {string} [icon] - Icon identifier for the capability
 * @property {string} [color] - Color for the capability in the UI
 * @property {number} [order] - Display order
 * @property {string} [group] - Group name for the capability
 */

/**
 * @typedef {object} Capability
 * @property {string} capabilityId - Unique identifier for the capability (e.g., 'greet', 'model.switch')
 * @property {string} name - Human-readable name of the capability
 * @property {string} description - Description of what the capability does
 * @property {CapabilityCategory} category - Category of the capability
 * @property {string} [icon] - Icon identifier
 * @property {CapabilityParameters} parameters - JSON Schema for input parameters
 * @property {Function} handler - Async function that handles capability invocations
 * @property {UIHints} [uiHints] - UI hints for displaying the capability
 * @property {string} [version] - Capability version
 */

/**
 * @typedef {object} ReconnectConfig
 * @property {boolean} [enabled=true] - Whether auto-reconnect is enabled
 * @property {number} [initialDelay=1000] - Initial reconnect delay in ms
 * @property {number} [maxDelay=30000] - Maximum reconnect delay in ms
 * @property {number} [maxRetries=10] - Maximum number of reconnect attempts
 */

/**
 * @typedef {object} HermesAgentConfig
 * @property {string} token - Agent token (acrp_xxxxx) from Hermes Hub
 * @property {string} [name] - Agent name (overridden by server if token is pre-registered)
 * @property {string} [version='1.0.0'] - Agent version
 * @property {string} [platform='hermes-agent-sdk'] - Agent platform identifier
 * @property {Capability[]} [capabilities=[]] - List of capabilities to register
 * @property {string} [wsUrl='http://localhost:3004'] - WebSocket server URL
 * @property {number} [heartbeatInterval=15000] - Heartbeat interval in ms
 * @property {number} [invocationTimeout=30000] - Default invocation handler timeout in ms
 * @property {ReconnectConfig} [reconnect] - Auto-reconnect configuration
 * @property {boolean} [autoRegister=true] - Whether to auto-register capabilities on connect
 * @property {boolean} [autoHandleInvocations=true] - Whether to auto-handle invocations with capability handlers
 * @property {object} [metadata] - Additional metadata to send during registration
 */

/**
 * @typedef {object} ConnectedEvent
 * @property {string} agentId - The agent's unique ID assigned by the server
 * @property {string} agentName - The agent's name
 * @property {string} [message] - Welcome message from the server
 */

/**
 * @typedef {object} DisconnectedEvent
 * @property {string} reason - Reason for disconnection
 */

/**
 * @typedef {object} InvocationEvent
 * @property {string} invocationId - Unique ID for this invocation
 * @property {string} capabilityId - The capability being invoked
 * @property {Record<string, any>} parameters - Parameters for the capability
 * @property {string} [invokedBy] - Who invoked the capability
 * @property {string} [requestedAt] - ISO timestamp of invocation
 * @property {Function} handle - Call this to execute the capability handler and get the result
 */

/**
 * @typedef {object} CommandEvent
 * @property {string} command - The command name
 * @property {Record<string, any>} params - Command parameters
 * @property {string} [commandId] - Unique ID for this command
 */

/**
 * @typedef {object} ErrorEvent
 * @property {string} message - Error message
 * @property {string} [code] - Error code
 */

/**
 * @typedef {object} HeartbeatEvent
 * @property {string} timestamp - ISO timestamp of the heartbeat acknowledgment
 * @property {number} [nextInterval] - Next expected heartbeat interval in seconds
 */

/**
 * @typedef {object} ReconnectingEvent
 * @property {number} attempt - Current reconnect attempt number
 * @property {number} delay - Delay before this reconnect attempt in ms
 */

/**
 * @typedef {object} ChatMessageEvent
 * @property {string} conversationId - The conversation ID
 * @property {string} content - Message content
 * @property {string} senderId - Sender's user ID
 * @property {string} senderName - Sender's display name
 */

/**
 * @typedef {object} AgentStatus
 * @property {boolean} connected - Whether the agent is currently connected
 * @property {string|null} agentId - The agent's unique ID (null if not connected)
 * @property {string|null} agentName - The agent's name (null if not connected)
 * @property {string[]} capabilities - List of registered capability IDs
 * @property {number} uptime - Uptime in seconds since connection
 * @property {string|null} lastHeartbeat - ISO timestamp of last heartbeat
 * @property {number} reconnectAttempt - Current reconnect attempt (0 if connected)
 */

// Export markers for type reference
module.exports = {
  /** @type {CapabilityCategory[]} */
  CAPABILITY_CATEGORIES: [
    'model', 'skill', 'soul', 'memory', 'gateway', 'chat', 'system', 'general'
  ],

  /** Default configuration values */
  DEFAULTS: {
    WS_URL: 'http://localhost:3004',
    HEARTBEAT_INTERVAL: 15000,
    INVOCATION_TIMEOUT: 30000,
    VERSION: '1.0.0',
    PLATFORM: 'hermes-agent-sdk',
    RECONNECT: {
      ENABLED: true,
      INITIAL_DELAY: 1000,
      MAX_DELAY: 30000,
      MAX_RETRIES: 10,
    },
  },

  /**
   * Event names emitted by HermesAgent
   * @enum {string}
   */
  Events: {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    INVOCATION: 'invocation',
    COMMAND: 'command',
    ERROR: 'error',
    HEARTBEAT: 'heartbeat',
    RECONNECTING: 'reconnecting',
    CHAT_MESSAGE: 'chat:message',
  },

  /**
   * Socket.IO event names used in the ACRP protocol
   * (matching the actual skill-ws server implementation)
   * @enum {string}
   */
  SocketEvents: {
    // Client → Server
    AGENT_REGISTER: 'agent:register',
    AGENT_HEARTBEAT: 'agent:heartbeat',
    CAPABILITY_RESULT: 'capability:result',
    AGENT_STATUS: 'agent:status',
    AGENT_EVENT: 'agent:event',
    COMMAND_ACK: 'command:ack',

    // Server → Client
    AGENT_REGISTERED: 'agent:registered',
    AGENT_HEARTBEAT_ACK: 'agent:heartbeat-ack',
    CAPABILITY_INVOKE: 'capability:invoke',
    AGENT_NOTIFICATION: 'agent:notification',
    CHAT_MESSAGE: 'chat:message',
  },
}
