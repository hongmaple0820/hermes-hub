/**
 * Chat Agent Example
 *
 * An agent that can participate in chat conversations through Hermes Hub.
 * It listens for chat messages and can respond using its capabilities.
 *
 * Usage:
 *   node examples/chat-agent.js
 *
 * This agent demonstrates:
 * - Chat message handling via the 'chat:message' event
 * - Sending chat messages back to conversations
 * - Chat-oriented capability registration
 */

const { HermesAgent } = require('..')

const AGENT_TOKEN = process.env.AGENT_TOKEN || 'acrp_YOUR_TOKEN_HERE'

async function main() {
  const agent = new HermesAgent({
    token: AGENT_TOKEN,
    name: 'Chat Assistant',
    version: '1.0.0',
    platform: 'chat-agent-sdk',
    capabilities: [
      {
        capabilityId: 'chat.respond',
        name: 'Chat Response',
        description: 'Respond to a chat message with a helpful reply',
        category: 'chat',
        icon: '💬',
        parameters: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'The user message to respond to',
            },
            conversationId: {
              type: 'string',
              description: 'The conversation ID context',
            },
            tone: {
              type: 'string',
              description: 'Response tone',
              enum: ['friendly', 'professional', 'casual', 'humorous'],
              default: 'friendly',
            },
          },
          required: ['message'],
        },
        uiHints: {
          timeout: 15000,
        },
        handler: async (params) => {
          const tonePrefixes = {
            friendly: 'Hey there! 😊 ',
            professional: 'Good day. ',
            casual: 'Yo! ',
            humorous: 'Haha, great question! 😄 ',
          }
          const prefix = tonePrefixes[params.tone] || tonePrefixes.friendly

          // Simple response logic — in a real agent, you'd call an LLM
          const lowerMsg = params.message.toLowerCase()

          if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('hey')) {
            return {
              text: `${prefix}Hello! I'm the Chat Assistant. How can I help you today?`,
              shouldReply: true,
            }
          }

          if (lowerMsg.includes('help')) {
            return {
              text: `${prefix}I can help you with various tasks! Just ask me anything, and I'll do my best to assist.`,
              shouldReply: true,
            }
          }

          if (lowerMsg.includes('time')) {
            return {
              text: `${prefix}The current time is ${new Date().toLocaleTimeString()}.`,
              shouldReply: true,
            }
          }

          if (lowerMsg.includes('weather')) {
            return {
              text: `${prefix}I don't have access to weather data yet, but I can help with other things!`,
              shouldReply: true,
            }
          }

          return {
            text: `${prefix}Thanks for your message! I received: "${params.message}". Let me know how I can help!`,
            shouldReply: true,
          }
        },
      },
      {
        capabilityId: 'chat.summarize',
        name: 'Summarize Conversation',
        description: 'Summarize a conversation thread',
        category: 'chat',
        icon: '📝',
        parameters: {
          type: 'object',
          properties: {
            conversationId: {
              type: 'string',
              description: 'The conversation ID to summarize',
            },
            maxLength: {
              type: 'number',
              description: 'Maximum summary length in words',
              default: 100,
            },
          },
          required: ['conversationId'],
        },
        handler: async (params) => {
          // In a real agent, fetch and summarize conversation history
          return {
            summary: `[Summary of conversation ${params.conversationId}]`,
            messageCount: 0,
            generatedAt: new Date().toISOString(),
          }
        },
      },
    ],
  })

  // ── Event Handlers ──────────────────────────────────────────────────

  agent.on('connected', (data) => {
    console.log('✅ Chat Assistant connected!')
    console.log(`   Agent ID: ${data.agentId}`)
  })

  agent.on('disconnected', ({ reason }) => {
    console.log(`❌ Disconnected: ${reason}`)
  })

  agent.on('chat:message', (data) => {
    console.log(`💬 Chat message from ${data.senderName}: ${data.content}`)
    console.log(`   Conversation: ${data.conversationId}`)

    // Auto-respond to chat messages
    // In a real agent, you might want more sophisticated logic here
    if (data.content && data.senderId !== agent.getStatus().agentId) {
      // Use the chat.respond capability to generate a response
      const cap = agent.getCapability('chat.respond')
      if (cap) {
        cap.handler({
          message: data.content,
          conversationId: data.conversationId,
          tone: 'friendly',
        }).then((result) => {
          if (result.shouldReply) {
            // Send the response back to the conversation
            agent.sendChatMessage(data.conversationId, result.text)
            console.log(`   ↳ Sent reply: ${result.text.substring(0, 50)}...`)
          }
        }).catch((err) => {
          console.error('   ↳ Failed to respond:', err.message)
        })
      }
    }
  })

  agent.on('invocation', (invocation) => {
    console.log(`📩 Invocation: ${invocation.capabilityId}`)
    // Auto-handling is enabled by default
  })

  agent.on('command', ({ command, params, commandId }) => {
    console.log(`📡 Command: ${command}`, params)
    if (commandId) {
      agent.acknowledgeCommand(commandId, 'completed', { acknowledged: true })
    }
  })

  agent.on('error', ({ message }) => {
    console.error(`⚠️  Error: ${message}`)
  })

  agent.on('reconnecting', ({ attempt, delay }) => {
    console.log(`🔄 Reconnecting (attempt ${attempt}) in ${delay}ms...`)
  })

  // ── Start Agent ─────────────────────────────────────────────────────

  try {
    await agent.start()
    console.log('🚀 Chat Assistant is running!')
    console.log('   Listening for chat messages...')
    console.log('   Press Ctrl+C to stop.\n')
  } catch (err) {
    console.error('Failed to start:', err.message)
    process.exit(1)
  }
}

main()
