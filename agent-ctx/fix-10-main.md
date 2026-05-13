# Task fix-10: Fix JSON field parsing consistency and data integrity issues

## Summary
Fixed 6 bugs related to JSON parsing, cascade deletes, FK constraint handling, ownership verification, and data integrity.

## Changes Made

### Problem 1: JSON string fields not parsed on read
- Added `safeJsonParse()` to 5 API routes
- `agentMetadata` parsed in agents GET (list + single)
- `lineage` parsed in conversations GET (list + single)
- `metadata` parsed in messages GET

### Problem 2: AgentSkill → Skill cascade delete
- Added `onDelete: Cascade` to AgentSkill.skill relation in schema.prisma
- Applied with `bun run db:push`

### Problem 3: Provider delete nullifies Agent.providerId
- Added `db.agent.updateMany` before `db.lLMProvider.delete` in providers/[id]/route.ts

### Problem 4: Agent delete nullifies conversation.agentId
- Added `db.conversation.updateMany` before `db.agent.delete` in agents/[id]/route.ts

### Problem 5: Conversation create verifies agent ownership
- Added ownership check in conversations/route.ts POST handler

### Problem 6: Skill.installedAt set on install
- Added `db.skill.update` with `installedAt: new Date()` in skills/[id]/install/route.ts

## Verification
- `bun run lint` passes clean
- `bun run db:push` applied successfully
- Dev server running without errors
