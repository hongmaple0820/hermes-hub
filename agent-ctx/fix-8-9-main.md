# Task fix-8-9: SSE Streaming + Confirmation Dialogs

## Work Log

### Part A: SSE Streaming for 1-on-1 Chat

1. **Added `chatCompletionStream` to `llm-provider.ts`**:
   - New async generator function that yields `{ type: 'chunk' | 'done', content?, model?, usage? }` events
   - Supports native SSE streaming for OpenAI, Custom, and Ollama providers (OpenAI-compatible streaming API)
   - Falls back to non-streaming for Anthropic, Google Gemini, and z-ai (yields full content at once)
   - Handles both OpenAI SSE format (`data: {...}` with `choices[0].delta.content`) and Ollama format (`message.content`)

2. **Added `streamAgentReply` to `agent-reply.ts`**:
   - Extracted shared `prepareAgentContext` helper from `generateAgentReply` to avoid code duplication
   - New `streamAgentReply` async generator yields SSE-formatted strings directly:
     - `data: {"type": "chunk", "content": "..."}\n\n` for each content chunk
     - `data: {"type": "done", "messageId": "..."}\n\n` when complete (after saving to DB)
     - `data: {"type": "error", "error": "..."}\n\n` on failure
   - Saves the complete message to DB after streaming finishes
   - Updates agent status to 'online' on success, 'error' on failure

3. **Modified messages API route** (`/api/conversations/[id]/messages/route.ts`):
   - POST handler now checks `Accept` header
   - When `Accept: text/event-stream`: returns SSE ReadableStream using `streamAgentReply`
   - When `Accept: application/json` (default): keeps existing synchronous behavior
   - SSE response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`

4. **Updated ChatView ConversationsPanel** for SSE streaming:
   - Added `streaming`, `streamingContent`, `abortRef` state
   - `handleSend` now sends `Accept: text/event-stream` header
   - Reads response as ReadableStream, parses SSE events incrementally
   - Shows typing indicator while waiting for first chunk
   - Shows streaming content with Markdown rendering and blinking cursor during streaming
   - On `done` event: replaces streaming content with final agent message
   - On `error` event: shows toast and preserves accumulated content
   - Send button disabled during both sending and streaming
   - ScrollIntoView triggered on `streamingContent` changes

### Part B: Confirmation Dialogs for Destructive Actions

5. **ProviderManager.tsx** - Delete confirmation dialog:
   - Added `showDeleteConfirm` and `deletingProvider` state
   - Added `handleDeleteClick` to set provider before showing dialog
   - Dialog shows provider name in destructive-styled alert box
   - Cancel and Delete buttons with proper i18n

6. **JobsView.tsx** - Delete confirmation dialog:
   - Added `showDeleteConfirm` and `deletingJob` state
   - Added `handleDeleteClick` to set job before showing dialog
   - Dialog shows job name in destructive-styled alert box
   - Cancel and Delete buttons with proper i18n

7. **FilesView.tsx** - Delete confirmation dialog:
   - Added `showDeleteConfirm` and `deletingFile` state
   - Added `handleDeleteClick` to set file before showing dialog
   - Dialog shows file name + folder badge for directories
   - Cancel and Delete buttons with proper i18n

8. **ChatView.tsx** - Updated existing conversation delete confirmation:
   - Replaced hardcoded English text with i18n keys
   - Uses `chat.deleteConversationTitle` and `chat.deleteConversationDesc`

9. **i18n keys added to all 8 locales** (en, zh, ja, ko, de, es, fr, pt):
   - `providers.deleteConfirmTitle` / `providers.deleteConfirmDesc`
   - `jobs.deleteConfirmTitle` / `jobs.deleteConfirmDesc`
   - `files.deleteConfirmTitle` / `files.deleteConfirmDesc`
   - `chat.deleteConversationTitle` / `chat.deleteConversationDesc`
   - `chat.streamingError`

### Verification
- Lint check passes clean (`bun run lint` — no errors)
- Dev server running and serving pages

## Stage Summary
- **SSE streaming**: One-on-one chat now streams LLM responses in real-time, with typing indicator → streaming content → final message flow
- **Backward compatible**: Non-SSE clients still get synchronous JSON responses
- **Confirmation dialogs**: 4 destructive actions now have proper confirmation dialogs (delete provider, delete job, delete file, delete conversation)
- **Full i18n**: All new dialog text translated to all 8 locales
