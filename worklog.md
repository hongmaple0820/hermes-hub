# Hermes Hub - Worklog

## Project Overview
Hermes Hub is a multi-agent collaboration platform rebuilt from scratch to address critical issues in the original project:
1. **Multi-provider LLM support** (OpenAI, Anthropic, Google, Ollama, Z-AI, Custom)
2. **Standardized skill/plugin system** (inspired by Feishu/DingTalk bot patterns)
3. **Hermes Agent direct connection** (gateway management, health monitoring)

---
Task ID: 1
Agent: main
Task: Research and analyze hermes-hub and hermes-web-ui projects

Work Log:
- Researched https://github.com/hongmaple0820/hermes-hub (original project)
- Researched https://github.com/EKKOLearnAI/hermes-web-ui/ (reference project)
- Identified critical issues: single LLM provider, no runtime skills, no hermes-agent management
- Designed new architecture addressing all three issues

Stage Summary:
- Original project locked into z-ai-web-dev-sdk only
- Skills were static markdown, not executable plugins
- hermes-web-ui provides gateway management pattern worth referencing
- BFF pattern, multi-profile gateway management, and skill browsing are key features to adopt

---
Task ID: 2-a
Agent: main
Task: Design database schema and build backend API

Work Log:
- Created comprehensive Prisma schema with 16 models
- Built 26 API route files covering all endpoints
- Implemented multi-provider LLM abstraction layer
- Created agent reply logic with skill integration
- Seeded 12 default skills (Feishu/DingTalk pattern)
- All routes tested and working

Stage Summary:
- Database: SQLite with Prisma, 16 models
- LLM Providers: OpenAI, Anthropic, Google, Ollama, Z-AI, Custom
- Skills: 12 built-in skills with install/uninstall workflow
- Hermes: Gateway CRUD + start/stop/health endpoints
- Chat: Conversations + messages + agent reply
- Auth: Simple token-based (x-user-id header)

---
Task ID: 2-b
Agent: chat-service-builder
Task: Build Socket.IO chat service

Work Log:
- Created mini-service at mini-services/chat-service/
- Implemented Socket.IO server with full event handling
- Agent reply integration with 3 modes (builtin, custom_api, hermes)
- Service running on port 3003

Stage Summary:
- Chat service running on port 3003
- Events: chat, agent, presence, room
- Agent modes: builtin (OpenAI-compatible streaming), custom_api (callback URL), hermes (gateway)

---
Task ID: 3
Agent: main
Task: Build complete frontend UI

Work Log:
- Created Zustand store for global state management
- Built API client with all endpoint methods
- Created auth page (login/register)
- Created sidebar navigation with collapse support
- Created Dashboard view with stats and quick actions
- Created AgentManager with create/delete/configure workflows
- Created AgentDetail with skills/connections/plugins tabs
- Created ProviderManager with multi-provider support (6 provider types)
- Created SkillMarketplace with search/filter/install
- Created HermesManager with gateway start/stop/health monitoring
- Created ChatView with conversation list and real-time messaging
- Created ChatRoomManager for multi-agent rooms
- Created Settings page
- All lint checks passing

Stage Summary:
- Full SPA with sidebar navigation
- 9 view components covering all features
- Responsive design with shadcn/ui components
- 12 skills seeded in marketplace
- All API endpoints functional

---
Task ID: 4
Agent: main
Task: Implement global internationalization (i18n) with language switching

Work Log:
- Created 4 locale files: zh.json, en.json, ja.json, ko.json with complete translations
- Created I18nProvider with React Context (src/i18n/index.tsx)
- Implemented useI18n hook with t(key, params?) function supporting interpolation
- Added lazy locale loading with caching
- Locale persisted to localStorage
- Added language switcher to Sidebar (Popover with checkmarks)
- Added language switcher to Auth page (top-right corner)
- Updated all 9 view components: Dashboard, AgentManager, AgentDetail, ProviderManager, SkillMarketplace, HermesManager, ChatView, ChatRoomManager, Settings
- Updated Sidebar and AuthPage with i18n
- Fixed lint error: replaced useEffect+setState with lazy initializer for locale
- All lint checks passing

Stage Summary:
- 4 languages supported: 中文, English, 日本語, 한국어
- Translation keys: 200+ keys across 12 namespaces (common, auth, nav, dashboard, agents, agentDetail, providers, skills, hermes, chat, chatRooms, settingsPage, language)
- Language switcher in sidebar + auth page
- Default language: 中文 (zh)
- Locale saved to localStorage for persistence

---
Task ID: 2-a (continued)
Agent: backend-api-builder
Task: Build extended backend API routes (Channels, Jobs, Profiles, Memory, Usage, Logs, Files, Settings, Search, Seed)

