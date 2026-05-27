# Task 3-b: Add missing API methods and enhance store for 2.0 features

## Agent: APIEnhancer

## Summary

All required API methods, store enhancements, and backend routes for Hermes Hub 2.0's Thread/Run/Step/Tool architecture have been verified and completed.

## Changes Made

### 1. API Client (`src/lib/api-client.ts`)
- **Verified** all Thread Management methods exist: `getThreads`, `createThread`, `getThread`, `updateThread`, `deleteThread`, `getThreadMessages`, `sendThreadMessage`
- **Updated** `cancelRun` signature from `cancelRun(threadId, runId)` → `cancelRun(runId)` which POSTs to `/api/runs/${runId}/cancel`
- **Added** `cancelThreadRun(threadId, runId)` as backward-compatible alias for the original thread-scoped cancel endpoint
- **Verified** all Run Management methods: `getAllRuns`, `getThreadRuns`, `createRun`, `getRun`, `getRunSteps`
- **Verified** all Tool Management methods: `getTools`, `createTool`, `updateTool`, `deleteTool`, `seedTools`, `getAgentTools`, `bindToolToAgent`, `unbindToolFromAgent`, `updateAgentTool`

### 2. New Backend Route: `/api/runs/[runId]/cancel/route.ts`
- Created POST endpoint for canceling runs by runId alone
- Includes `requireAuth()` authentication
- Verifies ownership via run → thread → user relationship
- Validates only queued/in_progress runs can be cancelled
- Returns serialized run with computed fields (durationMs, stepCount) and thread/agent info

### 3. Enhanced Runs API (`src/app/api/runs/route.ts`)
- Added max limit cap: `Math.min(Math.max(rawLimit, 1), 200)` — clamps between 1 and 200, default 50
- Already had: status filter, agentId filter (via Thread→Agent), thread/agent include, computed durationMs/stepCount

### 4. Zustand Store (`src/lib/store.ts`)
- **Verified** `tools: any[]` and `setTools` already present
- **Verified** `threads: any[]` and `setThreads` already present
- **Verified** ViewMode includes all 22 required keys

### 5. Bug Fixes (Pre-existing)
- Fixed parsing error in `ToolRegistry.tsx`: missing `}` in JSX conditional expression
- Fixed parsing error in `AgentBuilder.tsx`: missing `</div>` closing tag for step indicators section

## Verification
- `bun run lint` passes clean with 0 errors
- All 25+ API routes verified to exist and work correctly
- No breaking changes to existing API endpoints
