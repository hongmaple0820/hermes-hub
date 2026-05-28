# Task 9-b: Agent SDK Builder

## Task
Build the @hermes-hub/agent-sdk npm package for the Hermes Hub multi-agent collaboration platform.

## Changes Made

### 1. /packages/agent-sdk/package.json
- Package name: @hermes-hub/agent-sdk v0.1.0
- Dependencies: socket.io-client ^4.7.0, eventemitter3 ^5.0.1
- Exports: main (index.js), types (index.d.ts), ./types

### 2. /packages/agent-sdk/types.js
- JSDoc type definitions for all SDK types
- CAPABILITY_CATEGORIES constant (8 categories)
- DEFAULTS constant (wsUrl, heartbeatInterval, invocationTimeout, etc.)
- Events enum (connected, disconnected, invocation, command, error, heartbeat, reconnecting, chat:message)
- SocketEvents enum (matched to actual skill-ws server event names)

### 3. /packages/agent-sdk/hermes-agent.js (~470 lines)
- HermesAgent class extending EventEmitter
- Constructor with config validation and capability registration
- start() / stop() lifecycle methods
- sendResult(), addCapability(), removeCapability(), getStatus()
- sendStatus(), sendEvent(), sendChatMessage(), acknowledgeCommand()
- Auto-reconnect with exponential backoff (1s→30s, 10 max retries)
- Auto-invocation handling with configurable timeout
- Heartbeat every 15s by default
- Graceful shutdown on SIGINT/SIGTERM

### 4. /packages/agent-sdk/index.js
- Main entry point exporting HermesAgent, Events, SocketEvents, CAPABILITY_CATEGORIES, DEFAULTS

### 5. /packages/agent-sdk/index.d.ts (~250 lines)
- Full TypeScript type definitions
- All interfaces: Capability, HermesAgentConfig, Event types, AgentStatus
- HermesAgent class with typed methods and event overloads

### 6. /packages/agent-sdk/examples/
- simple-agent.js: Minimal greet capability
- multi-capability-agent.js: 6 capabilities across categories
- chat-agent.js: Chat response with auto-reply
- hermes.config.js: Config file template

### 7. /packages/agent-sdk/README.md
- Quick start, config table, events, capability format, API methods, architecture diagram

### 8. eslint.config.mjs
- Added "packages/**" to ignores (agent-sdk is standalone CommonJS package)

## Key Design Decisions
- Event names match the **actual skill-ws server implementation** (agent:register, capability:invoke, etc.) rather than the spec's acrp:* naming
- Auto-invocation uses setImmediate() to allow manual override via invocation.handle()
- Reconnect uses exponential backoff with jitter for thundering herd prevention
- Handler timeout with Promise.race pattern
- SDK is CommonJS for maximum Node.js compatibility

## Verification
- `bun install` succeeds in packages/agent-sdk/
- Import test passes: all exports present and correct types
- Constructor, validation, add/remove, event emitter tests all pass
- `bun run lint` passes clean (0 errors)