Work Log:
- Created Channels API: GET/POST /api/channels, GET/PATCH /api/channels/[platform]
- Created Jobs API: GET/POST /api/jobs, GET/PATCH/DELETE /api/jobs/[id], POST /api/jobs/[id]/pause|resume|run
- Created Profiles API: GET/POST /api/profiles, GET/PATCH/DELETE /api/profiles/[id], POST /api/profiles/switch|import, POST /api/profiles/[id]/export
- Created Memory API: GET/POST /api/memory (with auto-create default sections for agent)
- Created Usage API: GET /api/usage (with period filtering, model breakdown, daily trend), GET /api/usage/[sessionId]
- Created Logs API: GET /api/logs (with type/level/since/limit filters), GET /api/logs/[name]
- Created Files API: GET /api/files/list, GET /api/files/read, PUT /api/files/write, DELETE /api/files/delete, POST /api/files/rename|mkdir|upload
- Created Settings API: GET/PATCH /api/settings (grouped by section, upsert support)
- Created Search API: GET /api/search/sessions (keyword search across conversations with grouped results)
- Created Seed Channels API: POST /api/seed/channels (8 platform defaults: telegram, discord, slack, whatsapp, matrix, feishu, wechat, wecom)
- All 22 new route files follow existing project patterns (requireAuth, db, error handling)
- Lint check passes with zero errors
- Database schema already in sync

Stage Summary:
- 22 new API route files created across 10 endpoint groups
- Auth: Uses requireAuth from @/lib/auth (x-user-id / Authorization: Bearer headers)
- Consistent error handling with proper status codes (400, 401, 403, 404, 409)
- JSON field handling: All JSON fields (config, skills, deliveryTarget, envStatus, etc.) properly serialized/deserialized
- Files API supports virtual file system with directory tree operations
- Usage API provides rich analytics: model breakdown, daily trend, session totals
- Memory API auto-creates default sections (memory, user, soul) if missing

---
Task ID: 2-b
Agent: frontend-view-builder
Task: Create 9 new frontend view components and update store/i18n/integration

Work Log:
- Created ChannelsView.tsx: 8 platform channels (Telegram, Discord, Slack, WhatsApp, Matrix, Feishu, WeChat, WeCom) with per-platform config forms, status badges, enable/disable toggles, save actions
- Created JobsView.tsx: Scheduled job management with create dialog (name, description, prompt, cron schedule, agent selection, model override, repeat limit), quick schedule presets, per-job pause/resume/delete/run-now actions, status indicators
- Created UsageView.tsx: Usage analytics with 4 stat cards (input tokens, output tokens, estimated cost, sessions), model usage CSS bar chart, 30-day daily trend CSS bar chart, period selector tabs (7/30/90 days), cache hit rate display, cost status indicator
- Created ProfilesView.tsx: Multi-profile management with card list, active profile indicator, create/clone dialog, import (paste JSON or file upload), export, switch/delete actions, .env/soul.md status badges
- Created MemoryView.tsx: Agent memory editor with agent selector, 3 tabs (Memory/User Profile/Soul), textarea editing, save per section, last modified timestamp, character count, info descriptions per section
- Created LogsView.tsx: Log viewer with 4 log type tabs (Agent/Gateway/Error/Access), level filter buttons with colored badges (All/Debug/Info/Warn/Error), search input, expandable metadata JSON, auto-scroll toggle, limit selector (50/100/200), clear/refresh buttons
- Created FilesView.tsx: File browser with breadcrumb navigation, file/folder table (name/size/type/modified), click-to-navigate folders, file editor dialog, upload/new file/new folder/rename/delete actions, backend selector (Local/Docker/SSH/Singularity)
- Created TerminalView.tsx: Simulated web terminal with dark background/monospace/green text, connect/disconnect, command history (arrow keys), simulated command responses, clear button, status indicator
- Created SessionSearch.tsx: Global search modal (Ctrl+K shortcut), search input with debounced API calls, keyboard navigation (arrow keys + Enter), results list with conversation name/agent/message preview/date, click to navigate to chat
- Updated store.ts: Added 8 new ViewMode types (channels, jobs, usage, profiles, memory, logs, files, terminal) and new state slices (channels, jobs, profiles, activeProfileId) with setters
- Updated all 4 locale files (en.json, zh.json, ja.json, ko.json): Added 9 new translation namespaces (channels, jobs, usage, profiles, memory, logs, files, terminal, search) with ~150+ new keys each, plus nav section updates
- Updated page.tsx: Added imports and route cases for all 9 new views, added SessionSearch component
- Updated Sidebar.tsx: Reorganized navigation into 4 sections (main, communication, management, system) with all new nav items, added section headers for non-collapsed mode
- Lint check passes with zero errors

Stage Summary:
- 9 new view components created in /src/components/views/
- All components use useI18n() t() function for translations
- All components use api methods from /src/lib/api-client
- All components use shadcn/ui components and Lucide icons
- Consistent coding patterns matching existing views
- Full i18n support in 4 languages (zh, en, ja, ko) with 150+ new translation keys
- Sidebar reorganized into 4 sections for better navigation with growing feature set
- SessionSearch provides Ctrl+K global search across conversations

