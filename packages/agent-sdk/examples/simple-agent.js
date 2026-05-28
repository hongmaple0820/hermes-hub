/**
 * Simple Agent Example
 *
 * A minimal agent that connects to Hermes Hub with a single "greet" capability.
 *
 * Usage:
 *   node examples/simple-agent.js
 *
 * Make sure to set AGENT_TOKEN to your actual token from:
 *   Hermes Hub → Agent Control Center → Generate Token
 */

const { HermesAgent } = require('..')

// Read token from environment or use a placeholder
const AGENT_TOKEN = process.env.AGENT_TOKEN || 'acrp_YOUR_TOKEN_HERE'

async function main() {
  const agent = new HermesAgent({
    token: AGENT_TOKEN,
    name: 'Simple Greeter',
    capabilities: [
      {
        capabilityId: 'greet',
        name: 'Greeting',
        description: 'Send a friendly greeting message',
        category: 'chat',
        parameters: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the person to greet',
            },
          },
          required: ['name'],
        },
        handler: async (params) => {
          return {
            message: `Hello, ${params.name}! 👋 Welcome to Hermes Hub!`,
            timestamp: new Date().toISOString(),
          }
        },
      },
    ],
  })

  // Event handlers
  agent.on('connected', (data) => {
    console.log('✅ Connected to Hermes Hub!')
    console.log(`   Agent ID: ${data.agentId}`)
    console.log(`   Agent Name: ${data.agentName}`)
  })

  agent.on('disconnected', (data) => {
    console.log(`❌ Disconnected: ${data.reason}`)
  })

  agent.on('invocation', async (invocation) => {
    console.log(`📩 Invocation: ${invocation.capabilityId}`)
    console.log(`   Parameters:`, invocation.parameters)
    // Auto-handling is enabled by default, so no need to call invocation.handle()
  })

  agent.on('error', (data) => {
    console.error(`⚠️  Error: ${data.message}`)
  })

  agent.on('heartbeat', (data) => {
    console.log(`💓 Heartbeat acknowledged at ${data.timestamp}`)
  })

  agent.on('reconnecting', (data) => {
    console.log(`🔄 Reconnecting... attempt ${data.attempt} in ${data.delay}ms`)
  })

  try {
    await agent.start()
    console.log('🚀 Agent is running. Press Ctrl+C to stop.')

    // Print status every 30 seconds
    setInterval(() => {
      const status = agent.getStatus()
      console.log(`📊 Status: connected=${status.connected}, uptime=${status.uptime}s, capabilities=${status.capabilities.join(',')}`)
    }, 30000)
  } catch (err) {
    console.error('Failed to start agent:', err.message)
    process.exit(1)
  }
}

main()
