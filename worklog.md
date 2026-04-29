# Hermes Hub Worklog

---
Task ID: 1
Agent: main
Task: Build Skill Plugin Protocol - Database Schema & Backend APIs

Work Log:
- Updated Prisma schema with Skill Protocol fields:
  - Skill: endpointToken, callbackUrl, callbackSecret, protocolVersion, events, registeredAt, lastHeartbeat, registrationInfo
  - AgentSkill: endpointToken, callbackUrl, callbackSecret, lastInvokedAt, invokeCount
  - AgentPlugin: endpointToken, callbackUrl, callbackSecret, protocolVersion, events, registeredAt, lastHeartbeat, registrationInfo
  - AgentConnection: endpointToken, protocolVersion, heartbeatInterval, registeredAt, registrationInfo
- Ran `bun run db:push` to apply schema changes
- Created `/home/z/my-project/src/lib/skill-protocol.ts` — Core protocol library:
  - generateEndpointToken(), generateCallbackSecret()
  - signPayload(), verifySignature() — HMAC-SHA256
  - findBindingByToken() — Lookup by endpointToken across AgentSkill/Plugin/Connection
  - sendCallback() — Send outbound events to external agent callback URLs
  - registerExternalAgent() — Process registration requests
  - processHeartbeat() — Handle heartbeat events
  - processInboundEvent() — Process inbound events (message, command, status, tool_result)
  - buildToolDefinitionsForAgent() — Build OpenAI tool definitions from skills
  - invokeSkill() — Invoke a skill during chat (builtin/webhook/function)
  - checkStaleHeartbeats() — Mark connections as disconnected
- Created API routes:
  - POST /api/skill-protocol/register — Register external agent
  - POST /api/skill-protocol/heartbeat — Process heartbeat
  - POST /api/skill-protocol/events — Receive inbound events
  - POST /api/skill-protocol/generate-endpoint — Generate endpoint URL
  - POST /api/agents/[id]/generate-skill-endpoint — Generate skill/plugin endpoint
- Updated /api/agents/[id]/skills/[skillId]/route.ts — Support callbackUrl and callbackSecret updates
- Updated /api/skills/[id]/install/route.ts — Already auto-generates endpointToken on install

Stage Summary:
- Skill Plugin Protocol backend fully implemented
- Endpoints follow Feishu/DingTalk bot platform pattern
- Each skill+agent binding gets unique endpointToken and callbackSecret
- External agents can register, send events, and maintain heartbeats
- Skills are invoked during chat as LLM tools (function calling)

---
Task ID: 4
Agent: SkillMarketplaceBuilder
Task: Redesign SkillMarketplace as Feishu/DingTalk-style bot management platform

Work Log:
- Complete rewrite of SkillMarketplace.tsx with 3-tab layout:
  - Tab 1 (Skill Store): Improved grid with handlerType badges, installed indicators, skill detail dialog
  - Tab 2 (My Skills): Full endpoint lifecycle management grouped by agent
  - Tab 3 (Protocol Docs): Registration flow, event types, JSON schemas, auth, heartbeat, code examples
- Added sub-components: StatusDot, CopyButton, MonospaceField
- Added dialog components: Generate Endpoint, Skill Detail, Skill Config
- Added 4 new API methods to api-client.ts
- Added skillProtocol namespace with 70+ keys to all 8 i18n locales

Stage Summary:
- SkillMarketplace completely redesigned with protocol management
- Users can generate endpoints, configure callbacks, share registration links
- Protocol documentation built into the UI with code examples

---
Task ID: 5
Agent: AgentDetailBuilder
Task: Redesign AgentDetail with Skill Protocol support

Work Log:
- Complete rewrite of AgentDetail.tsx with 5-tab layout:
  - Overview: Config, system prompt, API key, connection status, custom API callback explanation
  - Skills: Enable/disable toggle (functional), priority reorder, endpoint section (collapsible), callback URL editor, test connection, configure skill JSON, generate endpoint
  - Connections: Status badge, endpoint token, heartbeat interval, registration info, test connection, delete
  - Plugins: Enable/disable toggle (functional), endpoint URL, callback URL, registration info, configure, delete
  - Integration: Quick start guide (5 steps), API credentials, registration link, connection diagram
- All toggles now call the API and refresh agent data
- Priority reorder with up/down arrows
- Config editing dialog for skills and plugins
- Callback URL inline editing with save

Stage Summary:
- AgentDetail fully supports Skill Plugin Protocol
- Skills can be enabled/disabled, reordered, configured
- Endpoint URLs and callback URLs can be generated and configured
- Integration tab provides step-by-step guide for external agents

