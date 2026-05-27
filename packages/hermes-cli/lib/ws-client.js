import { io } from 'socket.io-client';
import { getWsUrl, getAcrpToken, setAcrpToken } from './config-store.js';
import chalk from 'chalk';

/**
 * WebSocket client for ACRP agent connection
 * Handles: connection, authentication, capability registration, heartbeats, invocations
 *
 * Server events (skill-ws on port 3004):
 *   Incoming: capability:invoke, agent:command, agent:notification, skill:invoke
 *   Outgoing: agent:register, agent:heartbeat, capability:result, command:ack
 *   Auth: socket.handshake.auth.agentToken
 */
export class WSClient {
  constructor(agentId, options = {}) {
    this.agentId = agentId;
    this.wsUrl = getWsUrl();
    this.socket = null;
    this.heartbeatInterval = null;
    this.capabilities = options.capabilities || [];
    this.handlers = options.handlers || {};
    this.onConnect = options.onConnect || null;
    this.onDisconnect = options.onDisconnect || null;
    this.onInvocation = options.onInvocation || null;
    this.onError = options.onError || null;
    this.connected = false;
    this.acrpToken = null;
  }

  async connect() {
    // Get ACRP token
    this.acrpToken = getAcrpToken(this.agentId);

    if (!this.acrpToken) {
      console.log(chalk.yellow('⚠ No ACRP token found. Please generate one with:'));
      console.log(chalk.cyan(`  hermes agent token ${this.agentId}`));
      throw new Error('No ACRP token configured');
    }

    return new Promise((resolve, reject) => {
      console.log(chalk.cyan('🔌 Connecting to Hermes Hub WebSocket...'));
      console.log(chalk.gray(`   Server: ${this.wsUrl}`));
      console.log(chalk.gray(`   Agent: ${this.agentId}`));

      this.socket = io(this.wsUrl, {
        transports: ['websocket'],
        auth: {
          agentToken: this.acrpToken,
        },
        query: {
          XTransformPort: '3004',
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 30000,
      });

      this.socket.on('connect', () => {
        this.connected = true;
        console.log(chalk.green('✅ Connected to Hermes Hub'));
        this._registerCapabilities();
        this._startHeartbeat();
        if (this.onConnect) this.onConnect();
        resolve();
      });

      this.socket.on('disconnect', (reason) => {
        this.connected = false;
        this._stopHeartbeat();
        console.log(chalk.yellow(`🔌 Disconnected: ${reason}`));
        if (this.onDisconnect) this.onDisconnect(reason);
      });

      this.socket.on('connect_error', (error) => {
        console.log(chalk.red(`❌ Connection error: ${error.message}`));
        if (this.onError) this.onError(error);
        reject(error);
      });

      // ACRP: Agent registered event
      this.socket.on('agent:registered', (data) => {
        console.log(chalk.green(`⚡ Agent registered: ${data.agentId || this.agentId}`));
        if (data.capabilities && data.capabilities.length > 0) {
          console.log(chalk.gray(`   Capabilities: ${data.capabilities.map(c => c.id || c.name || c).join(', ')}`));
        }
      });

      // ACRP: Capability invocation
      this.socket.on('capability:invoke', async (data) => {
        const capName = data.capabilityId || data.capability || data.name;
        console.log(chalk.cyan(`⚡ Capability invoked: ${capName}`));
        console.log(chalk.gray(`   Invocation ID: ${data.requestId || data.invocationId}`));
        if (data.params) {
          console.log(chalk.gray(`   Params: ${JSON.stringify(data.params).substring(0, 200)}`));
        }

        try {
          let result;
          if (this.handlers[capName]) {
            result = await this.handlers[capName](data.params, data);
          } else if (this.onInvocation) {
            result = await this.onInvocation(data);
          } else {
            result = { error: `No handler for capability: ${capName}` };
          }

          this.socket.emit('capability:result', {
            requestId: data.requestId || data.invocationId,
            result,
            agentId: this.agentId,
          });
          console.log(chalk.green(`   ✅ Result sent`));
        } catch (error) {
          this.socket.emit('capability:result', {
            requestId: data.requestId || data.invocationId,
            result: { error: error.message },
            agentId: this.agentId,
          });
          console.log(chalk.red(`   ❌ Error: ${error.message}`));
        }
      });

      // ACRP: Agent command
      this.socket.on('agent:command', (data) => {
        console.log(chalk.blue(`📋 Command received: ${data.command || data.type}`));
        if (data.params) {
          console.log(chalk.gray(`   Params: ${JSON.stringify(data.params).substring(0, 200)}`));
        }
        // Acknowledge command
        this.socket.emit('command:ack', {
          commandId: data.commandId,
          status: 'received',
        });
      });

      // ACRP: Agent notification
      this.socket.on('agent:notification', (data) => {
        console.log(chalk.blue(`🔔 Notification: ${data.message || data.type || JSON.stringify(data).substring(0, 100)}`));
      });

      // ACRP: Heartbeat ack
      this.socket.on('agent:heartbeat-ack', () => {
        // Silent heartbeat ack
      });

      // Legacy skill events
      this.socket.on('skill:invoke', async (data) => {
        console.log(chalk.cyan(`🔧 Skill invoked: ${data.skillId || data.endpoint}`));
        try {
          let result;
          if (this.handlers[data.skillId || data.endpoint]) {
            result = await this.handlers[data.skillId || data.endpoint](data.params, data);
          } else if (this.onInvocation) {
            result = await this.onInvocation(data);
          } else {
            result = { error: `No handler for skill: ${data.skillId || data.endpoint}` };
          }
          this.socket.emit('skill:invoke-response', {
            requestId: data.requestId,
            result,
          });
          console.log(chalk.green(`   ✅ Skill result sent`));
        } catch (error) {
          this.socket.emit('skill:invoke-response', {
            requestId: data.requestId,
            result: { error: error.message },
          });
          console.log(chalk.red(`   ❌ Skill error: ${error.message}`));
        }
      });

      // Error event
      this.socket.on('error', (error) => {
        console.log(chalk.red(`❌ Socket error: ${error.message || error}`));
      });
    });
  }

  _registerCapabilities() {
    if (this.capabilities.length > 0) {
      console.log(chalk.cyan(`📡 Registering ${this.capabilities.length} capabilities...`));
    }

    // Build capability objects for ACRP registration
    const capabilityObjects = this.capabilities.map(c => {
      if (typeof c === 'string') {
        return { id: c, name: c, description: `Capability: ${c}`, category: 'custom', parameters: {} };
      }
      return c;
    });

    this.socket.emit('agent:register', {
      agentId: this.agentId,
      capabilities: capabilityObjects,
      name: this.agentId,
      version: '1.0.0',
      platform: 'hermes-cli',
    });
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    console.log(chalk.gray('💓 Heartbeat started (15s interval)'));
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.connected) {
        this.socket.emit('agent:heartbeat', {
          status: 'online',
          metrics: {
            uptime: process.uptime(),
          },
        });
      }
    }, 15000);
  }

  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  disconnect() {
    this._stopHeartbeat();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.connected = false;
    console.log(chalk.yellow('👋 Disconnected from Hermes Hub'));
  }

  sendCommand(command, params = {}) {
    if (!this.socket || !this.connected) {
      throw new Error('Not connected to Hermes Hub');
    }
    this.socket.emit('agent:event', {
      type: 'command',
      command,
      params,
    });
  }

  getStatus() {
    return {
      connected: this.connected,
      agentId: this.agentId,
      capabilities: this.capabilities,
      socketId: this.socket?.id || null,
    };
  }
}

export default WSClient;
