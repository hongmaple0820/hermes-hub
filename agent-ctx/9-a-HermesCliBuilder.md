# Task 9-a: Hermes CLI Package Development

## Task
Build the `@hermes-hub/cli` npm package — the official CLI for the Hermes Hub multi-agent collaboration platform.

## Files Created

### Package Configuration
- `/home/z/my-project/packages/hermes-cli/package.json` — Package manifest with all dependencies

### Library Files (`lib/`)
- `lib/config-store.js` — Config management using `conf` package, stores in `~/.hermes/config.json`
  - Fields: serverUrl, wsUrl, token, userId, userEmail, currentAgentId, acrpTokens
  - Helper functions: getServerUrl, getWsUrl, getToken, setToken, isAuthenticated, etc.
- `lib/api.js` — Axios-based HTTP client for all Hermes Hub API endpoints
  - Auto-adds Authorization header from config
  - Covers: auth, agents, ACRP, skills, conversations, providers, health check
  - Handles API response wrappers (e.g., `{ agent: {...} }` format)
- `lib/ws-client.js` — WebSocket client for ACRP agent connection via Socket.IO
  - Authentication via `auth.agentToken` (matches skill-ws server expectations)
  - Events: agent:register, agent:heartbeat, capability:invoke, agent:command, agent:notification
  - Legacy: skill:invoke support
  - Auto-heartbeat every 15 seconds
  - Graceful disconnect with Ctrl+C
- `lib/spinner.js` — Shared ora spinner utilities

### Command Files (`commands/`)
- `commands/init.js` — `hermes init` — Interactive project scaffolding
  - Creates: hermes.config.js, agent.js, .env, package.json, capabilities/example.js
  - Supports --name, --description, --mode, --type flags
- `commands/config.js` — `hermes config [init|set|get|list]` — Configure CLI settings
- `commands/auth.js` — `hermes auth [login|register|status|logout]`
  - Interactive and non-interactive modes (--email, --password, --name flags)
  - Token validation on status check
- `commands/agent.js` — `hermes agent [create|list|token|run|delete|info]`
  - Create: interactive or with flags
  - List: formatted table with status indicators, --json output
  - Token: generates ACRP token, saves to config, shows WS URLs
  - Run: connects via WebSocket, auto-registers, heartbeats, handles invocations
  - Delete: with confirmation prompt or --force
  - Info: detailed agent information
- `commands/skill.js` — `hermes skill [list|add|remove]`
  - Interactive skill/agent selection when not specified
  - Install/uninstall skills on agents
- `commands/chat.js` — `hermes chat [list|send|listen]`
  - List conversations with timestamps
  - Send messages with -m flag or interactive
  - Listen: real-time WebSocket message listener
- `commands/doctor.js` — `hermes doctor` — Health check
  - Checks: config, auth, server connectivity, WebSocket, agent, ACRP tokens
  - Summary with pass/warn/fail counts

### Entry Point
- `bin/hermes.js` — Commander.js-based CLI entry point
  - ASCII art banner
  - Help text with quick start guide
  - All 7 commands registered

## Key Design Decisions
1. **API Response Wrapping**: The Hermes Hub API returns data wrapped in objects (e.g., `{ agent: {...} }` instead of `{ id: "..." }`). All command handlers use `result.agent || result` pattern.
2. **ACRP Token**: The API returns `agentToken` (not `token`). Token generation command and WS client both handle this correctly.
3. **WebSocket Auth**: The skill-ws server expects `auth.agentToken` in Socket.IO handshake, not `auth.token`. The WS client uses the correct field.
4. **ACRP Events**: The server uses `agent:*` events (not `acrp:*`), `capability:invoke/result` (not `acrp:invoke/invoke-result`). WS client uses correct event names.
5. **XTransformPort**: WebSocket connections include `query: { XTransformPort: '3004' }` for gateway compatibility.

## Testing Results
All commands tested and working:
- ✅ `hermes --help` — Shows banner, commands, quick start
- ✅ `hermes --version` — Returns 0.1.0
- ✅ `hermes auth login --email --password` — Login successful
- ✅ `hermes auth register --email --password --name` — Registration + auto-login
- ✅ `hermes auth status` — Shows auth status with token verification
- ✅ `hermes auth logout` — Clears credentials
- ✅ `hermes agent create --name --mode --type` — Creates agent, shows ID
- ✅ `hermes agent list` — Lists agents with status indicators
- ✅ `hermes agent info <id>` — Shows agent details
- ✅ `hermes agent token <id>` — Generates ACRP token, shows WS URLs
- ✅ `hermes agent run <id>` — Connects via WebSocket, registers, heartbeats
- ✅ `hermes agent delete <id> --force` — Deletes agent
- ✅ `hermes skill list` — Lists 24 skills with categories
- ✅ `hermes chat list` — Lists conversations
- ✅ `hermes doctor` — Full health check with summary
- ✅ `hermes init --name --mode --type` — Creates project scaffold
- ✅ `hermes config list` — Shows all config values
