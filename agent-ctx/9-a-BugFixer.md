# Task 9-a: BugFixer — Fix 6 critical ACRP/skill-ws bugs

## Summary
Fixed 6 critical bugs across the ACRP protocol and skill-ws WebSocket service.

## Files Modified

1. **`/src/app/api/agents/route.ts`** — Added agentType/agentVersion to POST handler
2. **`/src/app/api/agents/[id]/route.ts`** — Added agentType/agentVersion/agentPlatform to PATCH allowedFields
3. **`/mini-services/skill-ws/index.ts`** — Fixed capabilityId, added timeout cleanup, added acrp-disconnect endpoint
4. **`/src/app/api/acrp/agents/[id]/invoke/route.ts`** — Fixed invocation status for offline/unavailable scenarios
5. **`/src/app/api/acrp/agents/[id]/token/route.ts`** — Added skill-ws disconnect notification on token revocation
6. **`/src/app/api/acrp/generate-token/route.ts`** — Made WS URLs configurable via env vars

## Verification
- `bun run lint` passes clean
