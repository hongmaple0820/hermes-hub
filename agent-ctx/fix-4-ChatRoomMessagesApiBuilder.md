# Task fix-4: Create missing chat-room messages API routes

## Work Summary
Created `/home/z/my-project/src/app/api/chat-rooms/[roomId]/messages/route.ts` with GET and POST handlers.

## Details

### GET /api/chat-rooms/[roomId]/messages
- Requires auth (requireAuth)
- Verifies room exists (404)
- Verifies user is a member (403)
- Cursor-based pagination: `limit` (default 50, max 100) and `before` (message ID)
- Returns `{ messages: ChatRoomMessage[] }` in chronological order

### POST /api/chat-rooms/[roomId]/messages
- Requires auth (requireAuth)
- Verifies room exists (404)
- Verifies user is a member (403)
- Validates non-empty content (400)
- Creates ChatRoomMessage with senderInfo from user
- Returns `{ message: ChatRoomMessage }`

## Frontend Compatibility
- `api.getChatRoomMessages(roomId)` → GET → `{ messages: any[] }` ✓
- `api.sendChatRoomMessage(roomId, content)` → POST → `{ message: any }` ✓

## Lint
Passes clean.
