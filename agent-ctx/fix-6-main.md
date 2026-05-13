# Task fix-6: Add Session Persistence and Improve Authentication

## Task Summary
Add session persistence to the ApiClient so auth state survives page refreshes, and improve server-side authentication validation.

## Changes Made

### 1. `/home/z/my-project/src/lib/api-client.ts`
- Added `persistAuth()`, `restoreAuth()`, `clearPersistedAuth()` private methods for localStorage persistence
- Modified `setUserId()` to auto-persist to localStorage key `hermes-auth-user-id`
- Added `logout()` method that clears both in-memory userId and localStorage
- Added `tryRestoreAuth()` method to restore from localStorage on page load
- Added `getAuthMe()` method as alias for `/api/auth/me` endpoint

### 2. `/home/z/my-project/src/app/page.tsx`
- Replaced synchronous localStorage-only session check with async server-validated flow
- On mount: `api.tryRestoreAuth()` → `api.getAuthMe()` → validate or clear
- Added backward-compatible migration from legacy `hermes_token`/`hermes_user` keys
- Updated `handleLogout` to use `api.logout()` instead of `api.setUserId('')`

### 3. `/home/z/my-project/src/lib/auth.ts`
- Extracted `extractUserId()` as standalone sync function
- Refactored `requireAuth` to explicitly validate user exists in database via `db.user.findUnique()`
- Stale/invalid userIds are now rejected even without JWT

## Verification
- `bun run lint` passes clean
- Dev server logs show `/api/auth/me` returning 200 for valid sessions
