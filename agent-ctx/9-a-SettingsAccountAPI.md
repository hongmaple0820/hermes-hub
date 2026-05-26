# Task 9-a: Settings Username Change + Password Change API

## Agent: SettingsAccountAPI

## Summary
Implemented real backend API endpoints for Settings page username and password changes, replacing the previous stub implementation that just called `api.updateSettings()`.

## Files Created
- `/home/z/my-project/src/app/api/auth/change-username/route.ts` - POST endpoint for username changes
- `/home/z/my-project/src/app/api/auth/change-password/route.ts` - POST endpoint for password changes

## Files Modified
- `/home/z/my-project/src/lib/api-client.ts` - Added `changeUsername()` and `changePassword()` methods
- `/home/z/my-project/src/components/views/Settings.tsx` - Updated handlers to use real APIs, added confirm password field, loading states
- `/home/z/my-project/src/i18n/locales/en.json` - Added 6 new i18n keys
- `/home/z/my-project/src/i18n/locales/zh.json` - Added 6 new i18n keys

## Key Implementation Details

### Change Username API (`/api/auth/change-username`)
- Uses `requireAuth(request)` for authentication
- Validates username: 2-30 chars, trims whitespace
- Updates `name` field in User model via Prisma
- Returns updated user object

### Change Password API (`/api/auth/change-password`)
- Uses `requireAuth(request)` for authentication
- Validates: both fields required, newPassword >= 6 chars
- Verifies current password with `bcrypt.compare`
- Hashes new password with `bcrypt.hash` (10 rounds)
- Updates `password` field in User model via Prisma

### Frontend Changes
- `handleUsernameSave` now calls `api.changeUsername()` and updates Zustand store
- `handlePasswordChange` now calls `api.changePassword()`, validates confirm password
- Added confirm password field
- Added loading spinners (Loader2 with animate-spin)
- Added disabled state on buttons while saving

## Verification
- `bun run lint` passes on all modified files
- API routes tested with curl: return 401 for unauthenticated requests
- Dev server running correctly
