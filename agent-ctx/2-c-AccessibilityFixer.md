# Task 2-c: Accessibility Fixes

## Summary
Fixed accessibility issues across the Hermes Hub project: Sidebar ARIA labels, Dialog descriptions, Stop Streaming button, and Focus ring styles.

## Changes Made

### 1. Sidebar Accessibility (Sidebar.tsx)
- Added `aria-label` and `title` to: nav buttons, toggle button, collapse-all button, section toggles, language switcher, keyboard help button, logout button, unpin button
- 8 new i18n keys added to all 8 locales

### 2. Dialog Accessibility (5 files)
- Added `<DialogDescription className="sr-only">` to 7 dialogs missing it:
  - AgentManager: create + edit
  - ChatView: new chat + delete conversation
  - ProviderManager: create + edit
  - SkillMarketplace: skill detail

### 3. Stop Streaming Button (ChatView.tsx)
- Added Square icon import
- Stop button appears next to Send when streaming=true
- Aborts stream, resets state
- 1 new i18n key added to all 8 locales

### 4. Focus Ring Styles (globals.css)
- Added `:focus-visible` style with 2px primary outline
- Added `:focus:not(:focus-visible)` to remove outline for mouse users

## Verification
- `bun run lint` passes clean
- Dev server running without errors
