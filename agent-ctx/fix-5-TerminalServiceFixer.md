# Task fix-5: Terminal Service User Isolation & Authentication

## Agent: TerminalServiceFixer

## Summary
Fixed 4 security vulnerabilities in the terminal service (`/home/z/my-project/mini-services/terminal-service/index.ts`):
1. Per-user filesystem isolation
2. WebSocket authentication via HTTP upgrade
3. ReDoS fix in find command
4. Session authorization (ownership verification)

## Changes Made

### File Modified
- `/home/z/my-project/mini-services/terminal-service/index.ts` — Complete rewrite with security fixes

### Key Changes

1. **Per-user filesystem isolation**:
   - Replaced global `const filesystem = buildInitialFilesystem()` with `Map<string, VFSNode>` (`userFilesystems`)
   - Added `cloneVFS()` for deep-cloning VFSNode trees
   - `getFilesystemForUser(userId)` lazily creates cloned filesystem per user
   - All command functions now take `fs: VFSNode` as explicit parameter

2. **WebSocket authentication**:
   - Added `verifyClient` callback to `WebSocketServer`
   - Validates token via `GET http://localhost:3000/api/auth/me`
   - Rejects connections without valid token with code `4001`

3. **ReDoS fix**:
   - `find` command now escapes regex metacharacters before wildcard replacement
   - Old: `namePattern.replace(/\*/g, '.*').replace(/\?/g, '.')`
   - New: `namePattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.')`

4. **Session authorization**:
   - Added `userId` field to `TerminalSession`
   - `switch` and `close` handlers verify `session.userId === client.userId`
   - Unauthorized access attempts logged and denied

## Verification
- Lint check passes clean
- Service starts correctly on port 3005
- Health endpoint returns `activeUsers` count
