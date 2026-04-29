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
