# @hermes-hub/agent-sdk

Official SDK for building agents that connect to [Hermes Hub](https://github.com/hongmaple0820/hermes-hub) via the ACRP (Agent Capability Registration Protocol).

## Installation

```bash
npm install @hermes-hub/agent-sdk
# or
bun add @hermes-hub/agent-sdk
```

## Quick Start

```javascript
const { HermesAgent } = require('@hermes-hub/agent-sdk');

const agent = new HermesAgent({
  token: 'acrp_xxxxx',  // Get from Hermes Hub → Agent Control Center
  name: 'My Agent',
  capabilities: [
    {
      capabilityId: 'greet',
      name: 'Greeting',
      description: 'Send a greeting message',
      category: 'chat',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name to greet' }
        },
        required: ['name']
      },
      handler: async (params) => {
        return { result: `Hello, ${params.name}! 👋` };
      }
    }
  ]
});

agent.on('connected', () => console.log('✅ Connected!'));
agent.on('disconnected', () => console.log('❌ Disconnected'));

await agent.start();
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `token` | `string` | **required** | Agent token from Hermes Hub |
| `name` | `string` | `'Unnamed Agent'` | Agent display name |
| `version` | `string` | `'1.0.0'` | Agent version |
| `platform` | `string` | `'hermes-agent-sdk'` | Platform identifier |
| `capabilities` | `Capability[]` | `[]` | List of capabilities |
| `wsUrl` | `string` | `'http://localhost:3004'` | WebSocket server URL |
| `heartbeatInterval` | `number` | `15000` | Heartbeat interval (ms) |
| `invocationTimeout` | `number` | `30000` | Default handler timeout (ms) |
| `autoRegister` | `boolean` | `true` | Auto-register on connect |
| `autoHandleInvocations` | `boolean` | `true` | Auto-handle invocations |
| `reconnect.enabled` | `boolean` | `true` | Enable auto-reconnect |
| `reconnect.initialDelay` | `number` | `1000` | Initial reconnect delay (ms) |
| `reconnect.maxDelay` | `number` | `30000` | Max reconnect delay (ms) |
| `reconnect.maxRetries` | `number` | `10` | Max reconnect attempts |
| `metadata` | `object` | `{}` | Additional registration metadata |

## Events

| Event | Data | Description |
|-------|------|-------------|
| `connected` | `{ agentId, agentName, message }` | Connected and registered |
| `disconnected` | `{ reason }` | Disconnected from hub |
| `invocation` | `{ invocationId, capabilityId, parameters, handle() }` | Capability invoked |
| `command` | `{ command, params, commandId }` | Command from hub |
| `error` | `{ message, code }` | Error occurred |
| `heartbeat` | `{ timestamp, nextInterval }` | Heartbeat acknowledged |
| `reconnecting` | `{ attempt, delay }` | Reconnecting attempt |
| `chat:message` | `{ conversationId, content, senderId, senderName }` | Chat message received |

## Capabilities

Each capability defines what your agent can do:

```javascript
{
  capabilityId: 'my.capability',    // Unique ID
  name: 'My Capability',            // Display name
  description: 'What it does',      // Description
  category: 'chat',                 // Category
  icon: '💬',                       // Optional icon
  parameters: {                     // JSON Schema
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input text' }
    },
    required: ['input']
  },
  handler: async (params) => {      // Handler function
    return { result: 'Done!' };
  },
  uiHints: {                        // Optional UI hints
    confirmRequired: false,
    timeout: 30000
  }
}
```

### Categories

- `model` — LLM model operations
- `skill` — Skill execution
- `soul` — Personality management
- `memory` — Memory/context operations
- `gateway` — External integrations
- `chat` — Chat/conversation handling
- `system` — System operations
- `general` — General purpose

## API Methods

### `agent.start()`
Connect to Hermes Hub, register capabilities, start heartbeat.

### `agent.stop()`
Disconnect gracefully from Hermes Hub.

### `agent.sendResult(invocationId, result, success?)`
Send a capability result back to the hub.

### `agent.addCapability(capability)`
Add a capability (re-registers if connected).

### `agent.removeCapability(capabilityId)`
Remove a capability by ID.

### `agent.getStatus()`
Get current agent status.

### `agent.sendStatus(status, metrics?)`
Send a status update.

### `agent.sendEvent(type, data)`
Send a custom event.

### `agent.sendChatMessage(conversationId, content, senderName?)`
Send a chat message to a conversation.

### `agent.acknowledgeCommand(commandId, status, result?, error?)`
Acknowledge a command from the hub.

## Examples

See the `examples/` directory:

- **simple-agent.js** — Minimal single-capability agent
- **multi-capability-agent.js** — Agent with 6 capabilities
- **chat-agent.js** — Agent that participates in chat
- **hermes.config.js** — Example configuration file

## Architecture

```
┌──────────────────┐     Socket.IO      ┌──────────────────┐
│   Your Agent     │ ◄──────────────► │   Hermes Hub     │
│  (agent-sdk)     │    port 3004      │   (skill-ws)     │
│                  │                   │                  │
│  ┌────────────┐  │                   │  ┌────────────┐  │
│  │ Capability │  │  acrp:connect     │  │ ACRP       │  │
│  │ Handlers   │  │  acrp:register    │  │ Protocol   │  │
│  │            │  │  capability:invoke│  │ Handler    │  │
│  └────────────┘  │  capability:result│  └────────────┘  │
│                  │  heartbeat        │                  │
└──────────────────┘                   └──────────────────┘
                                              │
                                              ▼
                                       ┌──────────────┐
                                       │  Next.js API  │
                                       │  + Database   │
                                       └──────────────┘
```

## License

MIT
