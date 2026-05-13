# Task fix-3: Add requireAuth to all ACRP API endpoints

## Summary
Added authentication to all 12 ACRP API route files and updated the skill-ws service to include internal secret headers.

## Changes Made

### ACRP API Routes (12 files in `/src/app/api/acrp/`)

| Route | Auth Type | Ownership Check |
|-------|-----------|----------------|
| `generate-token/route.ts` | requireAuth | ✅ agent.userId === user.id |
| `register/route.ts` | dual: x-internal-secret OR requireAuth | ✅ (for frontend calls) |
| `heartbeat/route.ts` | dual: x-internal-secret OR requireAuth | ✅ (for frontend calls) |
| `status/route.ts` | dual: x-internal-secret OR requireAuth | ✅ (for frontend calls) |
| `disconnect/route.ts` | requireAuth | ✅ agent.userId === user.id |
| `agents/route.ts` | requireAuth (replaced query-param userId) | N/A (scoped to user) |
| `agents/[id]/route.ts` | requireAuth | ✅ agent.userId === user.id |
| `agents/[id]/invoke/route.ts` | requireAuth (replaced x-user-id header) | ✅ agent.userId === user.id |
| `agents/[id]/command/route.ts` | requireAuth | ✅ agent.userId === user.id |
| `agents/[id]/token/route.ts` | requireAuth | ✅ agent.userId === user.id |
| `invocations/route.ts` | requireAuth | N/A (scoped to user's agents) |
| `invocation-result/route.ts` | x-internal-secret only | N/A (internal service) |

### Skill-ws Service (`mini-services/skill-ws/index.ts`)
- Added `INTERNAL_SECRET` constant
- Added `x-internal-secret` header to all 7 ACRP API fetch calls

### Environment
- Added `INTERNAL_SECRET=acrp_internal_secret_2025` to `.env`

## Verification
- `bun run lint` passes clean
- Dev server running normally
