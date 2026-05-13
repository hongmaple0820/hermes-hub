# Task 6-features: Add System Health Monitor & Keyboard Shortcuts Help

## Task Summary
Added two new features to the Hermes Hub project:
1. **System Health Monitor** on Dashboard - real-time service health checks
2. **Keyboard Shortcuts Help Modal** - comprehensive shortcut reference

## Files Modified

### Task 1: System Health Monitor

**Dashboard.tsx** (`src/components/views/Dashboard.tsx`):
- Added `ServiceHealth` interface with id, name, port, online, uptime, responseTime, lastChecked, checking fields
- Added `serviceHealths` state array for 5 services: Next.js, Chat Service, Skill WebSocket, Terminal Service, Database
- Added `checkServiceHealth()` callback that fetches `/api/health?XTransformPort={port}` for each service
- Added auto-refresh via `useEffect` with 30-second interval
- Added `healthyCount`, `unhealthyCount`, `allHealthy` computed values
- Added `formatUptime()` helper
- Replaced the existing mock System Health card with real-time service health monitor showing:
  - Green/red/amber status dots with pulse animation for healthy services
  - Service name and port
  - Response time and uptime from health endpoints
  - "Checking...", "Healthy", "Down" status badges
  - "All Healthy" / "X Issues" overall badge
  - Manual refresh button
  - Last checked timestamp
  - Legacy system indicators (LLM Providers, ACRP Agents, Skills Active)

**Health API** (`src/app/api/health/route.ts`):
- Created new GET endpoint returning status, service, port, uptime

**Chat Service** (`mini-services/chat-service/index.ts`):
- Added `/health` HTTP handler to the existing httpServer
- Returns status, service name, port, connectedUsers, activeRooms, uptime

**Terminal Service** (`mini-services/terminal-service/index.ts`):
- Added HTTP server alongside WebSocket for `/health` endpoint
- Returns status, service name, port, connectedClients, uptime
- Changed WebSocketServer to use the httpServer instead of direct port binding

### Task 2: Keyboard Shortcuts Help Modal

**KeyboardShortcutsHelp.tsx** (`src/components/shared/KeyboardShortcutsHelp.tsx`):
- New component using shadcn/ui Dialog
- Shows navigation shortcuts (⌘1-8) and action shortcuts (⌘K, ⌘,, ⌘/, Esc)
- Renders keyboard keys with styled `<kbd>` elements
- Supports Mac (⌘) and non-Mac (Ctrl+) display
- Two sections: Navigation and Actions with icons
- Footer showing modifier key hint

**page.tsx** (`src/app/page.tsx`):
- Added `keyboardHelpOpen` state
- Registered ⌘/ keyboard shortcut to toggle help dialog
- Added KeyboardShortcutsHelp component to render tree
- Passed `onOpenKeyboardHelp` callback to Sidebar

**Sidebar.tsx** (`src/components/layout/Sidebar.tsx`):
- Added `HelpCircle` icon import
- Added `onOpenKeyboardHelp` optional prop to SidebarProps
- Added "?" button in sidebar footer (between Language Switcher and User section)
- Shows tooltip with "Keyboard Shortcuts ⌘/" in collapsed mode
- Shows full button with icon, text, and shortcut in expanded mode

**Settings.tsx** (`src/components/views/Settings.tsx`):
- Added `Keyboard` icon import
- Added keyboard shortcuts reference link in System Info card (About tab)
- Shows keyboard icon, title, description, and ⌘/ badge

### i18n Keys

All 8 locale files updated (`en.json`, `zh.json`, `ja.json`, `ko.json`, `de.json`, `es.json`, `fr.json`, `pt.json`):

**Dashboard keys added:**
- `services`, `allHealthy`, `issuesFound`, `responseTime`, `uptime`, `lastChecked`
- `serviceNextjs`, `serviceChat`, `serviceSkillWs`, `serviceTerminal`, `serviceDatabase`
- `checking`, `healthy`, `unhealthy`

**Keyboard keys added (new `keyboard` section):**
- `title`, `navigation`, `actions`, `shortcuts`, `description`
- `openCommandPalette`, `openSettings`, `openHelp`, `closeDialog`, `switchView`
- `nav1` through `nav8`

## Lint Status
All lint checks pass clean.