---
Task ID: 6
Agent: main
Task: Update Chat Service to integrate Skill invocation

Work Log:
- Updated AgentConfig interface to include skills array (AgentSkillConfig)
- Updated handleBuiltinAgent to:
  - Build tool definitions from enabled skills
  - Pass tools array to LLM API (function calling)
  - Parse tool_calls from streaming response
  - Invoke matching skills when LLM decides to call them
  - Stream skill results back to the chat
- Updated handleCustomApiAgent to:
  - Include skills array in the callback payload
  - Provide better error message when callback URL not configured
- Skills are invoked via their callbackUrl/handlerUrl when LLM calls them as tools

Stage Summary:
- Chat service now supports skill execution during agent replies
- LLM can call skills as function tools
- Skill results are streamed back to the user in chat
- External agents receive skill information in custom API callbacks

---
Task ID: overall
Agent: main
Task: Skill Plugin Protocol - Full Implementation Summary

Stage Summary:
- **Problem solved**: Skills were decorative — could install/uninstall but never executed
- **Core architecture**: Each skill+agent binding now generates a unique endpoint URL and token
- **Registration flow**: External agents (hermes-agent, openclaw) can register via endpoint URL
- **Callback mechanism**: Bidirectional communication — inbound events (external→system) + outbound callbacks (system→external)
- **Heartbeat monitoring**: External agents send heartbeats, system tracks connection status
- **Chat integration**: Skills are injected as LLM tools, invoked when LLM decides to call them
- **UI overhaul**: Both SkillMarketplace and AgentDetail fully redesigned with protocol management
- **Protocol documentation**: Built into UI with code examples (curl, Python, JavaScript)
- **What "callback" means now**: The callback URL is where OUR system sends outbound events to the external agent. The endpoint URL is where external agents send events TO our system. This is bidirectional.

---
Task ID: 2
Agent: main
Task: Create Skill WebSocket Service (skill-ws) — Dedicated Socket.IO Server for Skill Plugin Protocol

