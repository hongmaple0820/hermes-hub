# Task 9-b: ACRP Chat Integrator

## Task
Add ACRP agent mode to chat-service and chat:message event to skill-ws

## Changes Made

### 1. chat-service/index.ts
- **Line 42**: Changed `mode: 'builtin' | 'custom_api' | 'hermes'` to `mode: 'builtin' | 'custom_api' | 'hermes' | 'acrp'`
- **Lines 346-348**: Added ACRP case in `agent:message` handler:
  ```typescript
  } else if (agentConfig.mode === 'acrp') {
    await handleAcrpAgent(socket, roomKey, conversationId, agentConfig, message)
  }
  ```
- **Lines 1073-1199**: Added `handleAcrpAgent` function after `handleHermesAgent`:
  - Checks ACRP agent online status via skill-ws `/internal/acrp-status`
  - Returns offline message if agent not connected
  - Finds chat-capable capability from agent's registered capabilities
  - Invokes capability via skill-ws `/internal/acrp-invoke?wait=true`
  - Handles: 404 (offline), 504 (timeout), other errors
  - Streams response back via agent:stream, agent:typing, agent:stream-complete

### 2. skill-ws/index.ts
- **Lines 853-862**: Added `chat:message` event handler in `handleACRPConnection`:
  - Receives { conversationId, content, senderId, senderName }
  - Logs the received message
  - Agent can respond via capability:result or agent:event

## Verification
- chat-service starts without new TypeScript errors
- skill-ws has no new TypeScript errors
- bun run lint passes clean
