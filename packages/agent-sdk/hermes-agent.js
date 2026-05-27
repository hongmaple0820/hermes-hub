/**
 * @hermes-hub/agent-sdk — HermesAgent Core Class
 *
 * The main agent class that connects to Hermes Hub via WebSocket (Socket.IO)
 * using the ACRP (Agent Capability Registration Protocol).
 *
 * Usage:
 *   const agent = new HermesAgent({ token: 'acrp_xxxxx', name: 'My Agent', capabilities: [...] });
 *   agent.on('connected', () => console.log('Connected!'));
 *   await agent.start();
 */

'use strict'

const { io } = require('socket.io-client')
const EventEmitter = require('eventemitter3')
const { DEFAULTS, Events, SocketEvents } = require('./types')

class HermesAgent extends EventEmitter {
  /**
   * Creates a new HermesAgent instance.
   * @param {import('./types').HermesAgentConfig} config - Agent configuration
   */
  constructor(config) {
    super()

    if (!config || !config.token) {
      throw new Error('HermesAgent requires a token (acrp_xxxxx). Get one from Hermes Hub > Agent Control Center.')
    }

    /** @private */
    this._config = {
      token: config.token,
      name: config.name || 'Unnamed Agent',
      version: config.version || DEFAULTS.VERSION,
      platform: config.platform || DEFAULTS.PLATFORM,
      wsUrl: config.wsUrl || DEFAULTS.WS_URL,
      heartbeatInterval: config.heartbeatInterval || DEFAULTS.HEARTBEAT_INTERVAL,
      invocationTimeout: config.invocationTimeout || DEFAULTS.INVOCATION_TIMEOUT,
      autoRegister: config.autoRegister !== undefined ? config.autoRegister : true,
      autoHandleInvocations: config.autoHandleInvocations !== undefined ? config.autoHandleInvocations : true,
      metadata: config.metadata || {},
      reconnect: {
        enabled: config.reconnect?.enabled !== undefined ? config.reconnect.enabled : DEFAULTS.RECONNECT.ENABLED,
        initialDelay: config.reconnect?.initialDelay || DEFAULTS.RECONNECT.INITIAL_DELAY,
        maxDelay: config.reconnect?.maxDelay || DEFAULTS.RECONNECT.MAX_DELAY,
        maxRetries: config.reconnect?.maxRetries || DEFAULTS.RECONNECT.MAX_RETRIES,
      },
    }

    /** @private @type {Map<string, import('./types').Capability>} */
    this._capabilities = new Map()

    // Register initial capabilities
    if (config.capabilities && Array.isArray(config.capabilities)) {
      for (const cap of config.capabilities) {
        this._validateCapability(cap)
        this._capabilities.set(cap.capabilityId, cap)
      }
    }

    /** @private */
    this._socket = null

    /** @private */
    this._connected = false

    /** @private */
    this._agentId = null

    /** @private */
    this._agentName = null

    /** @private */
    this._connectedAt = null

    /** @private */
    this._lastHeartbeat = null

    /** @private */
    this._heartbeatTimer = null

    /** @private */
    this._reconnectAttempt = 0

    /** @private */
    this._reconnectTimer = null

    /** @private */
    this._stopping = false

    /** @private */
    this._started = false

    // Bind methods for cleanup
    this._handleSigInt = this._handleSignal.bind(this, 'SIGINT')
    this._handleSigTerm = this._handleSignal.bind(this, 'SIGTERM')
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Start the agent — connect to Hermes Hub, register capabilities, start heartbeat.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._started) {
      throw new Error('Agent has already been started. Call stop() first if you want to restart.')
    }

    this._started = true
    this._stopping = false

    // Set up graceful shutdown handlers
    process.on('SIGINT', this._handleSigInt)
    process.on('SIGTERM', this._handleSigTerm)

