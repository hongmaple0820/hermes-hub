// Code snippets for the Protocol Documentation tab

export const jsCode = `import { io } from 'socket.io-client';

const socket = io('/?XTransformPort=3004', {
  auth: {
    endpointToken: 'sk_your_endpoint_token_here'
  }
});

socket.on('connect', () => {
  console.log('Connected to Hermes Hub!');
  socket.emit('skill:register', {
    name: 'my-agent',
    version: '1.0.0',
    capabilities: ['search', 'code_generation'],
    platform: 'hermes-agent'
  });
});

socket.on('skill:invoke', (data) => {
  console.log('Tool call received:', data);
  const result = executeSkill(data.skillName, data.params);
  socket.emit('skill:invoke-response', {
    requestId: data.requestId,
    result: { response: result }
  });
});

setInterval(() => {
  socket.emit('skill:heartbeat', {
    status: 'online',
    metrics: { uptime: process.uptime() }
  });
}, 30000);

socket.emit('skill:event', {
  type: 'message',
  data: { conversationId: 'conv_xxx', content: 'Hello!' }
});

socket.on('disconnect', () => {
  console.log('Disconnected from Hermes Hub');
});`;

export const pythonCode = `import socketio

sio = socketio.SimpleClient()

@sio.on('connect')
def on_connect():
    print('Connected to Hermes Hub!')
    sio.emit('skill:register', {
        'name': 'my-agent',
        'version': '1.0.0',
        'capabilities': ['search', 'code_generation'],
        'platform': 'hermes-agent'
    })

@sio.on('skill:invoke')
def on_invoke(data):
    print(f'Tool call: {data["skillName"]}')
    result = execute_skill(data['skillName'], data['params'])
    sio.emit('skill:invoke-response', {
        'requestId': data['requestId'],
        'result': {'response': result}
    })

sio.connect('ws://localhost:3004',
    socketio_path='/',
    auth={'endpointToken': 'sk_your_token_here'})`;

export const curlCode = `# Register a skill endpoint
curl -X POST https://your-domain/api/skill-protocol/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpointToken": "sk_your_token_here",
    "agentInfo": {
      "name": "my-agent",
      "callbackUrl": "https://your-agent.com/callback",
      "capabilities": ["search"]
    }
  }'

# Send an event
curl -X POST https://your-domain/api/skill-protocol/events \\
  -H "Authorization: Bearer sk_your_token_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event": {
      "type": "message",
      "data": {"text": "Hello from external agent"}
    }
  }'

# Send heartbeat
curl -X POST https://your-domain/api/skill-protocol/heartbeat \\
  -H "Content-Type: application/json" \\
  -d '{
    "endpointToken": "sk_your_token_here",
    "status": "alive"
  }'`;

export const eventTypes = [
  { event: 'skill:register', dir: 'agent-to-hub', desc: 'Register agent capabilities after connecting' },
  { event: 'skill:registered', dir: 'hub-to-agent', desc: 'Registration confirmed with assigned agent ID' },
  { event: 'skill:heartbeat', dir: 'agent-to-hub', desc: 'Send heartbeat to maintain connection (every 30s)' },
  { event: 'skill:heartbeat-ack', dir: 'hub-to-agent', desc: 'Heartbeat acknowledged with server time' },
  { event: 'skill:invoke', dir: 'hub-to-agent', desc: 'Tool call from LLM — agent should process and respond' },
  { event: 'skill:invoke-response', dir: 'agent-to-hub', desc: 'Tool result response back to the hub' },
  { event: 'skill:event', dir: 'agent-to-hub', desc: 'General event (message, status update, proactive msg)' },
  { event: 'skill:event-ack', dir: 'hub-to-agent', desc: 'Event acknowledged with event ID' },
  { event: 'skill:notification', dir: 'hub-to-agent', desc: 'Notification from hub (config update, system msg)' },
];

export const skillMdFormat = `---
name: my-skill
description: A brief description of what this skill does
license: MIT
compatibility: Node.js >= 18
metadata:
  author: Your Name
  version: 1.0.0
  tags: search,web,api
allowedTools: web_search http_request file_read
---

# My Skill Instructions

This is the main body of the skill instructions.
It uses Markdown formatting and will be provided
to the agent as the skill's system prompt.

## Guidelines
- Always verify search results
- Return structured data when possible
- Handle errors gracefully
`;

export const directoryStructure = `.agents/
  skills/
    web-search/
      SKILL.md
    code-generator/
      SKILL.md
    data-analyzer/
      SKILL.md
`;

export const authCode = `// Socket.IO authentication
const socket = io('/?XTransformPort=3004', {
  auth: {
    endpointToken: 'sk_your_endpoint_token_here'
  }
});

// The token is validated on connection.
// Invalid tokens will be rejected with a connect_error event.

socket.on('connect_error', (err) => {
  console.error('Connection failed:', err.message);
});`;

export const heartbeatCode = `// Send heartbeat every 30 seconds
setInterval(() => {
  socket.emit('skill:heartbeat', {
    status: 'online',
    metrics: {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage().heapUsed
    }
  });
}, 30000);

// Receive heartbeat acknowledgement
socket.on('skill:heartbeat-ack', (data) => {
  console.log('Heartbeat acknowledged:', data.serverTime);
});`;

export const frontmatterSchema = [
  { field: 'name', type: 'string', required: 'Yes', desc: 'Unique skill identifier' },
  { field: 'description', type: 'string', required: 'Yes', desc: 'Brief skill description' },
  { field: 'license', type: 'string', required: 'No', desc: 'License identifier (MIT, Apache-2.0, etc.)' },
  { field: 'compatibility', type: 'string', required: 'No', desc: 'Runtime requirements' },
  { field: 'metadata', type: 'object', required: 'No', desc: 'Author, version, tags, etc.' },
  { field: 'allowedTools', type: 'string', required: 'No', desc: 'Space-delimited list of pre-approved tools' },
];
