/**
 * Hermes Agent SDK — Example Configuration File
 *
 * This file shows how to configure a Hermes Agent using a config file.
 * You can load this config in your agent code:
 *
 *   const config = require('./hermes.config.js')
 *   const agent = new HermesAgent(config)
 *
 * Or override specific settings:
 *
 *   const config = require('./hermes.config.js')
 *   config.token = process.env.AGENT_TOKEN
 *   const agent = new HermesAgent(config)
 */

module.exports = {
  // ── Required ──────────────────────────────────────────────────────
  // Get your token from: Hermes Hub → Agent Control Center → Generate Token
  token: process.env.AGENT_TOKEN || 'acrp_YOUR_TOKEN_HERE',

  // ── Agent Identity ────────────────────────────────────────────────
  name: process.env.AGENT_NAME || 'My Hermes Agent',
  version: '1.0.0',
  platform: 'hermes-agent-sdk',

  // ── WebSocket Connection ──────────────────────────────────────────
  // URL of the Hermes Hub Skill WebSocket service
  wsUrl: process.env.HERMES_WS_URL || 'http://localhost:3004',

  // ── Heartbeat ─────────────────────────────────────────────────────
  // How often to send heartbeat pings (in milliseconds)
  heartbeatInterval: 15000, // 15 seconds

  // ── Invocation ────────────────────────────────────────────────────
  // Default timeout for capability handlers (in milliseconds)
  invocationTimeout: 30000, // 30 seconds

  // ── Auto-behavior ─────────────────────────────────────────────────
  // Whether to automatically register capabilities on connect
  autoRegister: true,

  // Whether to automatically handle invocations using capability handlers
  // If false, you must handle invocations manually via the 'invocation' event
  autoHandleInvocations: true,

  // ── Auto-reconnect ────────────────────────────────────────────────
  reconnect: {
    enabled: true,
    initialDelay: 1000,   // Start with 1 second
    maxDelay: 30000,      // Max 30 seconds between retries
    maxRetries: 10,       // Give up after 10 attempts
  },

  // ── Custom Metadata ───────────────────────────────────────────────
  // Any additional metadata you want to send during registration
  metadata: {
    description: 'A custom Hermes Hub agent',
    author: 'Your Name',
    repository: 'https://github.com/your-repo',
  },

  // ── Capabilities ──────────────────────────────────────────────────
  // Define your agent's capabilities here
  capabilities: [
    // Example: A simple echo capability
    {
      capabilityId: 'echo',
      name: 'Echo',
      description: 'Echo back the input message',
      category: 'chat',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message to echo back',
          },
        },
        required: ['message'],
      },
      handler: async (params) => {
        return { echo: params.message }
      },
    },

    // Example: A system health check capability
    {
      capabilityId: 'health',
      name: 'Health Check',
      description: 'Get the agent health status',
      category: 'system',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: async () => {
        return {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          timestamp: new Date().toISOString(),
        }
      },
    },

    // Add more capabilities here...
  ],
}