---
Task ID: 5
Agent: view-enhancer
Task: Enhance existing views to match hermes-web-ui functionality

Work Log:
- Created MarkdownRenderer component at src/components/shared/MarkdownRenderer.tsx
  - Regex-based markdown parser with support for headers, bold, italic, strikethrough, code blocks, inline code, links, lists, blockquotes, horizontal rules, tables
  - Code blocks with language labels, copy button, and monospace styling
  - No external markdown library needed

- Enhanced ChatView.tsx with Conversations/Rooms tab toggle
  - ConversationsPanel: existing 1-on-1 chat with agents (unchanged functionality)
  - RoomsPanel: new multi-agent chat room messaging UI
    - Room list with create/delete
    - Room message view with real-time updates via Socket.IO (port 3003)
    - @mention autocomplete for agents in the room
    - Typing indicators for agents
    - "Back to rooms" button in room header
    - Uses Socket.IO events: room:join, room:leave, room:message, agent:typing, agent:stream-complete
  - Both panels use MarkdownRenderer for agent messages

- Enhanced AgentManager.tsx with Edit functionality
  - Edit button on each agent card (via dropdown menu + inline button)
  - Edit dialog pre-filled with agent's current data
  - Allows updating: name, description, systemPrompt, mode (disabled), provider, model, temperature, maxTokens, callbackUrl, apiKey, isPublic
  - Uses api.updateAgent(id, data) for saving
  - Success/error toast notifications

- Enhanced ProviderManager.tsx with Edit functionality
  - Edit button on each provider card (via dropdown menu + inline edit icon)
  - Edit dialog pre-filled with provider's current data
  - Allows updating: name, provider type (disabled), apiKey, baseUrl, defaultModel, isActive
  - Uses api.updateProvider(id, data) for saving
  - Success/error toast notifications

- Enhanced Settings.tsx with 8 sub-section tabs
  - Display Tab: streaming, compact mode, reasoning display, cost display, busy input mode, bell on complete
  - Agent Tab: max turns, gateway timeout, restart drain timeout
  - Memory Tab: enable memory, user profile char limit, memory char limit
  - Session Reset Tab: mode selector (idle/scheduled), idle minutes, reset hour
  - Privacy Tab: PII redaction toggle
  - Model Tab: default provider selector, default model input
  - Platform Tab: linked channel cards with status
  - Account Tab: username edit, password change, sign out
  - Uses api.getSettings() and api.updateSettings() for persistence
  - SettingRow component with label, description, and input/toggle

- Updated i18n locale files (en.json, zh.json, ja.json, ko.json)
  - Added 80+ new translation keys across chat, agents, providers, settingsPage, and markdown namespaces
  - All 4 languages fully translated

- All lint checks passing with zero errors

Stage Summary:
- MarkdownRenderer: regex-based parser, no external deps, code block copy support
- ChatView: Conversations/Rooms tabs, Socket.IO real-time messaging, @mention autocomplete, typing indicators
- AgentManager: Full CRUD (create, read, update, delete) with edit dialog
- ProviderManager: Full CRUD with edit dialog and isActive toggle
- Settings: 8 tabbed sub-sections with api persistence via getSettings/updateSettings
- i18n: 80+ new keys in 4 languages (zh, en, ja, ko)

---
Task ID: 4
Agent: i18n-locale-adder
Task: Add 4 more i18n locale files (de, es, fr, pt)

Work Log:
- Created de.json (German) locale file with full translations across all 17 namespaces (common, auth, nav, dashboard, agents, agentDetail, providers, skills, hermes, chat, chatRooms, settingsPage, language, channels, jobs, usage, profiles, memory, logs, files, terminal, search, markdown)
- Created es.json (Spanish) locale file with full translations
- Created fr.json (French) locale file with full translations
- Created pt.json (Portuguese) locale file with full translations
- Updated src/i18n/index.tsx: Extended Locale type to include 'de' | 'es' | 'fr' | 'pt', added 4 new entries to AVAILABLE_LOCALES array
- Updated language section in all 8 locale files (zh, en, ja, ko, de, es, fr, pt) to include de/es/fr/pt labels so language switcher shows correct names in all locales
- Lazy loading mechanism in I18nProvider already supports dynamic import for any locale code matching a JSON file — no changes needed to the loading logic
- Lint check passes with zero errors

Stage Summary:
- 8 languages now supported: 中文, English, 日本語, 한국어, Deutsch, Español, Français, Português
- 4 new locale files: de.json, es.json, fr.json, pt.json — all with proper native language translations
- All translation keys: 200+ keys across 17+ namespaces per locale
- Language switcher automatically shows all 8 languages
- Lazy loading and caching work for all new locales without code changes
