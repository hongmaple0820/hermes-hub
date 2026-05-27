# Task 9-c: ACRP Chat Integration

## Summary
Fixed setup guide code examples, added "Chat with Agent" button, added i18n keys, and updated ChatView to support ACRP agents.

## Changes Made

### 1. AgentControlCenter.tsx - Setup Guide Code Examples
- Fixed `capabilityId` → `id` in all 3 code examples (JS, Python, JSON payload)
  - JS: `capabilityId: 'model.switch'` → `id: 'model.switch'`
  - Python: `'capabilityId': 'skill.install'` → `'id': 'skill.install'`
  - JSON: `"capabilityId": "model.switch"` → `"id": "model.switch"` and `"capabilityId": "skill.install"` → `"id": "skill.install"`
- Fixed `capability:result` event in JS and Python examples:
  - Removed `status: 'success'` (not in ACRPCapabilityResult interface)
  - Changed `result: { message: 'Done!' }` to proper pattern: `result: response, duration: 150`
  - JS: Now uses `const response = { message: 'Done!' }; socket.emit('capability:result', { invocationId, result: response, duration: 150 })`
  - Python: Now uses `response = {'message': 'Done!'}; sio.emit('capability:result', {'invocationId': ..., 'result': response, 'duration': 150})`

### 2. AgentControlCenter.tsx - "Chat with Agent" Button
- Added `MessageCircle` import from lucide-react
- Added `handleChatWithAgent` function that:
  - Creates a conversation via `api.createConversation()`
  - Refreshes conversations list in store
  - Sets selected conversation ID
  - Navigates to chat view via `setCurrentView('chat')`
- Added button in agent detail panel (after Agent Info Card, before Quick Commands):
  - Shows "Chat with Agent" with MessageCircle icon
  - Disabled when agent is offline
  - Shows "Agent is offline" hint text when disconnected

### 3. i18n Keys Added
**en.json** (acrp section):
- `chatWithAgent`: "Chat with Agent"
- `agentOffline`: "Agent is offline"
- `invocationFailed`: "Invocation failed"
- `invocationTimeout`: "Invocation timed out"
- `agentNotConnected`: "Agent not connected"
- `serviceUnavailable`: "Service unavailable"

**zh.json** (acrp section):
- `chatWithAgent`: "与智能体对话"
- `agentOffline`: "智能体离线"
- `invocationFailed`: "调用失败"
- `invocationTimeout`: "调用超时"
- `agentNotConnected`: "智能体未连接"
- `serviceUnavailable`: "服务不可用"

### 4. ChatView ACRP Agent Support
- Verified ChatView already shows ACRP agents without filtering (line 433: `{agent.mode === 'acrp' ? 'ACRP' : 'Builtin'}`)
- Verified no mode-based filtering in agent selection lists
- Updated `agent-reply.ts` to handle ACRP mode:
  - Added early check for `agent.mode === 'acrp'` that delegates to `handleAcrpAgentReply()`
  - New `handleAcrpAgentReply()` function:
    - Checks ACRP agent connectivity via skill-ws `/internal/acrp-status`
    - Returns offline message if agent not connected
    - Finds chat capability in registered capabilities
    - Invokes capability via skill-ws `/internal/acrp-invoke?wait=true`
    - Saves response as agent message in database
    - Handles errors gracefully (service unavailable, invocation failed)

## Verification
- `bun run lint` passes clean (0 errors)
- Dev server running without errors
- All 3 services stable: Next.js (3000), chat-service (3003), skill-ws (3004)