    return new Promise((resolve, reject) => {
      this._connect((err) => {
        if (err) {
          this._started = false
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  /**
   * Stop the agent — disconnect gracefully from Hermes Hub.
   * @returns {Promise<void>}
   */
  async stop() {
    if (!this._started) {
      return
    }

    this._stopping = true
    this._started = false

    // Remove signal handlers
    process.removeListener('SIGINT', this._handleSigInt)
    process.removeListener('SIGTERM', this._handleSigTerm)

    // Stop heartbeat
    this._stopHeartbeat()

    // Cancel any pending reconnect
    this._cancelReconnect()

    // Disconnect socket
    if (this._socket) {
      this._socket.disconnect()
      this._socket = null
    }

    const reason = 'Agent stopped by user'
    this._connected = false
    this._agentId = null
    this._connectedAt = null

    this.emit(Events.DISCONNECTED, { reason })
  }

  /**
   * Send a capability result back to Hermes Hub.
   * @param {string} invocationId - The invocation ID to respond to
   * @param {*} result - The result data
   * @param {boolean} [success=true] - Whether the invocation was successful
   */
  sendResult(invocationId, result, success = true) {
    if (!this._socket || !this._connected) {
      this.emit(Events.ERROR, { message: 'Cannot send result: not connected to Hermes Hub' })
      return
    }

    const payload = {
      invocationId,
      result: success ? result : undefined,
      error: success ? undefined : (typeof result === 'string' ? result : JSON.stringify(result)),
      duration: undefined, // Will be set by auto-handling if applicable
    }

    this._socket.emit(SocketEvents.CAPABILITY_RESULT, payload)
  }

  /**
   * Add a capability to the agent. If connected, re-registers all capabilities.
   * @param {import('./types').Capability} capability - The capability to add
   */
  addCapability(capability) {
    this._validateCapability(capability)
    this._capabilities.set(capability.capabilityId, capability)

    // Re-register if connected
    if (this._connected && this._socket) {
      this._registerCapabilities()
    }
  }

  /**
   * Remove a capability by ID. If connected, re-registers remaining capabilities.
   * @param {string} capabilityId - The capability ID to remove
   * @returns {boolean} Whether the capability was found and removed
   */
  removeCapability(capabilityId) {
    const removed = this._capabilities.delete(capabilityId)

    if (removed && this._connected && this._socket) {
      this._registerCapabilities()
    }

    return removed
  }

  /**
   * Get the current agent status.
   * @returns {import('./types').AgentStatus}
   */
  getStatus() {
    return {
      connected: this._connected,
      agentId: this._agentId,
      agentName: this._agentName,
      capabilities: Array.from(this._capabilities.keys()),
      uptime: this._connectedAt ? Math.floor((Date.now() - this._connectedAt.getTime()) / 1000) : 0,
      lastHeartbeat: this._lastHeartbeat ? this._lastHeartbeat.toISOString() : null,
      reconnectAttempt: this._reconnectAttempt,
    }
  }

  /**
   * Send a status update to Hermes Hub.
   * @param {string} status - Agent status ('online', 'busy', 'error')
   * @param {object} [metrics] - Optional metrics
   */
  sendStatus(status, metrics) {
    if (!this._socket || !this._connected) return

    this._socket.emit(SocketEvents.AGENT_STATUS, {
      status,
      metrics: metrics || {},
    })
  }

  /**
   * Send a custom event to Hermes Hub.
   * @param {string} type - Event type
   * @param {*} data - Event data
   */
  sendEvent(type, data) {
    if (!this._socket || !this._connected) return

    this._socket.emit(SocketEvents.AGENT_EVENT, { type, data })
  }

  /**
   * Send a chat message to a conversation.
   * @param {string} conversationId - The conversation ID
   * @param {string} content - Message content
   * @param {string} [senderName] - Sender name override
   */
  sendChatMessage(conversationId, content, senderName) {
    this.sendEvent('message', {
      conversationId,
      content,
      senderName: senderName || this._agentName || this._config.name,
    })
  }

  /**
   * Acknowledge a command received from the server.
   * @param {string} commandId - The command ID
   * @param {'received' | 'executing' | 'completed' | 'failed'} status - Acknowledgment status
   * @param {*} [result] - Command result (for completed status)
   * @param {string} [error] - Error message (for failed status)
   */
  acknowledgeCommand(commandId, status, result, error) {
    if (!this._socket || !this._connected) return

    this._socket.emit(SocketEvents.COMMAND_ACK, {
      commandId,
      status,
      result,
      error,
    })
  }

  /**
   * Get a capability by ID.
   * @param {string} capabilityId
   * @returns {import('./types').Capability | undefined}
   */
  getCapability(capabilityId) {
    return this._capabilities.get(capabilityId)
  }

  /**
   * Get all registered capabilities.
   * @returns {import('./types').Capability[]}
   */
  getCapabilities() {
    return Array.from(this._capabilities.values())
  }

  // ---------------------------------------------------------------------------
  // Private — Connection
  // ---------------------------------------------------------------------------

  /**
   * @private
   * Connect to the WebSocket server.
   * @param {Function} callback - Called with (error) on connect or failure
   */
  _connect(callback) {
    const wsUrl = this._config.wsUrl

    try {
      this._socket = io(wsUrl, {
        auth: {
          agentToken: this._config.token,
        },
        transports: ['websocket'],
        reconnection: false, // We handle reconnection ourselves
        timeout: 10000,
        forceNew: true,
      })
    } catch (err) {
      callback(err)
      return
    }

    // -----------------------------------------------------------------------
    // Connection success — server has authenticated us via middleware
    // -----------------------------------------------------------------------

    this._socket.on('connect', () => {
      this._log('Connected to Hermes Hub, registering capabilities...')

      // The server's middleware has already validated our token and set up
      // the ACRP session. We now need to register our capabilities.
      if (this._config.autoRegister) {
        this._registerCapabilities()
      }

      // Start heartbeat
      this._startHeartbeat()

      // Reset reconnect state
      this._reconnectAttempt = 0
      this._cancelReconnect()
    })

    // -----------------------------------------------------------------------
    // Registration confirmed
    // -----------------------------------------------------------------------

    this._socket.on(SocketEvents.AGENT_REGISTERED, (data) => {
      if (data.success) {
        this._connected = true
        this._connectedAt = new Date()
        this._lastHeartbeat = new Date()

        // The agentId comes from the server's auth middleware
        // It's stored in socket.data on the server side, but we need
        // to extract it from the registration context
        this._agentId = this._socket.data?.agentId || data.agentId || null
        this._agentName = this._config.name

        this._log(`Registered successfully! Agent: ${this._agentName}`)

        this.emit(Events.CONNECTED, {
          agentId: this._agentId,
          agentName: this._agentName,
          message: data.message || 'Connected to Hermes Hub',
        })

        if (callback) {
          callback(null)
          callback = null // Only call once
        }
      } else {
        this._log('Registration failed:', data)
        this.emit(Events.ERROR, { message: data.error || 'Registration failed' })

        if (callback) {
          callback(new Error(data.error || 'Registration failed'))
          callback = null
        }
      }
    })

    // -----------------------------------------------------------------------
    // Capability invocation from server
    // -----------------------------------------------------------------------

    this._socket.on(SocketEvents.CAPABILITY_INVOKE, (data) => {
      this._log(`Invocation received: ${data.capabilityId} (${data.invocationId})`)

      const invocation = {
        invocationId: data.invocationId,
        capabilityId: data.capabilityId,
        parameters: data.params || data.parameters || {},
        invokedBy: data.invokedBy,
        requestedAt: data.timestamp || new Date().toISOString(),
        handle: () => this._handleInvocation(data),
      }

      // Emit the invocation event for manual handling
      this.emit(Events.INVOCATION, invocation)

      // Auto-handle if enabled and the user hasn't already called handle()
      if (this._config.autoHandleInvocations) {
        // Use setImmediate to allow the user's invocation handler to call handle() first
        setImmediate(() => {
          // If auto-handle is still enabled and handle() wasn't called by user,
          // we handle it automatically
          if (!invocation._handled) {
            invocation._handled = true
            this._autoHandleInvocation(invocation)
          }
        })
      }
    })

    // -----------------------------------------------------------------------
    // Server notification / command
    // -----------------------------------------------------------------------

    this._socket.on(SocketEvents.AGENT_NOTIFICATION, (data) => {
      this._log(`Notification: ${data.type}`)

      if (data.type === 'replaced') {
        this.emit(Events.ERROR, {
          message: 'Connection replaced by another instance',
          code: 'CONNECTION_REPLACED',
        })
        return
      }

      // Treat notifications with 'command' type as commands
      if (data.type === 'command' || data.command) {
        this.emit(Events.COMMAND, {
          command: data.command || data.data?.command,
          params: data.params || data.data?.params || data.data,
          commandId: data.commandId || data.data?.commandId,
        })
      }
    })

    // -----------------------------------------------------------------------
    // Chat message from server (forwarded from chat-service)
    // -----------------------------------------------------------------------

    this._socket.on(SocketEvents.CHAT_MESSAGE, (data) => {
      this._log(`Chat message from ${data.senderName}: ${data.content?.substring(0, 50)}`)
      this.emit(Events.CHAT_MESSAGE, data)
    })

    // -----------------------------------------------------------------------
    // Heartbeat acknowledgment
    // -----------------------------------------------------------------------

    this._socket.on(SocketEvents.AGENT_HEARTBEAT_ACK, (data) => {
      this._lastHeartbeat = new Date()
      this.emit(Events.HEARTBEAT, {
        timestamp: data.timestamp,
        nextInterval: data.nextInterval,
      })
    })

    // -----------------------------------------------------------------------
    // Connection error
    // -----------------------------------------------------------------------

    this._socket.on('connect_error', (err) => {
      this._log(`Connection error: ${err.message}`)
      this.emit(Events.ERROR, { message: `Connection error: ${err.message}` })

      if (callback) {
        callback(err)
        callback = null
      } else {
        // Not initial connect — attempt reconnect
        this._attemptReconnect()
      }
    })

    // -----------------------------------------------------------------------
    // Disconnection
    // -----------------------------------------------------------------------

    this._socket.on('disconnect', (reason) => {
      this._log(`Disconnected: ${reason}`)
      this._connected = false
      this._stopHeartbeat()

      this.emit(Events.DISCONNECTED, { reason })

      // Attempt reconnect unless we're stopping
      if (!this._stopping && this._config.reconnect.enabled) {
        this._attemptReconnect()
      }
    })
  }

  // ---------------------------------------------------------------------------
  // Private — Registration
  // ---------------------------------------------------------------------------

  /**
   * @private
   * Register all capabilities with the server.
   */
  _registerCapabilities() {
    if (!this._socket || !this._socket.connected) return

    const capabilities = Array.from(this._capabilities.values()).map((cap) => ({
      id: cap.capabilityId,
      name: cap.name,
      description: cap.description,
      category: cap.category,
      parameters: cap.parameters,
      uiHints: cap.uiHints || {},
      icon: cap.icon,
      version: cap.version,
    }))

    this._socket.emit(SocketEvents.AGENT_REGISTER, {
      name: this._config.name,
      version: this._config.version,
      platform: this._config.platform,
      capabilities,
      metadata: this._config.metadata,
    })
  }

  // ---------------------------------------------------------------------------
  // Private — Heartbeat
  // ---------------------------------------------------------------------------

  /**
   * @private
   * Start the heartbeat timer.
   */
  _startHeartbeat() {
    this._stopHeartbeat()

    this._heartbeatTimer = setInterval(() => {
      if (this._socket && this._connected) {
        this._socket.emit(SocketEvents.AGENT_HEARTBEAT, {
          status: 'online',
          metrics: {
            uptime: this._connectedAt ? Math.floor((Date.now() - this._connectedAt.getTime()) / 1000) : 0,
            capabilities: this._capabilities.size,
          },
        })
      }
    }, this._config.heartbeatInterval)
  }

  /**
   * @private
   * Stop the heartbeat timer.
   */
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = null
    }
  }

  // ---------------------------------------------------------------------------
  // Private — Auto-Reconnect
  // ---------------------------------------------------------------------------

  /**
   * @private
   * Attempt to reconnect with exponential backoff.
   */
  _attemptReconnect() {
    if (this._stopping || this._reconnectTimer) return

    const { maxRetries, initialDelay, maxDelay } = this._config.reconnect
    this._reconnectAttempt++

    if (this._reconnectAttempt > maxRetries) {
      this._log(`Max reconnect attempts (${maxRetries}) exceeded. Giving up.`)
      this.emit(Events.ERROR, {
        message: `Failed to reconnect after ${maxRetries} attempts`,
        code: 'RECONNECT_EXHAUSTED',
      })
      return
    }

    // Exponential backoff with jitter
    const baseDelay = Math.min(initialDelay * Math.pow(2, this._reconnectAttempt - 1), maxDelay)
    const jitter = Math.random() * baseDelay * 0.3
    const delay = Math.floor(baseDelay + jitter)

    this._log(`Reconnecting in ${delay}ms (attempt ${this._reconnectAttempt}/${maxRetries})`)
    this.emit(Events.RECONNECTING, {
      attempt: this._reconnectAttempt,
      delay,
    })

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null

      if (this._stopping) return

      // Clean up old socket
      if (this._socket) {
        this._socket.removeAllListeners()
        this._socket.disconnect()
        this._socket = null
      }

      this._connect(null)
    }, delay)
  }

  /**
   * @private
   * Cancel any pending reconnect attempt.
   */
  _cancelReconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }
    this._reconnectAttempt = 0
  }

  // ---------------------------------------------------------------------------
  // Private — Invocation Handling
  // ---------------------------------------------------------------------------

  /**
   * @private
   * Handle an invocation by finding the matching capability and calling its handler.
   * @param {object} data - The invocation data from the server
   * @returns {Promise<*>}
   */
  async _handleInvocation(data) {
    const { invocationId, capabilityId, params } = data
    const capability = this._capabilities.get(capabilityId)
    const startTime = Date.now()

    if (!capability) {
      const error = `Unknown capability: ${capabilityId}`
      this._log(`Invocation error: ${error}`)
      this.sendResult(invocationId, error, false)
      return { error }
    }

    // Determine timeout
    const timeout = capability.uiHints?.timeout || this._config.invocationTimeout

    try {
      // Execute handler with timeout
      const result = await Promise.race([
        capability.handler(params || {}),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Capability handler timed out after ${timeout}ms`)), timeout)
        ),
      ])

      const duration = Date.now() - startTime
      this._log(`Invocation completed: ${capabilityId} in ${duration}ms`)

      // Send result if not already sent by user
      if (this._socket && this._connected) {
        this._socket.emit(SocketEvents.CAPABILITY_RESULT, {
          invocationId,
          result,
          duration,
        })
      }

      return result
    } catch (err) {
      const duration = Date.now() - startTime
      this._log(`Invocation failed: ${capabilityId} — ${err.message}`)

      // Send error result
      if (this._socket && this._connected) {
        this._socket.emit(SocketEvents.CAPABILITY_RESULT, {
          invocationId,
          error: err.message,
          duration,
        })
      }

      return { error: err.message }
    }
  }

  /**
   * @private
   * Auto-handle an invocation (called when autoHandleInvocations is true).
   * @param {object} invocation - The invocation event object
   */
  async _autoHandleInvocation(invocation) {
    try {
      await invocation.handle()
    } catch (err) {
      this._log(`Auto-handle error: ${err.message}`)
    }
  }

  // ---------------------------------------------------------------------------
  // Private — Validation
  // ---------------------------------------------------------------------------

  /**
   * @private
   * Validate a capability definition.
   * @param {import('./types').Capability} capability
   */
  _validateCapability(capability) {
    if (!capability.capabilityId) {
      throw new Error('Capability must have a capabilityId')
    }
    if (!capability.name) {
      throw new Error(`Capability '${capability.capabilityId}' must have a name`)
    }
    if (!capability.description) {
      throw new Error(`Capability '${capability.capabilityId}' must have a description`)
    }
    if (!capability.category) {
      throw new Error(`Capability '${capability.capabilityId}' must have a category`)
    }
    if (typeof capability.handler !== 'function') {
      throw new Error(`Capability '${capability.capabilityId}' must have a handler function`)
    }
    if (!capability.parameters) {
      throw new Error(`Capability '${capability.capabilityId}' must have parameters (use { type: 'object', properties: {} } for no params)`)
    }
  }

  // ---------------------------------------------------------------------------
  // Private — Signal Handling
  // ---------------------------------------------------------------------------

  /**
   * @private
   * Handle process signals for graceful shutdown.
   * @param {string} signal
   */
  async _handleSignal(signal) {
    this._log(`Received ${signal}, shutting down gracefully...`)
    await this.stop()
    process.exit(0)
  }

  // ---------------------------------------------------------------------------
  // Private — Logging
  // ---------------------------------------------------------------------------

  /**
   * @private
   * Log a message with agent prefix.
   * @param {...*} args
   */
  _log(...args) {
    const name = this._config.name || 'HermesAgent'
    console.log(`[HermesAgent:${name}]`, ...args)
  }
}

module.exports = HermesAgent
