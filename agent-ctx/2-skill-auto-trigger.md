---
Task ID: 2
Agent: In-Chat Skill Auto-Trigger with Confirmation Dialog
Task: Implement skill usage confirmation dialog, skill invocation indicators, and manual @mention trigger

Work Log:
- Read all required files: ChatView.tsx, agent-reply.ts, skill-executor.ts, api-client.ts, messages route, store.ts, i18n locales
- Analyzed current skill execution flow: agent-reply.ts → executeToolChain() → executeSkillsForAgent()
- Part 1: Backend - Modified agent-reply.ts
  - Added `approvedSkills` optional field to `AgentReplyParams` interface
  - Added `SkillPreviewItem` and `SkillPreviewResult` exported types
  - Created `previewSkillUsage()` function: makes one LLM call with tool definitions to see which tools the agent selects, returns preview without executing any
  - Modified `generateAgentReply()`: when `approvedSkills` is provided, only execute those skills in the tool chain
- Part 2: Backend - Modified skill-executor.ts
  - Added `approvedSkills` optional parameter to `executeToolChain()`
  - When provided, filters tool definitions to only approved skill names
- Part 3: Backend - Modified messages route.ts
  - Added `?mode=preview` query parameter support
  - When `mode=preview`: calls `previewSkillUsage()` and returns `{ message, needsSkillApproval, pendingSkills }`
  - Added `approved_skills` field extraction from request body
  - Passes `approved_skills` as `approvedSkills` to `generateAgentReply()`
- Part 4: Frontend - Created SkillConfirmDialog.tsx
  - Beautiful dialog showing agent name, skill cards with icons, descriptions, reasons
  - "Allow" (emerald) and "Deny" buttons with loading state
  - "Always allow" checkbox for single-skill approvals
  - Framer Motion entrance animations
  - Skill icon mapping (🔍 web-search, 🌐 translation, 🎨 image-generation, etc.)
  - Uses shadcn/ui Dialog, Button, Badge, Avatar components
- Part 5: Frontend - Modified ChatView.tsx
  - Added state: `skillConfirmOpen`, `pendingSkillApproval`, `pendingUserMsg`, `executingSkills`, `usedSkills`, `showSkillMention`, `mentionFilter`
  - Created `executeSend()` function: handles sending with `approved_skills` parameter, tracks used skills per message
  - Modified `handleSend()`: first tries `?mode=preview`, checks auto-allow prefs, shows SkillConfirmDialog if needed
  - Created `handleSkillAllow()`: saves auto-allow preference, resends with approved skills
  - Created `handleSkillDeny()`: resends without skills
  - Added skill invocation indicators: badges below agent messages showing "Used: ⚡ skill-name"
  - Added executing skills indicator: animated badges with bouncing dots while skills run
  - Added @mention dropdown: when user types "@", shows filtered skill list, inserts "@skill-name "
  - Added `parseMentions()`: extracts @mentions from input text for explicit skill requests
  - Added SkillConfirmDialog component to the ConversationsPanel JSX
- Part 6: Modified store.ts
  - Added `skillAutoAllow: Record<string, string[]>` state (per-agent skill auto-allow preferences)
  - Added `setSkillAutoAllow` setter
- Part 7: i18n - Added keys to en.json and zh.json
  - `chat.skillWantsToUse`: "Skill Approval Required" / "技能使用授权"
  - `chat.skillReason`: "wants to use the following skills" / "想要使用以下技能"
  - `chat.allow`: "Allow" / "允许"
  - `chat.deny`: "Deny" / "拒绝"
  - `chat.alwaysAllow`: "Always allow" / "始终允许"
  - `chat.usedSkill`: "Used" / "已使用"
  - `chat.executingSkill`: "Executing" / "执行中"
  - `chat.mentionSkill`: "Mention a skill" / "提及技能"
- Lint: 0 errors, 1 pre-existing warning (unused eslint-disable in workflows/[id]/route.ts)
- Dev server running normally

Stage Summary:
- **Skill Preview API**: POST `/api/conversations/[id]/messages?mode=preview` returns which skills the agent wants to use without executing them
- **Skill Approval Flow**: User sends message → preview check → SkillConfirmDialog shown → Allow/Deny → execute with approved_skills
- **Auto-Allow Preferences**: "Always allow [skill]" checkbox saves per-agent preferences to Zustand store
- **Skill Indicators**: Badges below agent messages show which skills were used; animated indicators during execution
- **@Mention Support**: Type "@" to see skill dropdown, select to insert "@skill-name", treated as explicit skill request
- **Backend Filtering**: `approvedSkills` parameter in `executeToolChain()` and `generateAgentReply()` ensures only approved skills execute
- All changes backward compatible — agents without skills or without approval flow work as before

Key Files Created:
- /src/components/chat/SkillConfirmDialog.tsx (NEW - 185 lines)

Key Files Modified:
- /src/lib/agent-reply.ts (added previewSkillUsage, approvedSkills support in generateAgentReply)
- /src/lib/skill-executor.ts (added approvedSkills filter to executeToolChain)
- /src/app/api/conversations/[id]/messages/route.ts (added mode=preview, approved_skills)
- /src/components/views/ChatView.tsx (skill approval flow, indicators, @mention)
- /src/lib/store.ts (added skillAutoAllow state)
- /src/i18n/locales/en.json (added 8 skill confirmation keys)
- /src/i18n/locales/zh.json (added 8 skill confirmation keys)
