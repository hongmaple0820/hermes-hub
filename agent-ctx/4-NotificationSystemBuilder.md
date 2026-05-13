# Task 4 - Real-time Notification System via Socket.IO

## Summary
Added real-time notification system using Socket.IO, with persistent DB storage and live push notifications.

## Files Modified
- `prisma/schema.prisma` — Added Notification model
- `mini-services/chat-service/index.ts` — Added notification events + internal HTTP API
- `src/lib/store.ts` — Added new_message type, live/persisted fields, addPersistedNotifications
- `src/lib/api-client.ts` — Added notification API methods
- `src/components/shared/NotificationBell.tsx` — Rewrote with Socket.IO real-time connection
- `src/components/shared/NotificationPanel.tsx` — Rewrote with live badge, date grouping, DB merge
- `src/app/api/notifications/route.ts` — New REST API (GET/POST/PATCH/DELETE)
- `src/app/api/agents/route.ts` — Added push notification on agent creation
- `src/app/api/acrp/agents/[id]/invoke/route.ts` — Added push notification on capability invoke
- `src/app/api/conversations/[id]/messages/route.ts` — Added push notification on agent reply
- `src/i18n/locales/*.json` (8 files) — Added new notification i18n keys

## Architecture
```
Next.js API → POST /internal/notifications (chat-service:3003) → Socket.IO → Client
                ↓
         DB Notification table (persisted)
```
