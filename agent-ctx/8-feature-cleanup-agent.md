# Task 8: Feature Cleanup & Mock Skills Replacement

## Summary
Completed all tasks: hid unavailable features from navigation with Settings toggle, replaced mock skills with real LLM-powered implementations, and marked truly unavailable skills as "Coming Soon".

## Changes Made

### Part A: Advanced Features (Hidden from Sidebar)
- Added `advancedFeatures` state to Zustand store
- Added "Advanced" tab in Settings with toggle switches for 9 hidden features
- Sidebar dynamically shows/hides advanced features based on localStorage preferences
- Features: ACRP Control, Terminal, Files, Logs, Profiles, Channels, Jobs, Memory, Session Search

### Part B: Skill Status & Mock Replacements
- **Replaced with LLM-powered**: weather-query, document-processing, data-analysis
- **Marked Coming Soon**: email-sender, database-query, reminder
- **Added SKILL_STATUS_MAP**: exported constant for UI badge rendering
- **AgentPanel UI**: Coming Soon (amber) + Beta (violet) badges, disabled toggles, tooltips

### Lint Result
0 errors, 1 pre-existing warning
