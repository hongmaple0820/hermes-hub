# Task 2-b: Navigation Simplification Agent

## Summary
Simplified sidebar navigation from 18 items across 4 sections to 5 core items in a single "Core" section, and made Chat the default home view.

## Changes Made

### 1. `/src/lib/store.ts`
- **ViewMode type**: Reorganized into Core (chat, agents, agent-detail, workflows, analytics, settings) and Legacy (all previous views still renderable)
- **Default view**: Changed from `'dashboard'` to `'chat'`
- **New state**: Added `needsQuickStart: boolean` and `setNeedsQuickStart` setter

### 2. `/src/components/layout/Sidebar.tsx`
- **Nav sections**: Replaced 4-section 18-item layout with single "core" section containing 5 items:
  - Chat (⌘1) - MessageSquare icon
  - Agents (⌘2) - Bot icon
  - Workflows (⌘3) - Workflow icon
  - Analytics (⌘4) - BarChart3 icon
  - Settings (⌘5) - Settings icon
- **Section labels**: Updated to `core → sidebar.sectionCore`
- **Imports**: Removed unused icons (LayoutDashboard, Server, Puzzle, Users, Radio, Clock, UserCircle, Brain, ScrollText, Folder, Terminal, Monitor)
- **Preserved**: All styling, animations, favorites, resize, collapse functionality

### 3. `/src/app/page.tsx`
- **Keyboard shortcuts**: Updated viewMap to ⌘1→chat, ⌘2→agents, ⌘3→workflows, ⌘4→analytics, ⌘5→settings
- **Analytics view**: Added `case 'analytics': return <Dashboard />;` in renderView()
- **Legacy views**: All 14+ legacy view cases preserved and functional

### 4. i18n Updates
- **en.json**: Added `nav.analytics` ("Analytics"), `sidebar.sectionCore` ("Core")
- **zh.json**: Added `nav.analytics` ("分析"), `sidebar.sectionCore` ("核心")

## Verification
- Lint: 0 errors, 1 pre-existing warning (unrelated file)
- Dev server: Running normally, all pages compile
- No breaking changes to existing views or functionality
