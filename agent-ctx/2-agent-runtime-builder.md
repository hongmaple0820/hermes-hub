# Task 2: Hermes Agent Runtime v3 with Pi Integration

## Agent: agent-runtime-builder

## Summary
Built the Hermes Agent Runtime v3 as a mini-service at `/home/z/my-project/mini-services/agent-runtime/` with full integration of `@earendil-works/pi-ai` and `@earendil-works/pi-agent-core` packages.

## Files Created

1. **`package.json`** — Project config with socket.io, pi-ai, pi-agent-core dependencies
2. **`types.ts`** — Shared types for backward compatibility (chat events, agent events) + new Pi integration types (ExecuteRunRequest, RunStatus, StepInfo, LLMProviderConfig, etc.)
3. **`provider-adapter.ts`** — Maps LLMProvider DB model to pi-ai's getModel(). Handles API key management via env vars, custom baseUrl support, static provider listing, and lazy model loading with caching.
4. **`tool-adapter.ts`** — Maps Tool/AgentTool DB models to pi-agent-core's AgentTool interface. Supports builtin, http, and websocket handler types. Converts legacy AgentSkillConfig objects for backward compatibility.
5. **`builtin-tools.ts`** — 5 built-in tools in pi AgentTool format: web_search, calculator, file_read, file_write, http_request. Uses TypeBox schemas from pi-ai's Type utility.
6. **`runtime.ts`** — Core Runtime Engine v3 using pi-agent-core's Agent class. Handles:
   - Agent creation with pi-ai model, tools, system prompt
   - Event subscription mapping (pi events → Socket.IO events)
   - Steering via agent.steer(), follow-up via agent.followUp(), abort via agent.abort()
   - Legacy agent:message handler for backward compatibility with chat-service
   - Raw OpenAI-compatible streaming fallback when pi-agent-core is unavailable
   - Token tracking and run persistence via Next.js API
7. **`index.ts`** — Main entry point with Socket.IO server + HTTP API on port 3003. Supports:
   - Legacy chat events (chat:join/leave/message/typing, agent:message, presence)
   - New Thread/Run events (thread:join/leave/message, run:cancel/steer/follow-up)
   - Provider discovery events (provider:list, provider:models)
   - HTTP endpoints (GET /internal/health, GET /internal/providers, GET /internal/providers/:provider/models, POST /internal/execute-run, GET /internal/run-status)

## Key Architecture Decisions

1. **Pi-ai initialization**: Called `registerBuiltInApiProviders()` at import time in provider-adapter.ts to ensure pi-ai providers are registered before any getModel() calls.

2. **Static provider data**: Used static provider list instead of calling `getProviders()` at runtime to avoid stability issues with the pi-ai library in the bun environment. Model data is loaded on first request and cached.

3. **Backward compatibility**: All legacy Socket.IO events from chat-service are preserved and bridged to the new runtime. The `agent:message` event handler detects the agent mode and routes to the appropriate handler (builtin → pi-agent-core, custom_api → HTTP callback, hermes → gateway, acrp → skill-ws).

4. **Fallback mechanism**: When pi-agent-core is unavailable, the runtime falls back to raw OpenAI-compatible streaming API calls for builtin mode agents.

5. **API key management**: API keys are dynamically set in process.env before creating pi-ai model objects, and cleaned up after runs complete.

6. **Environment variable handling**: Provider names are mapped to pi-ai provider keys (e.g., "z-ai" → "zai", "custom" → "openai" with OPENAI_BASE_URL override).

## Service Status
- Compiles and starts successfully with bun runtime
- pi-ai and pi-agent-core both available and verified
- Port 3003 (replaces chat-service)
- Note: Process stability in the sandbox environment is affected by pi-ai memory usage; the `bun --hot` dev script handles automatic restarts
