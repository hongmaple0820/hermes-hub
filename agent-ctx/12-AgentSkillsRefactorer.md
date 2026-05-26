# Task 12 - AgentSkills Refactor

## Summary
Refactored the Skills system to comply with the AgentSkills specification (https://agentskills.io/specification).

## Changes Made

### 1. Prisma Schema (`prisma/schema.prisma`)
- Updated Skill model with AgentSkills spec fields:
  - Added: `license`, `compatibility`, `metadata`, `allowedTools`, `instructions`
  - Added source tracking: `sourceType`, `sourceUrl`, `sourcePath`, `installedAt`
  - Removed: `version`, `author` (now in `metadata` JSON)
  - Changed `category` default to "general"

### 2. Seed API (`src/app/api/seed/skills/route.ts`)
- Replaced 12 old skills with 12 AgentSkills-compliant skills:
  commit-helper, code-review, test-writer, doc-generator, api-designer, db-analyzer,
  security-scanner, perf-optimizer, i18n-helper, deploy-manager, debug-assistant, data-analyst
- Each skill has proper frontmatter fields and Markdown instructions body

### 3. Skills API Routes
- `src/app/api/skills/route.ts` - GET (with sourceType filter, JSON parsing), POST (with AgentSkills validation)
- `src/app/api/skills/[id]/route.ts` - GET/PATCH/DELETE with new field handling

### 4. Import-Skill API (`src/app/api/skills/import-skill/route.ts`)
- POST endpoint for importing skills from git repos
- Parses YAML frontmatter from SKILL.md files
- Scans AgentSkills discovery paths
- Creates/updates Skill records

### 5. Frontend Fix
- SkillMarketplace.tsx: Changed `skill.version` to `skill.metadata?.version || '1.0'`

## Verification
- `bun run db:push` applied successfully
- `bun run db:generate` regenerated Prisma Client
- `bun run lint` passes clean
- 12 new skills seeded successfully via API
- Skills API returns new fields with proper JSON parsing
