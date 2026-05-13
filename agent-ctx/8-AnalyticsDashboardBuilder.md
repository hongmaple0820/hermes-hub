# Task 8: Analytics Dashboard Builder

## Task
Add real analytics API endpoints and replace Dashboard mock data with live data

## Work Summary

### API Endpoint
- Created `/home/z/my-project/src/app/api/analytics/dashboard/route.ts`
- GET /api/analytics/dashboard with requireAuth
- Returns: agents stats, conversations per day (7 days), messages per day (7 days), providers, skills, chatRooms

### API Client
- Added `getDashboardAnalytics()` to api-client.ts with full TypeScript types

### Dashboard.tsx Changes
- Replaced mock convsPerDay (random data) with real analytics API data
- Added Messages per Day chart (rose-colored bars)
- Replaced hardcoded systemUptime (99.9%) with computed from service health
- Replaced hardcoded agentResponseTime (1.2s) with computed from service response times
- Removed unused systemHealth object
- Changed quickStats "Total Conversations" → "Total Messages"
- Updated sparklines to use real data
- Analytics row changed from 3-col to 4-col grid
- Auto-refreshes every 30 seconds

### i18n
- Added dashboard.messagesPerDay and dashboard.totalMessages to all 8 locales

### Files Changed
- `/home/z/my-project/src/app/api/analytics/dashboard/route.ts` (new)
- `/home/z/my-project/src/lib/api-client.ts` (added getDashboardAnalytics)
- `/home/z/my-project/src/components/views/Dashboard.tsx` (major updates)
- `/home/z/my-project/src/i18n/locales/en.json`
- `/home/z/my-project/src/i18n/locales/zh.json`
- `/home/z/my-project/src/i18n/locales/ja.json`
- `/home/z/my-project/src/i18n/locales/ko.json`
- `/home/z/my-project/src/i18n/locales/de.json`
- `/home/z/my-project/src/i18n/locales/es.json`
- `/home/z/my-project/src/i18n/locales/fr.json`
- `/home/z/my-project/src/i18n/locales/pt.json`

### Verification
- `bun run lint` passes clean
- Dev server running on port 3000
