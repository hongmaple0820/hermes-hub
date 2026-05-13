# Task ID: 2 - Agent: main

## Task: Create Skill WebSocket Service (skill-ws)

### Summary
Created the dedicated Socket.IO WebSocket server for the Skill Plugin Protocol on port 3004. This enables external agents (hermes-agent, openclaw, etc.) to connect via WebSocket using an endpoint token for real-time bidirectional communication with the hub.

### Files Created
- `/home/z/my-project/mini-services/skill-ws/package.json` — Service package config with socket.io dependency
- `/home/z/my-project/mini-services/skill-ws/index.ts` — Main server with Socket.IO, authentication, event handlers, internal HTTP API
- `/home/z/my-project/src/app/api/skill-protocol/validate/route.ts` — GET endpoint to validate endpoint tokens for WS auth
- `/home/z/my-project/src/app/api/skill-protocol/ws-status/route.ts` — POST endpoint to update WS connection status in DB

### Architecture
```
External Agent → WebSocket → skill-ws (port 3004) ↔ Next.js API/DB
                                    ↕
                              chat-service (port 3003)
                                    ↕
                              Frontend (user chat)
```

### Key Features
- Endpoint token authentication on WebSocket connect
- Connected agents tracking with heartbeat monitoring
- Agent → Server events: register, heartbeat, event (message/tool_result/status/command), invoke-response
- Server → Agent events: invoke, notification
- Internal HTTP API for chat-service integration
- Pending tool call queue with 30s timeout
- Stale heartbeat cleanup (90s threshold)
- Proper Socket.IO + HTTP coexistence (prepend handler pattern)

### Testing
- Health check: ✅
- Internal status: ✅
- Internal agents list: ✅
- Internal invoke (agent not connected): ✅
- Internal notify (no agents): ✅
- Lint check: ✅

### Notes
- Service runs on port 3004
- Will be auto-started by /start.sh on system boot (in mini-services directory)
- For manual start: `cd /home/z/my-project/mini-services/skill-ws && bun run dev`
