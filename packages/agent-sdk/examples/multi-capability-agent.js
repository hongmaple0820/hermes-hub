/**
 * Multi-Capability Agent Example
 *
 * An agent with multiple capabilities across different categories,
 * demonstrating the full power of the ACRP protocol.
 *
 * Usage:
 *   node examples/multi-capability-agent.js
 */

const { HermesAgent } = require('..')

const AGENT_TOKEN = process.env.AGENT_TOKEN || 'acrp_YOUR_TOKEN_HERE'

async function main() {
  const agent = new HermesAgent({
    token: AGENT_TOKEN,
    name: 'Multi-Tool Agent',
    version: '2.0.0',
    platform: 'example-multi',
    capabilities: [
      // ── Chat capability ─────────────────────────────────────────────
      {
        capabilityId: 'echo',
        name: 'Echo',
        description: 'Echo back the input message',
        category: 'chat',
        icon: '🔊',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The message to echo back',
            },
            uppercase: {
              type: 'boolean',
              description: 'Whether to convert to uppercase',
              default: false,
            },
          },
          required: ['message'],
        },
        uiHints: {
          confirmRequired: false,
          timeout: 5000,
        },
        handler: async (params) => {
          const result = params.uppercase ? params.message.toUpperCase() : params.message
          return { echo: result, original: params.message }
        },
      },

      // ── Model capability ─────────────────────────────────────────────
      {
        capabilityId: 'model.list',
        name: 'List Models',
        description: 'List available LLM models',
        category: 'model',
        icon: '🤖',
        parameters: {
          type: 'object',
          properties: {
            provider: {
              type: 'string',
              description: 'Filter by provider (openai, anthropic, google)',
              enum: ['openai', 'anthropic', 'google', 'all'],
              default: 'all',
            },
          },
          required: [],
        },
        handler: async (params) => {
          const models = {
            openai: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
            anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
            google: ['gemini-pro', 'gemini-ultra'],
          }

          if (params.provider === 'all') {
            return { models: models }
          }
          return { models: models[params.provider] || [] }
        },
      },

      // ── Memory capability ────────────────────────────────────────────
      {
        capabilityId: 'memory.store',
        name: 'Store Memory',
        description: 'Store a key-value pair in agent memory',
        category: 'memory',
        icon: '🧠',
        parameters: {
          type: 'object',
          properties: {
            key: {
              type: 'string',
              description: 'Memory key',
            },
            value: {
              type: 'string',
              description: 'Memory value',
            },
            tags: {
              type: 'array',
              description: 'Tags for categorization',
              items: { type: 'string' },
            },
          },
          required: ['key', 'value'],
        },
        uiHints: {
          confirmRequired: true,
          timeout: 10000,
        },
        handler: async (params) => {
          // In a real agent, this would persist to a database
          console.log(`📝 Stored memory: ${params.key} = ${params.value}`)
          return {
            stored: true,
            key: params.key,
            timestamp: new Date().toISOString(),
          }
        },
      },

      // ── Skill capability ─────────────────────────────────────────────
      {
        capabilityId: 'skill.execute',
        name: 'Execute Skill',
        description: 'Execute a registered skill by name',
        category: 'skill',
        icon: '⚡',
        parameters: {
          type: 'object',
          properties: {
            skillName: {
              type: 'string',
              description: 'Name of the skill to execute',
            },
            args: {
              type: 'object',
              description: 'Arguments to pass to the skill',
              properties: {},
            },
          },
          required: ['skillName'],
        },
        handler: async (params) => {
          return {
            executed: true,
            skillName: params.skillName,
            result: `Skill "${params.skillName}" executed successfully`,
          }
        },
      },

      // ── System capability ────────────────────────────────────────────
      {
        capabilityId: 'system.health',
        name: 'Health Check',
        description: 'Get agent health and status information',
        category: 'system',
        icon: '💚',
        parameters: {
          type: 'object',
          properties: {},
        },
        handler: async (params) => {
          const status = agent.getStatus()
          return {
            status: 'healthy',
            uptime: status.uptime,
            capabilities: status.capabilities,
            connected: status.connected,
          }
        },
      },

      // ── Gateway capability ───────────────────────────────────────────
      {
        capabilityId: 'gateway.translate',
        name: 'Translate Text',
        description: 'Translate text to a target language',
        category: 'gateway',
        icon: '🌐',
        parameters: {
          type: 'object',
          properties: {
            text: {
              type: 'string',
              description: 'Text to translate',
            },
            targetLang: {
              type: 'string',
              description: 'Target language code',
              enum: ['en', 'zh', 'ja', 'ko', 'de', 'es', 'fr', 'pt'],
            },
          },
          required: ['text', 'targetLang'],
        },
        handler: async (params) => {
          // In a real agent, this would call a translation API
          return {
            original: params.text,
            translated: `[Translation of "${params.text}" to ${params.targetLang}]`,
            language: params.targetLang,
          }
        },
      },
    ],

    // Custom heartbeat interval (every 15 seconds)
    heartbeatInterval: 15000,

    // Invocation timeout (45 seconds)
    invocationTimeout: 45000,

    // Reconnect settings
    reconnect: {
      enabled: true,
      initialDelay: 1000,
      maxDelay: 30000,
      maxRetries: 10,
    },
  })

  // ── Event Handlers ──────────────────────────────────────────────────

  agent.on('connected', (data) => {
    console.log('✅ Multi-Tool Agent connected!')
    console.log(`   Agent ID: ${data.agentId}`)
    console.log(`   Registered ${agent.getCapabilities().length} capabilities`)
  })

  agent.on('disconnected', ({ reason }) => {
    console.log(`❌ Disconnected: ${reason}`)
  })

  agent.on('invocation', (invocation) => {
    console.log(`📩 [${invocation.capabilityId}] Invoked by ${invocation.invokedBy || 'system'}`)
  })

  agent.on('command', ({ command, params, commandId }) => {
    console.log(`📡 Command: ${command}`, params)
    if (commandId) {
      agent.acknowledgeCommand(commandId, 'received')
    }
  })

  agent.on('error', ({ message, code }) => {
    console.error(`⚠️  Error${code ? ` (${code})` : ''}: ${message}`)
  })

  agent.on('heartbeat', ({ timestamp }) => {
    // Quiet heartbeat — only log every 4th heartbeat
    if (agent.getStatus().uptime % 60 < 20) {
      console.log(`💓 Heartbeat OK at ${timestamp}`)
    }
  })

  agent.on('reconnecting', ({ attempt, delay }) => {
    console.log(`🔄 Reconnecting (attempt ${attempt}) in ${delay}ms...`)
  })

  // ── Start Agent ─────────────────────────────────────────────────────

  try {
    await agent.start()
    console.log('🚀 Multi-Tool Agent is running!')
    console.log('   Capabilities:', agent.getCapabilities().map(c => `${c.icon || '📋'} ${c.capabilityId}`).join(', '))
    console.log('   Press Ctrl+C to stop.\n')
  } catch (err) {
    console.error('Failed to start:', err.message)
    process.exit(1)
  }
}

main()