Work Log:
- Created `/home/z/my-project/mini-services/skill-ws/package.json` with socket.io dependency
- Created `/home/z/my-project/mini-services/skill-ws/index.ts` — Full Socket.IO WebSocket server on port 3004:
  - Authentication middleware: Validates endpointToken via Next.js API on socket connect
  - Connected agents tracking: Map<agentId:skillId, ConnectedAgent> with socketId, binding info, heartbeat
  - Event handlers (agent → server):
    - `skill:register` — Register agent capabilities, update DB, emit `skill:registered`
    - `skill:heartbeat` — Update lastHeartbeat, forward to DB, emit `skill:heartbeat-ack`
    - `skill:event` — Process message/tool_result/status/command events, emit `skill:event-ack`
    - `skill:invoke-response` — Resolve pending tool call promises
  - Server → agent events:
    - `skill:invoke` — Sent when chat-service needs to invoke a skill
    - `skill:notification` — General notifications
  - Internal HTTP API (for chat-service to call):
    - `POST /internal/invoke` — Trigger skill invocation on connected agent (with optional wait-for-response)
    - `GET /internal/status` — Check agent connection status
    - `POST /internal/notify` — Send notification to connected agent
    - `GET /internal/agents` — List all connected agents
  - Disconnect handling: Update DB to 'disconnected', clean up tracking
  - Pending tool call queue: Map<requestId, Promise> with 30s timeout
  - Stale heartbeat cleanup: Every 30s, disconnect agents with >90s since last heartbeat
  - Socket.IO config: path `/`, CORS `*`, pingTimeout 60s, pingInterval 25s
  - HTTP request handler prepended before Socket.IO to handle /internal/* and /health paths
- Created `/home/z/my-project/src/app/api/skill-protocol/validate/route.ts`:
  - GET endpoint to validate endpoint tokens for WebSocket authentication
  - Returns binding info (agentId, bindingType, skillId/pluginId, isEnabled)
- Created `/home/z/my-project/src/app/api/skill-protocol/ws-status/route.ts`:
  - POST endpoint to update WebSocket connection status (connected/disconnected)
  - Updates AgentSkill/AgentPlugin/AgentConnection records and agent status
- Installed dependencies and verified service starts correctly
- All internal API endpoints tested and working:
  - Health check, status, agents list, invoke (not connected), notify
- Lint check passes clean

Stage Summary:
- skill-ws service provides pure WebSocket Skill Plugin communication channel
- External agents connect via Socket.IO with endpointToken authentication
- Bidirectional real-time communication: agents receive tool_call invocations and send tool_result responses
- chat-service can invoke skills on connected agents via HTTP internal API
- Automatic heartbeat monitoring and stale connection cleanup
- Service will be auto-started by /start.sh on system boot (in mini-services directory)

---
Task ID: 4
Agent: ChatServiceUpdater
Task: Update chat-service to integrate with skill-ws WebSocket service for skill invocation

Work Log:
- Updated `handleBuiltinAgent` in `/home/z/my-project/mini-services/chat-service/index.ts`
- Replaced the direct HTTP callback skill invocation block with WS-first, HTTP-fallback logic:
  - Added SKILL_WS_URL env variable support (defaults to http://localhost:3004)
  - Before invoking a skill, checks if the agent is connected via WebSocket by calling `GET /internal/status` on skill-ws
  - If connected (wsConnected === true), invokes skill via `POST /internal/invoke?wait=true` on skill-ws with a 30s timeout
  - If not connected, falls back to HTTP POST to callbackUrl/handlerUrl (existing behavior)
  - Updated error message for no-URL case to also mention WebSocket unavailability
  - Gracefully handles skill-ws service being down (catch block sets wsConnected = false, falls through to HTTP)
- No changes to handleCustomApiAgent or handleHermesAgent

Stage Summary:
- chat-service now supports dual invocation path: WebSocket (priority) → HTTP callback (fallback)
- External agents connected via skill-ws Socket.IO can receive real-time tool_call invocations
- HTTP-only agents continue to work unchanged via callbackUrl/handlerUrl

---
Task ID: 3
Agent: WsSchemaUpdater
Task: Update Prisma schema and API routes to support pure WebSocket Skill Plugin connection mode

Work Log:
- Updated Prisma schema (`prisma/schema.prisma`) with WebSocket connection mode fields:
  - AgentConnection: added `connectionMode String @default("websocket")`, `wsConnected Boolean @default(false)`, `wsSocketId String?`
  - Skill: added `connectionMode String @default("websocket")`, `wsConnected Boolean @default(false)`
  - AgentSkill: added `wsConnected Boolean @default(false)`
- Ran `bun run db:push` to apply schema changes
- Updated `/api/skill-protocol/generate-endpoint/route.ts`:
  - Added `connectionMode: 'websocket'`, `wsConnectUrl: '/?XTransformPort=3004'`, `wsDirectUrl: 'ws://localhost:3004/'` to both skill and plugin responses
  - These fields allow frontends to construct proper WebSocket connection URLs
- Updated `/api/agents/[id]/generate-skill-endpoint/route.ts`:
  - Same WS connection info added: `connectionMode`, `wsConnectUrl`, `wsDirectUrl`
- Created `/api/skill-protocol/connection-info/route.ts`:
  - GET endpoint accepting `agentId` and `skillId` query params
  - Returns endpointToken, callbackUrl, callbackSecret, wsConnected, wsStatus (live from skill-ws service), wsConnectUrl, connectionMode
  - Queries skill-ws `/internal/status` for real-time WebSocket connection status
- Verified `/api/skill-protocol/validate/route.ts` exists and works correctly (created by Task 2)
- Verified `/api/skill-protocol/ws-status/route.ts` exists and works correctly (created by Task 2)
- Lint check passes clean

Stage Summary:
- Prisma schema now tracks WebSocket connection state per binding (connectionMode, wsConnected, wsSocketId)
- All endpoint generation APIs return WebSocket connection details alongside HTTP info
- New connection-info API provides real-time WS status for any agent+skill binding

---
Task ID: 6
Agent: SkillMarketplaceRewriter
Task: Completely rewrite SkillMarketplace component to support pure WebSocket Skill Plugin connection mode

Work Log:
- Updated `/home/z/my-project/src/lib/api-client.ts`:
  - Added `getSkillConnectionInfo(agentId, skillId)` — Returns endpointToken, callbackUrl, callbackSecret, wsStatus (connected, lastHeartbeat, socketId), wsConnectUrl, connectionMode
  - Added `regenerateSkillEndpoint(agentId, skillId)` — Regenerates endpoint with new token, returns wsConnectUrl, wsDirectUrl, connectionMode
  - Updated `generateSkillEndpoint()` return type to include wsConnectUrl, wsDirectUrl, connectionMode
- Complete rewrite of `/home/z/my-project/src/components/views/SkillMarketplace.tsx`:
  - Tab 1 (Skill Store): Improved grid with handlerType badges (added websocket type), installed indicators, skill detail dialog
  - Tab 2 (My Skills) — MAJOR REDESIGN:
    - Connection Mode selector dropdown (WebSocket / HTTP Callback / Hybrid)
    - WebSocket Section (PRIMARY, shown by default):
      - Connection URL (wsConnectUrl for Caddy gateway)
      - Direct URL (ws://localhost:3004/)
      - Endpoint Token (masked monospace field)
      - Quick Connect Link (shareable URL + token combo with one-click copy)
      - Real-time Connection Status (green pulsing dot for connected, gray for disconnected) with last heartbeat time and socket ID
      - Auto-refresh connection status every 15 seconds
      - Generate/Regenerate Endpoint buttons
    - HTTP Callback Section (SECONDARY, collapsed by default):
      - Collapsible panel with callback URL, events selector, callback secret
    - Controls: Enable/disable toggle, priority input, test connection, configure skill, uninstall
  - Tab 3 (Protocol Docs) — REDESIGNED for WebSocket:
    - Quick Start: 4-step guide (install, generate token, connect WS, register)
    - Protocol Info Cards: version 2.0.0, 30s heartbeat, WebSocket transport
    - WebSocket Connection Guide: Code examples in JavaScript (socket.io-client), Python (python-socketio), HTTP API (fallback curl)
    - Event Types Table: 9 events with direction (Agent→Hub, Hub→Agent) and descriptions
    - Supported Platforms: hermes-agent (Python), openclaw (open source), Custom (any WS client)
    - Authentication section with Socket.IO auth example
    - Heartbeat Protocol section with code example
    - Message Format section with skill:invoke, skill:invoke-response, skill:event examples
  - Added new sub-components: StatusDot with pulse animation, ConnectionInfo type
  - Added new imports: Wifi, WifiOff, Radio, Server, Cable, Globe
  - Added new handlerType color: websocket (emerald)
- Added 22 new i18n keys to all 8 locale files (en, zh, ja, ko, de, es, fr, pt):
  - wsRegistering, wsError, connectionModeUpdated, testingWs
  - endpointRegenerated, endpointGeneratedDesc, connectLinkCopied
  - refreshStatus, transport, wsConnectionGuide, wsConnectionGuideDesc
  - eventTypesDesc, authDesc, heartbeatProtocol, messageFormat
  - quickStartDesc, quickStartStep1-4, copyUrl, httpCallback
- Lint check passes clean

Stage Summary:
- SkillMarketplace completely redesigned with WebSocket-first connection mode
- Users can browse/install skills, generate WebSocket connection links, and monitor real-time connection status
- Protocol Docs now shows Socket.IO code examples (JS, Python) instead of HTTP-only examples
- My Skills tab provides Feishu/DingTalk-style bot management with connection mode selection
- All 8 i18n locales updated with new WebSocket-related translation keys
- Frontend can use wsConnectUrl (for Caddy gateway) or wsDirectUrl (direct) to connect external agents

---
Task ID: 7
Agent: I18nUpdater
Task: Update all i18n translation files to add new keys for WebSocket Skill Plugin system

Work Log:
- Added 50+ new keys under `skillProtocol` namespace to all 8 locale files (en, zh, ja, ko, fr, de, es, pt)
- New keys cover WebSocket connection mode, connection URLs, platform types, quick start steps, event direction, live status, connection guide, and more
- Key categories added:
  - Connection mode: connectionMode, websocketMode, httpCallbackMode, hybridMode
  - WebSocket URLs: wsConnectUrl, wsDirectUrl, wsGatewayUrl
  - Quick connect: quickConnectLink, copyConnectLink, connectionLinkCopied
  - Connection status: wsConnected, wsDisconnected, wsConnecting
  - Agent platform: agentPlatform, platformHermesAgent, platformOpenClaw, platformCustom
  - Quick start steps: step1Install, step2Generate, step3Connect, step4Register (with descriptions)
  - Code examples: codeExampleJS, codeExamplePython, codeExampleCurl
  - Event info: eventDirection, eventDescription, directionAgentToHub, directionHubToAgent
  - Sections: wsSection, httpSection
  - Endpoint management: noEndpointYet, generateToConnect, regenerateEndpoint, regenerateConfirm
  - Live status: wsStatusLive, lastHeartbeatAgo, connectedVia, agentVersion
  - Testing: testWsConnection, wsTestSent, wsTestFailed
  - Connection guide: connectionGuide, viewConnectionGuide, closeConnectionGuide
- Fixed JSON validity issues:
  - de.json: Replaced German-style quotes („") with single quotes to avoid JSON parsing errors
  - zh.json: Replaced Chinese quotes ("") with corner brackets (「」) to avoid JSON parsing errors
- All 8 locale files validated as valid JSON
- Lint check passes clean

Stage Summary:
- All 8 i18n locale files updated with 50+ new WebSocket Skill Plugin keys
- Translations provided for en, zh, ja, ko, fr, de, es, pt
- JSON validity verified for all files
- Existing keys preserved — only new keys added under skillProtocol namespace

---
Task ID: WS-Integration-Final
Agent: main
Task: Complete WebSocket Skill Plugin System - Integration, Testing, and Verification

Work Log:
- Verified all 3 services running: Next.js (3000), chat-service (3003), skill-ws (3004)
- Tested API endpoints:
  - GET /api/skills — returns 12 skills with connectionMode: "websocket" and wsConnected fields
  - POST /api/skills/[id]/install — installs skill with auto-generated endpointToken and callbackSecret
  - POST /api/agents/[id]/generate-skill-endpoint — returns endpointToken, wsConnectUrl, wsDirectUrl, connectionMode
  - GET /api/skill-protocol/validate?token=xxx — validates endpoint tokens for WS auth
  - GET /api/skill-protocol/connection-info — returns real-time WS status from skill-ws service
  - POST /api/skill-protocol/ws-status — updates WS connection status in DB
  - GET /api/skill-protocol/validate — validated tokens for WS authentication
- Tested skill-ws service:
  - Health check: /health returns status, connectedAgents count, uptime
  - Internal API: /internal/status, /internal/agents, /internal/invoke all functional
  - Socket.IO server ready on port 3004
- All services verified working and passing lint checks

Stage Summary:
- **Complete WebSocket Skill Plugin System implemented** — the core feature the user originally requested
- External agents (hermes-agent, openclaw, etc.) can now connect via pure WebSocket:
  1. User installs a skill to an agent → gets endpointToken automatically
  2. User generates/refreshes endpoint → gets wsConnectUrl and wsDirectUrl
  3. External agent connects via Socket.IO with endpointToken auth
  4. Agent registers with capabilities, maintains heartbeat
  5. When LLM calls a skill, chat-service checks WS first, falls back to HTTP
  6. Bidirectional real-time communication: tool_call → tool_result, events, notifications
- **No HTTP callback server needed** — agents only need a Socket.IO client
- **Like Feishu/DingTalk bot WebSocket mode** — persistent connection, auto-heartbeat, real-time events
- **Graceful degradation** — if WS not connected, falls back to HTTP callback
- **Service architecture**:
  - Next.js (3000): Main app + APIs + DB
  - chat-service (3003): Socket.IO chat + LLM streaming + skill invocation (WS-first, HTTP-fallback)
  - skill-ws (3004): Socket.IO for external agent WS connections + internal HTTP API

---
Task ID: ACRP-1
Agent: main
Task: Design & implement Agent Capability Registration Protocol (ACRP)

Work Log:
- Updated Prisma schema with ACRP fields on Agent model: agentToken, agentType, agentVersion, agentPlatform, agentMetadata, wsConnected, lastHeartbeatAt, registeredAt
- Created AgentCapability model: capabilityId, name, description, category, parameters (JSON Schema), uiHints, isEnabled, invokeCount
- Created CapabilityInvocation model: capabilityId, invokedBy, params, result, status (pending/sent/executing/success/failed/timeout), error, duration
- Ran db:push to apply schema changes
- Evolved skill-ws service with dual authentication: endpointToken (legacy) + agentToken (ACRP)
- Added ACRP event handlers: agent:register, agent:heartbeat, agent:status, agent:event, capability:result
- Added Hub→Agent events: capability:invoke, agent:command, agent:notification
- Added internal HTTP APIs: /internal/acrp-invoke (with 60s timeout), /internal/acrp-status, /internal/acrp-notify
- Created 12 ACRP API routes under /api/acrp/: generate-token, validate-token, register, heartbeat, disconnect, status, agents, agents/[id], agents/[id]/invoke, agents/[id]/command, agents/[id]/token, invocation-result, invocations
- Built AgentControlCenter.tsx (1342 lines) with 3 tabs: Connected Agents, Remote Control, Setup Guide
- Updated api-client.ts with 7 ACRP methods
- Added 46 i18n keys across all 8 locales (en, zh, ja, ko, de, es, fr, pt)
- Updated Sidebar with Monitor icon + agent-control view
- Updated page.tsx to render AgentControlCenter
- Added 'agent-control' to ViewMode in store
- All lint checks pass clean
- All API endpoints tested and working
- Pushed to remote: github.com/hongmaple0820/hermes-hub main

Stage Summary:
- **ACRP (Agent Capability Registration Protocol) fully implemented**
- External agents (hermes-agent, openclaw, claude-code, codex, trae) can now:
  1. Generate a connection token from the Hub UI
  2. Connect via WebSocket using agentToken authentication
  3. Self-register their capabilities (model.switch, skill.install, soul.configure, etc.)
  4. Maintain heartbeat for connection health monitoring
  5. Receive capability invocations from the Hub
  6. Return results asynchronously
- **Hub users can now**:
  1. See all connected ACRP agents with live status
  2. Remotely invoke any registered capability
  3. Send commands (restart, reload_config, update_skills)
  4. View invocation history with status tracking
  5. Revoke tokens to disconnect agents
- **Architecture**: Skill-ws dual auth (endpointToken + agentToken), separate ACRP agent tracking
- **Supported agent types**: hermes-agent, openclaw, claude-code, codex, trae, custom

---
Task ID: 2-b
Agent: AcrpApiBuilder
Task: Create ACRP (Agent Capability Registration Protocol) API routes

Work Log:
- Created 12 API route files under `/home/z/my-project/src/app/api/acrp/`:
  1. `POST /api/acrp/generate-token/route.ts` — Generate ACRP connection token (acrp_ prefixed UUID), update Agent.agentToken and registeredAt, return wsConnectUrl + wsDirectUrl
  2. `GET /api/acrp/validate-token/route.ts` — Validate agentToken for skill-ws auth, returns agentId, name, agentType
  3. `POST /api/acrp/register/route.ts` — Register agent capabilities (upsert by agentId+capabilityId), update agent info (type, version, platform, metadata), prune stale capabilities, set wsConnected=true and status=online
  4. `POST /api/acrp/heartbeat/route.ts` — Update agent heartbeat (lastHeartbeatAt, wsConnected, status), merge metrics into agentMetadata
  5. `POST /api/acrp/disconnect/route.ts` — Mark agent as disconnected (wsConnected=false, status=offline)
  6. `GET /api/acrp/agents/route.ts` — List all ACRP-enabled agents for a userId with capabilities, recent 5 invocations, and live status from skill-ws
  7. `GET /api/acrp/agents/[id]/route.ts` — Get single agent details with capabilities (ordered by category, uiHints), recent 20 invocations, and live status from skill-ws
  8. `POST /api/acrp/agents/[id]/invoke/route.ts` — Invoke a capability on an agent (requires x-user-id header), creates CapabilityInvocation record, sends via skill-ws /internal/acrp-invoke
  9. `POST /api/acrp/invocation-result/route.ts` — Update invocation result (called by skill-ws), sets result/error/duration/completedAt, increments capability invokeCount
  10. `GET /api/acrp/invocations/route.ts` — List invocation history with filters (agentId, capabilityId, status, limit, userId), includes capability info
  11. `POST /api/acrp/agents/[id]/command/route.ts` — Send command to agent via skill-ws /internal/acrp-notify
  12. `DELETE /api/acrp/agents/[id]/token/route.ts` — Revoke agent's ACRP token, set agentToken=null, wsConnected=false, status=offline, delete all capabilities
- All routes use `import { db } from '@/lib/db'` for database access
- All routes use `NextRequest`/`NextResponse` with proper error handling (try/catch)
- Dynamic route params use `params: Promise<{ id: string }>` pattern (Next.js 16)
- skill-ws integration uses `http://localhost:3004/internal/*` endpoints with AbortSignal.timeout(3000-5000)
- Lint check passes clean

Stage Summary:
- Complete ACRP API backend implemented with 12 routes
- Supports full agent lifecycle: token generation → registration → heartbeat → invocation → result → disconnect → revocation
- Deep integration with skill-ws WebSocket service for real-time agent communication
- Capability upsert with stale pruning ensures agent registrations stay in sync
- Invocation tracking with status progression: pending → sent → executing → success/failed/timeout

---
Task ID: 2
Agent: SkillWsAcrpUpdater
Task: Evolve the skill-ws service to support ACRP (Agent Capability Registration Protocol)

Work Log:
- Rewrote `/home/z/my-project/mini-services/skill-ws/index.ts` (1603 lines) with full ACRP support:
  - **Dual authentication middleware**: Supports both `endpointToken` (legacy skill-plugin bindings) and `agentToken` (ACRP agent-level auth)
    - If `agentToken` provided: validates via `GET /api/acrp/validate-token`, stores `socket.data.authMode = 'acrp'`
    - If `endpointToken` provided: validates via `GET /api/skill-protocol/validate` (existing flow)
    - Auth mode determines which connection handler runs on connect
  - **ACRP event handlers** (agent → server):
    - `agent:register` — Agent registers profile + capabilities, syncs to DB via `POST /api/acrp/register`, emits `agent:registered` with heartbeatInterval and serverTime
    - `agent:heartbeat` — Updates lastHeartbeat, forwards to DB via `POST /api/acrp/heartbeat`, emits `agent:heartbeat-ack`
    - `capability:result` — Agent returns invocation result, resolves pending promise, updates DB via `POST /api/acrp/invocation-result`
    - `agent:status` — Agent sends status update (online/busy/error), updates DB via `POST /api/acrp/status`
    - `agent:event` — General events (message, notification, im_event), processes message type by creating conversation messages
  - **Hub → Agent events**:
    - `capability:invoke` — Sent via `/internal/acrp-invoke`, includes invocationId, capabilityId, params, invokedBy, timestamp
    - `agent:command` — Sent via `/internal/acrp-notify` with command field, includes command, params, timestamp
    - `agent:notification` — Sent via `/internal/acrp-notify`, includes type, data, timestamp
  - **New internal HTTP API endpoints**:
    - `POST /internal/acrp-invoke` — Invoke capability on connected ACRP agent (with optional wait-for-response, 60s timeout)
    - `GET /internal/acrp-status` — Get ACRP agent connection status (connected, lastHeartbeat, socketId, capabilities, agentType, agentVersion)
    - `POST /internal/acrp-notify` — Send notification or command to ACRP agent (supports both agent:notification and agent:command events)
  - **Connected ACRP Agent tracking**: Separate `Map<agentId, ACRPConnectedAgent>` with socketId, agentToken, name, version, platform, capabilities[], connectedAt, lastHeartbeat
  - **Reconnection handling**: If agent reconnects, old socket is disconnected and replaced
  - **Disconnect cleanup**: Updates Agent.wsConnected=false, status='offline' via `POST /api/acrp/status`
  - **Stale heartbeat cleanup**: ACRP connections checked alongside legacy connections every 30s, stale agents (>90s) disconnected and cleaned
  - **Updated health endpoint**: Now includes acrpConnectedAgents count
  - **Updated agents list**: `/internal/agents` now returns both legacy and ACRP agents with authMode field
  - **Updated notify**: `/internal/notify` now also sends to ACRP connections
  - **Graceful shutdown**: Cleans up both acrpConnectedAgents and acrpSocketToAgentId maps
- Updated `/home/z/my-project/src/app/api/acrp/validate-token/route.ts`:
  - Added agentVersion, agentPlatform, and status to the response for skill-ws to store
- Updated `/home/z/my-project/src/app/api/acrp/register/route.ts`:
  - Added dual-format support: accepts both `{agentId, name, version, platform, capabilities}` (from skill-ws) and `{agentToken, agentInfo}` (direct API)
  - Capability identifiers support both `id` (ACRP spec) and `capabilityId` (DB field)
  - Stale capabilities are deleted (not just disabled) when agent removes them
- Updated `/home/z/my-project/src/app/api/acrp/invocation-result/route.ts`:
  - Creates new invocation record if not found (for fire-and-forget invocations)
  - Updates capability invokeCount only for existing invocations
- Created `/home/z/my-project/src/app/api/acrp/heartbeat/route.ts`:
  - POST endpoint to process ACRP agent heartbeats
  - Updates lastHeartbeatAt, wsConnected, status, and merges metrics into agentMetadata
- Created `/home/z/my-project/src/app/api/acrp/status/route.ts`:
  - POST endpoint to update ACRP agent status
  - Updates status, wsConnected, and metrics
- All existing skill-ws functionality preserved (endpointToken auth, skill:register, skill:heartbeat, etc.)
- Lint check passes clean

Stage Summary:
- **skill-ws service now supports dual authentication**: endpointToken (legacy) + agentToken (ACRP)
- **ACRP agents connect at the agent level** using agentToken, then register capabilities (model.switch, skill.install, soul.configure, etc.)
- **Hub can remotely invoke capabilities** on connected agents via /internal/acrp-invoke
- **Full bidirectional event flow**: agent:register, agent:heartbeat, capability:result, agent:status, agent:event (agent→hub) + capability:invoke, agent:command, agent:notification (hub→agent)
- **Capability results resolve pending promises** with 60s timeout, supporting both wait-for-response and fire-and-forget modes
- **Automatic stale connection cleanup** for both legacy and ACRP connections
- **New ACRP API routes**: validate-token, register, heartbeat, status, invocation-result — all called by skill-ws to sync with DB

---
Task ID: ACRP-2
Agent: main
Task: Remove direct Hermes Agent connection, replace with ACRP WebSocket

Work Log:
- Removed 'hermes' from ViewMode type in store.ts
- Removed HermesManager nav item from Sidebar (was using Cable icon, 'hermes' view)
- Removed Cable icon import from Sidebar (no longer needed)
- Removed HermesManager import and case from page.tsx
- Removed 'hermes' case from renderView() in page.tsx
- Updated AgentManager: replaced 'hermes' mode with 'acrp' mode
  - modeLabels: hermes → acrp, using agents.modeAcrpShort
  - modeColors: hermes → acrp, same cyan color
  - SelectItem: value="hermes" → value="acrp", label agents.modeAcrp
- Updated Dashboard:
  - Changed Cable icon to Monitor icon
  - Changed gateways card view from 'hermes' to 'agent-control'
  - Changed quick action from setCurrentView('hermes') to setCurrentView('agent-control')
  - Updated agent mode display logic to handle 'acrp' mode
- Updated i18n across all 8 locales:
  - Added agents.modeAcrp: "ACRP Agent (WebSocket connection)" (+ translations)
  - Added agents.modeAcrpShort: "ACRP Agent" (+ translations)
  - Updated dashboard.connectHermes: "Connect Hermes Agent" → "Agent Control Center"
  - Updated dashboard.gateways: "Hermes Gateways" → "Connected Agents"
  - Updated dashboard.gatewaysRunning: "{count} running" → "{count} connected"
  - Updated auth.features: "Hermes Agent management" → "ACRP Agent Control"
  - Kept agents.modeHermes/modeHermesShort for backward compatibility
- All lint checks pass clean
- Committed and pushed to remote (9a673c3)

Stage Summary:
- **Direct Hermes Agent connection removed from UI** — replaced by ACRP Agent Control
- **Sidebar simplified**: "Hermes Agent" (Cable icon) replaced by "Agent Control" (Monitor icon)
- **Agent creation**: "Hermes Agent (Direct connection)" → "ACRP Agent (WebSocket connection)"
- **Dashboard**: Gateways card and quick action now point to Agent Control Center
- **Backward compatible**: modeHermes keys kept in i18n, HermesManager.tsx file still exists but unused
- **ACRP is now the primary way to manage external agents**

---
Task ID: BUGFIX-CLEANUP
Agent: main
Task: Fix deployment failures — remove hermesGateway 500 errors, simplify agent modes

Work Log:
- **Identified critical bug**: `/api/hermes/gateways` returned 500 because `db.hermesGateway.findMany()` was called but HermesGateway model no longer exists in Prisma schema
- Deleted `/home/z/my-project/src/app/api/hermes/` directory entirely (5 route files: gateways, [id], start, stop, health)
- Deleted `/home/z/my-project/src/components/views/HermesManager.tsx` (unused component)
- Removed Hermes Gateway methods from `api-client.ts`: getGateways, createGateway, updateGateway, deleteGateway, startGateway, stopGateway, checkGatewayHealth
- Removed `gateways` state from `store.ts` (gateways, setGateways)
- Removed `api.getGateways()` call from `page.tsx` loadData function
- Removed gateways from Promise.all in loadData
- Verified AgentManager already simplified to only `builtin` and `acrp` modes (custom_api removed earlier)
- Added `allowedDevOrigins` to `next.config.ts` to fix CORS warnings
- Added `modeAcrpDesc` i18n key to all 8 locale files
- Enhanced Dashboard with:
  - System Status card (LLM Providers progress bar, ACRP Connections progress bar, Skills Active progress bar, quick stats grid)
  - Agent Architecture card (Builtin Mode and ACRP Mode diagrams with flow indicators)
  - Recent Activity card
  - Better stat cards with colored borders, hover animations (-translate-y-0.5), detail text
  - System Online + ACRP v2.0 badges in header
- Enhanced Sidebar with ACRP connected agent count badge (cyan pulse dot)
- All lint checks pass clean
- API endpoints verified: `/api/hermes/gateways` → 404 (was 500), all other APIs → 200

Stage Summary:
- **Critical deployment bug FIXED**: hermesGateway 500 error resolved by removing orphaned API routes
- **Agent mode simplified**: Only `builtin` (Hub-internal LLM) and `acrp` (WebSocket connection) remain
- **One agent = one connection method**: builtin uses provider+model, acrp uses WebSocket token auth
- **Dashboard redesigned**: Richer with system status, architecture diagrams, activity feed
- **Sidebar enhanced**: Live ACRP connection count badge with pulse animation
- **All API tests pass**: No more 500 errors
