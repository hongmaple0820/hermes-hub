# Task 2 - SkillWsAcrpUpdater

## Task: Evolve the skill-ws service to support ACRP (Agent Capability Registration Protocol)

## Status: COMPLETED

## Summary of Changes

### 1. Skill-WS Service (`/home/z/my-project/mini-services/skill-ws/index.ts`)
- **1603 lines** complete rewrite with ACRP support added on top of existing functionality
- **Dual authentication middleware**: endpointToken (legacy) + agentToken (ACRP)
- **5 ACRP event handlers** (agent→server): agent:register, agent:heartbeat, capability:result, agent:status, agent:event
- **3 Hub→Agent events**: capability:invoke, agent:command, agent:notification
- **3 New internal HTTP API endpoints**: /internal/acrp-invoke, /internal/acrp-status, /internal/acrp-notify
- **Separate ACRP agent tracking**: Map<agentId, ACRPConnectedAgent> with full metadata
- **Stale connection cleanup** for both legacy and ACRP connections
- **All legacy functionality preserved** — endpointToken auth, skill:register, skill:heartbeat, etc.

### 2. ACRP API Routes
- **validate-token**: Updated to return agentVersion, agentPlatform, status
- **register**: Updated with dual-format support (agentId-based and agentToken-based), supports both `id` and `capabilityId`
- **invocation-result**: Updated to create new records if not found, improved error handling
- **heartbeat**: New route for ACRP agent heartbeats
- **status**: New route for ACRP agent status updates

### 3. Key Design Decisions
- ACRP and legacy connections run on the same Socket.IO server (port 3004)
- Auth mode is determined by which token type is provided (agentToken vs endpointToken)
- Each agentId can only have one ACRP connection at a time (reconnection replaces old)
- ACRP invoke timeout is 60s (vs 30s for legacy tool calls)
- Capabilities use `id` in the ACRP protocol spec but `capabilityId` in the DB — register route handles both

### Files Modified
- `/home/z/my-project/mini-services/skill-ws/index.ts` — Complete rewrite
- `/home/z/my-project/src/app/api/acrp/validate-token/route.ts` — Updated
- `/home/z/my-project/src/app/api/acrp/register/route.ts` — Updated
- `/home/z/my-project/src/app/api/acrp/invocation-result/route.ts` — Updated
- `/home/z/my-project/src/app/api/acrp/heartbeat/route.ts` — Created
- `/home/z/my-project/src/app/api/acrp/status/route.ts` — Created
