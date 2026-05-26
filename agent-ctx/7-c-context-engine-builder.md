Task ID: 7-c
Agent: context-engine-builder
Task: Build Context Compression Engine + Conversation Lineage Tracking

Work Log:
- Added ContextSnapshot model to Prisma schema with fields: roomId, conversationId, summary, messageRange, tokenCount, compressionType, plus indexes
- Added parentSessionId and lineage fields to Conversation model for conversation lineage tracking
- Added contextSnapshots relation to both ChatRoom and Conversation models
- Ran db:push to sync schema (26 total models now)
- Created context-engine.ts library at src/lib/context-engine.ts:
  - CJK-aware token estimation, two compression paths, tail message preservation, LLM summarization
- Created conversation-lineage.ts library at src/lib/conversation-lineage.ts:
  - getConversationLineage, continueConversation, isContinuation
- Created 6 API route files for context engine and lineage
- Updated chat service with room:compress Socket.IO event handler
- Updated API client with 6 new methods
- Created ContextIndicator UI component
- Updated ChatView with context indicator, lineage display, and continue session button
- Updated i18n locale files with context namespace (15 keys)
- All lint checks passing

Stage Summary:
- Database: 26 models (added ContextSnapshot, updated Conversation)
- Context Engine: Two-path compression, CJK-aware token estimation, tail message preservation
- Conversation Lineage: Multi-session tracking with parent-child chain
- API: 6 new route files, Socket.IO: room:compress event
- UI: ContextIndicator component, ChatView integration, i18n: 15 new keys in 4 languages
