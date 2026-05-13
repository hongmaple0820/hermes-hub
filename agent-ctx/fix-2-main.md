# Task: fix-2 - Fix three backend bugs

## Summary
Fixed 3 backend bugs in Hermes Hub:
1. Agent reply `senderId` was incorrectly set to `userId` — changed to `null`
2. Agent creation response didn't include just-installed skills — now re-fetches agent after skill installation
3. AgentSkill records created during agent creation lacked `endpointToken` and `callbackSecret` — now generates them using `randomUUID()`

## Files Modified
- `/home/z/my-project/src/lib/agent-reply.ts` — Changed `senderId: userId` → `senderId: null`
- `/home/z/my-project/src/app/api/agents/route.ts` — Added `randomUUID` import, replaced `createMany` with individual `create` calls including tokens, added re-fetch of agent before response

## Verification
- `bun run lint` passes clean
