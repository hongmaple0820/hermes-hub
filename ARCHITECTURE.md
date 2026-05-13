# Hermes Hub — 技术架构文档

> **版本**: 0.2.0  
> **最后更新**: 2025-06-13  
> **仓库**: github.com/hongmaple0820/hermes-hub  
> **架构风格**: 微服务 + SPA 单体前端

---

## 1. 系统架构总览

### 1.1 架构图

```
                          ┌─────────────┐
                          │   Browser   │
                          │  (SPA App)  │
                          └──────┬──────┘
                                 │ HTTP / WebSocket
                                 ▼
                          ┌─────────────┐
                          │    Caddy     │  ← 反向代理 (Port 81)
                          │  Gateway    │     XTransformPort 路由
                          └──────┬──────┘
                 ┌───────────────┼───────────────┐
                 │               │               │
         ┌───────▼──────┐ ┌─────▼──────┐ ┌──────▼───────┐
         │  Next.js App │ │ Chat Svc   │ │ Skill WS    │
         │  (Port 3000) │ │ (Port 3003)│ │ (Port 3004) │
         │              │ │ Socket.IO  │ │ Socket.IO   │
         │ - SSR/SSG    │ │            │ │ + ACRP      │
         │ - API Routes │ └────────────┘ └──────────────┘
         │ - Static     │
         └──────┬───────┘        ┌──────────────┐
                │                │ Terminal Svc │
         ┌──────▼──────┐        │ (Port 3005)  │
         │   SQLite    │        │ WebSocket    │
         │  (Prisma)   │        └──────────────┘
         └─────────────┘
```

### 1.2 服务清单

| 服务 | 端口 | 技术栈 | 职责 |
|------|------|--------|------|
| **Next.js App** | 3000 | Next.js 16 + React 19 | 主应用，SSR/API Routes/静态资源 |
| **Chat Service** | 3003 | Socket.IO (Bun) | 实时聊天消息推送、通知 |
| **Skill WS** | 3004 | Socket.IO (Bun) | 技能 WebSocket 通信、ACRP 协议 |
| **Terminal Service** | 3005 | ws (Bun) | 终端 WebSocket 会话 |
| **Caddy Gateway** | 81 | Caddy | 反向代理，端口路由 |

### 1.3 请求路由规则

Caddy 网关通过 `XTransformPort` 查询参数路由到不同服务：

```
/api/chat?XTransformPort=3003  →  localhost:3003
/api/skill?XTransformPort=3004 →  localhost:3004
/api/terminal?XTransformPort=3005 → localhost:3005
/ (默认)                        →  localhost:3000
```

**前端约束**：
- 禁止使用 `http://localhost:PORT` 绝对路径
- 必须使用相对路径 + `?XTransformPort=PORT` 查询参数
- WebSocket 连接：`io("/?XTransformPort=3003")`

---

## 2. 技术栈

### 2.1 核心框架

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | ^16.1.1 | 全栈框架 (App Router) |
| **React** | ^19.0.0 | UI 库 |
| **TypeScript** | ^5 | 类型安全 |
| **Tailwind CSS** | ^4 | 样式系统 |
| **Prisma** | ^6.11.1 | ORM (SQLite) |

### 2.2 UI 组件

| 技术 | 用途 |
|------|------|
| **shadcn/ui** (New York style) | 40+ 组件库 |
| **Radix UI** | 底层无头组件 |
| **Lucide React** | 图标库 |
| **Framer Motion** | 动画 |
| **Recharts** | 图表 |
| **xterm.js** | 终端仿真 |
| **MDX Editor** | Markdown 编辑器 |
| **react-syntax-highlighter** | 代码高亮 |
| **react-markdown** | Markdown 渲染 |

### 2.3 状态管理与数据

| 技术 | 用途 |
|------|------|
| **Zustand** | 客户端全局状态 |
| **TanStack Query** | 服务端状态管理 |
| **Prisma Client** | 数据库访问 |

### 2.4 实时通信

| 技术 | 用途 |
|------|------|
| **Socket.IO** | 实时聊天、技能协议、ACRP |
| **ws** | 终端 WebSocket |

### 2.5 安全与认证

| 技术 | 用途 |
|------|------|
| **jose** | JWT 签名/验证 (HS256) |
| **bcryptjs** | 密码哈希 |
| **crypto (Node)** | AES-256-GCM 加密 |

### 2.6 AI SDK

| 技术 | 用途 |
|------|------|
| **z-ai-web-dev-sdk** | LLM/VLM/TTS/Image-Gen/Web-Search SDK |

### 2.7 其他

| 技术 | 用途 |
|------|------|
| **next-intl** | 国际化 (8语言) |
| **next-themes** | 亮/暗主题 |
| **react-hook-form + zod** | 表单验证 |
| **cmdk** | 命令面板 |
| **dnd-kit** | 拖拽排序 |
| **uuid** | ID 生成 |

---

## 3. 数据模型

### 3.1 ER 关系图

```
User ─┬── Agent ─┬── AgentSkill ──── Skill
      │          ├── AgentPlugin
      │          ├── AgentConnection
      │          ├── AgentCapability ──── CapabilityInvocation
      │          ├── AgentMemory
      │          ├── Conversation ──── Message
      │          │                 └── ContextSnapshot
      │          ├── UsageRecord
      │          └── Job
      ├── LLMProvider
      ├── Friendship
      ├── ChatRoom ─┬── ChatRoomMember
      │             ├── ChatRoomAgent
      │             ├── ChatRoomMessage
      │             └── ContextSnapshot
      ├── Channel
      ├── Profile
      ├── Workflow ──── WorkflowExecution
      ├── AppSettings
      ├── OAuthToken
      ├── FileEntry
      ├── LogEntry
      ├── UsageRecord
      └── Notification
```

### 3.2 模型详情 (27 个模型)

#### User & Auth

| 模型 | 字段 | 说明 |
|------|------|------|
| **User** | id, email, name, avatar, password(bcrypt), bio, role(user/admin), status(online/offline/busy), createdAt, updatedAt | 用户账号 |
| **Friendship** | id, requesterId, addresseeId, status(pending/accepted/blocked) | 好友关系 |
| **OAuthToken** | id, userId, provider(codex/nous/copilot), accessToken, refreshToken, deviceCode, status(pending/active/expired/revoked) | OAuth 令牌 |

#### LLM Provider

| 模型 | 字段 | 说明 |
|------|------|------|
| **LLMProvider** | id, userId, name, provider(openai/anthropic/google/ollama/custom/z-ai), apiKey(加密), baseUrl, models(JSON), defaultModel, isActive, config(JSON) | LLM 提供商配置 |

#### Agent System

| 模型 | 字段 | 说明 |
|------|------|------|
| **Agent** | id, userId, name, description, avatar, systemPrompt, mode(builtin/acrp), isPublic, status, providerId, model, temperature, maxTokens, callbackUrl, apiKey, agentToken(ACRP), agentType, agentVersion, agentPlatform, agentMetadata(JSON), wsConnected, lastHeartbeatAt | Agent 实体 |
| **AgentCapability** | id, agentId, capabilityId, name, description, category, version, parameters(JSON Schema), uiHints(JSON), isEnabled, invokeCount | ACRP 能力 |
| **CapabilityInvocation** | id, agentId, capabilityId, invokedBy, params(JSON), result(JSON), status(pending/sent/executing/success/failed/timeout), error, duration | 能力调用记录 |

#### Skill/Plugin System

| 模型 | 字段 | 说明 |
|------|------|------|
| **Skill** | id, name(unique), displayName, description, license, compatibility, metadata(JSON), allowedTools, instructions(Markdown), category, icon, configSchema, handlerType(builtin/webhook/function), handlerUrl, parameters(JSON), isEnabled, endpointToken, callbackUrl, protocolVersion, events(JSON), sourceType, sourceUrl, sourcePath | 技能定义 |
| **AgentSkill** | id, agentId, skillId, config(JSON), isEnabled, priority, endpointToken, callbackUrl, lastInvokedAt, invokeCount | Agent↔Skill 绑定 |
| **AgentPlugin** | id, agentId, name, description, type(webhook/function/hermes-protocol), endpoint, config(JSON), authType, authToken(加密), isEnabled, endpointToken, callbackUrl, protocolVersion, events(JSON) | 自定义插件 |
| **AgentConnection** | id, agentId, type, name, config(JSON), status, apiKey, connectionMode(websocket/http/hybrid), wsConnected, wsSocketId | 外部连接 |

#### Chat System

| 模型 | 字段 | 说明 |
|------|------|------|
| **Conversation** | id, type(private/group), name, agentId, parentSessionId, lineage(JSON) | 对话会话 |
| **ConversationParticipant** | id, conversationId, userId, lastReadAt, joinedAt | 对话参与者 |
| **Message** | id, conversationId, content, type(text/image/file/system/tool_call/tool_result), senderId, senderType(user/agent/system), senderName, metadata(JSON) | 消息 |
| **ChatRoom** | id, name, description, isPublic, triggerTokens, maxHistoryTokens, joinCode | 聊天室 |
| **ChatRoomMember** | id, roomId, userId, userName, role(admin/member) | 聊天室成员 |
| **ChatRoomAgent** | id, roomId, agentId, profile(JSON), status | 聊天室 Agent |
| **ChatRoomMessage** | id, roomId, content, type, senderInfo(JSON) | 聊天室消息 |

#### Workflow System

| 模型 | 字段 | 说明 |
|------|------|------|
| **Workflow** | id, userId, name, description, icon, color, nodes(JSON), edges(JSON), trigger(JSON), variables(JSON), timeout, retryPolicy(JSON), errorPolicy, status(draft/active/archived), version | 工作流定义 |
| **WorkflowExecution** | id, workflowId, userId, status(pending/running/completed/failed/cancelled), triggerType, triggerData(JSON), nodeResults(JSON), variables(JSON), finalOutput, startedAt, completedAt, duration, error, failedNodeId | 工作流执行 |

#### Other Models

| 模型 | 说明 |
|------|------|
| **Job** | 定时任务（Cron 表达式、Agent 绑定、投递目标） |
| **Profile** | 多环境配置文件 |
| **AgentMemory** | Agent 记忆（memory/user/soul 三段式） |
| **UsageRecord** | Token 消耗追踪 |
| **LogEntry** | 系统日志 |
| **FileEntry** | 虚拟文件系统 |
| **AppSettings** | 用户设置（8 个 section） |
| **Notification** | 通知（9 种类型） |
| **ContextSnapshot** | 上下文压缩快照 |
| **Channel** | IM 平台通道配置 |

---

## 4. API 设计

### 4.1 API 路由总览 (96 个路由)

#### 认证系统 `/api/auth/`

| 路由 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/auth/register` | POST | 用户注册 | ❌ |
| `/api/auth/login` | POST | 用户登录 | ❌ |
| `/api/auth/logout` | POST | 退出登录 | ✅ |
| `/api/auth/me` | GET | 获取当前用户 | ✅ |
| `/api/auth/refresh` | POST | 刷新 Token | Cookie |
| `/api/auth/change-password` | POST | 修改密码 | ✅ |
| `/api/auth/profile` | GET/PATCH | 用户资料 | ✅ |
| `/api/auth/codex` | POST | Codex OAuth 发起 | ✅ |
| `/api/auth/codex/poll` | POST | Codex 轮询 | ✅ |
| `/api/auth/nous` | POST | Nous OAuth 发起 | ✅ |
| `/api/auth/nous/poll` | POST | Nous 轮询 | ✅ |
| `/api/auth/copilot` | POST | Copilot OAuth 发起 | ✅ |
| `/api/auth/copilot/poll` | POST | Copilot 轮询 | ✅ |

#### Agent 管理 `/api/agents/`

| 路由 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/agents` | GET | 列出用户 Agent | ✅ |
| `/api/agents` | POST | 创建 Agent | ✅ |
| `/api/agents/discover` | GET | 发现公开 Agent | ✅ |
| `/api/agents/collaborate` | POST | 执行协作 | ✅ |
| `/api/agents/collaborate` | GET | 协作历史 | ✅ |
| `/api/agents/[id]` | GET/PATCH/DELETE | Agent CRUD | ✅ |
| `/api/agents/[id]/skills` | GET/POST | Agent 技能列表/安装 | ✅ |
| `/api/agents/[id]/skills/[skillId]` | PATCH/DELETE | 技能配置/卸载 | ✅ |
| `/api/agents/[id]/plugins` | GET/POST | 插件列表/创建 | ✅ |
| `/api/agents/[id]/plugins/[pluginId]` | PATCH/DELETE | 插件配置/删除 | ✅ |
| `/api/agents/[id]/connections` | GET/POST | 连接列表/创建 | ✅ |
| `/api/agents/[id]/connections/[connectionId]` | PATCH/DELETE | 连接配置/删除 | ✅ |
| `/api/agents/[id]/generate-skill-endpoint` | POST | 生成技能端点 | ✅ |

#### ACRP 协议 `/api/acrp/`

| 路由 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/acrp/agents` | GET | ACRP Agent 列表 | AgentToken |
| `/api/acrp/agents/[id]` | GET | ACRP Agent 详情 | AgentToken |
| `/api/acrp/agents/[id]/token` | POST | 获取 Agent Token | ✅ |
| `/api/acrp/agents/[id]/command` | POST | 发送命令 | AgentToken |
| `/api/acrp/agents/[id]/invoke` | POST | 调用能力 | AgentToken |
| `/api/acrp/generate-token` | POST | 生成 ACRP Token | ✅ |
| `/api/acrp/register` | POST | 注册 Agent 能力 | AgentToken |
| `/api/acrp/heartbeat` | POST | 心跳 | AgentToken |
| `/api/acrp/disconnect` | POST | 断开连接 | AgentToken |
| `/api/acrp/validate-token` | POST | 验证 Token | ✅ |
| `/api/acrp/status` | GET | ACRP 状态 | ✅ |
| `/api/acrp/invocations` | GET | 调用记录 | AgentToken |
| `/api/acrp/invocation-result` | POST | 上报调用结果 | AgentToken |

#### LLM 提供商 `/api/providers/`

| 路由 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/providers` | GET/POST | 提供商列表/创建 | ✅ |
| `/api/providers/[id]` | GET/PATCH/DELETE | 提供商 CRUD | ✅ |
| `/api/providers/[id]/test` | POST | 测试连接 | ✅ |
| `/api/providers/[id]/encryption-status` | GET | 加密状态 | ✅ |

#### 聊天系统 `/api/conversations/` & `/api/chat-rooms/`

| 路由 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/conversations` | GET/POST | 对话列表/创建 | ✅ |
| `/api/conversations/[id]` | GET/DELETE | 对话详情/删除 | ✅ |
| `/api/conversations/[id]/messages` | GET/POST | 消息列表/发送 | ✅ |
| `/api/conversations/[id]/lineage` | GET | 对话血缘 | ✅ |
| `/api/conversations/[id]/continue` | POST | 继续对话 | ✅ |
| `/api/chat-rooms` | GET/POST | 聊天室列表/创建 | ✅ |
| `/api/chat-rooms/join` | POST | 加入聊天室 | ✅ |
| `/api/chat-rooms/[id]` | GET/PATCH/DELETE | 聊天室 CRUD | ✅ |
| `/api/chat-rooms/[id]/messages` | GET/POST | 聊天室消息 | ✅ |
| `/api/chat-rooms/[id]/compress` | POST | 压缩聊天室历史 | ✅ |

#### 技能系统 `/api/skills/` & `/api/skill-protocol/`

| 路由 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/skills` | GET/POST | 技能列表/创建 | ✅ |
| `/api/skills/import-skill` | POST | 导入技能 | ✅ |
| `/api/skills/[id]` | GET/PATCH/DELETE | 技能 CRUD | ✅ |
| `/api/skills/[id]/install` | POST | 安装技能 | ✅ |
| `/api/skills/[id]/uninstall` | POST | 卸载技能 | ✅ |
| `/api/skill-protocol/register` | POST | 技能注册 | Token |
| `/api/skill-protocol/heartbeat` | POST | 心跳 | Token |
| `/api/skill-protocol/generate-endpoint` | POST | 生成端点 | ✅ |
| `/api/skill-protocol/validate` | POST | 验证 | Token |
| `/api/skill-protocol/connection-info` | GET | 连接信息 | Token |
| `/api/skill-protocol/events` | GET/POST | 事件 | Token |
| `/api/skill-protocol/ws-status` | GET | WS 状态 | ✅ |

#### 工作流 `/api/workflows/`

| 路由 | 方法 | 描述 | 认证 |
|------|------|------|------|
| `/api/workflows` | GET/POST | 工作流列表/创建 | ✅ |
| `/api/workflows/[id]` | GET/PATCH/DELETE | 工作流 CRUD | ✅ |
| `/api/workflows/[id]/execute` | POST | 执行工作流 | ✅ |
| `/api/workflows/[id]/executions` | GET | 执行记录列表 | ✅ |
| `/api/workflow-executions/[id]` | GET | 执行详情 | ✅ |
| `/api/workflow-executions/[id]/cancel` | POST | 取消执行 | ✅ |
| `/api/workflow-executions/[id]/resume` | POST | 恢复执行 | ✅ |

#### 其他 API

| 路由组 | 描述 |
|--------|------|
| `/api/analytics/*` | 仪表盘数据、概览、技能统计、用量统计 |
| `/api/channels/*` | IM 通道配置 |
| `/api/context/*` | 上下文管理、压缩 |
| `/api/files/*` | 文件 CRUD (list/read/write/mkdir/rename/delete) |
| `/api/jobs/*` | 定时任务管理、手动执行、暂停/恢复 |
| `/api/logs/*` | 日志查看 |
| `/api/memory/*` | Agent 记忆管理 |
| `/api/notifications/*` | 通知管理 |
| `/api/profiles/*` | 配置文件管理、导入/导出、切换 |
| `/api/search/sessions` | 会话搜索 |
| `/api/seed/*` | 种子数据（技能、通道） |
| `/api/settings/*` | 用户设置 |
| `/api/usage/*` | 用量追踪 |
| `/api/health` | 健康检查 |

### 4.2 认证机制

所有需认证的 API 使用 JWT + httpOnly Cookie 双模式：

```
优先级:
1. httpOnly Cookie: hermes_access_token (推荐)
2. Authorization: Bearer <jwt> Header
3. x-user-id Header (已废弃)
4. ?userId= Query (已废弃)
```

JWT 配置：
- 算法: HS256
- Access Token 有效期: 7 天
- Refresh Token 有效期: 30 天
- Cookie: httpOnly, Secure(生产), SameSite=Lax

---

## 5. 核心引擎

### 5.1 工作流引擎 (`workflow-engine.ts`)

```
┌──────────────────────────────────────────────────────┐
│                  WorkflowEngine                       │
├──────────────────────────────────────────────────────┤
│  validate()   → DAG 校验（环检测、节点类型、配置）    │
│  execute()    → 加载工作流 → 拓扑排序 → 逐节点执行   │
│  cancel()     → 取消运行中的执行                      │
│  getStatus()  → 查询执行状态                          │
│  resume()     → 恢复暂停的执行（人工审批后）          │
├──────────────────────────────────────────────────────┤
│  节点执行器:                                          │
│  agent-call     → 调用 Agent 生成回复                 │
│  skill-invoke   → 调用 Agent 技能                     │
│  condition      → 条件表达式判断                      │
│  transform      → 模板变量替换                        │
│  parallel       → 并行执行分支                        │
│  merge          → 合并分支结果                        │
│  http-request   → HTTP API 调用                      │
│  code-exec      → JavaScript 沙盒执行                │
│  human-input    → 暂停等待人工输入                    │
│  delay          → 延时等待                            │
│  sub-workflow   → 调用子工作流                        │
│  loop           → 循环遍历数组                        │
├──────────────────────────────────────────────────────┤
│  模板系统: {{variables.key}} / {{nodes.id.output}}   │
│  条件引擎: JSONPath / Safe JavaScript                │
│  错误策略: stop / skip / fallback                    │
│  重试策略: 指数退避                                  │
│  环检测:   Kahn 拓扑排序 + DFS 环检测                │
└──────────────────────────────────────────────────────┘
```

### 5.2 Agent 协作协议 (`agent-collaboration.ts`)

```
┌─────────────────────────────────────────────┐
│           executeCollaboration()             │
├──────────┬──────────┬───────────┬───────────┤
│ Delegation│ Handoff  │ Broadcast │ Pipeline  │
│ A→B 返回 │ A→B 转交 │ A→多B聚合 │ A→B→C链式 │
├──────────┴──────────┴───────────┴───────────┤
│ Round Robin │ Consensus                      │
│ 轮流发言    │ 投票表决                        │
├─────────────────────────────────────────────┤
│ 聚合: best / merge / vote / first-success   │
│ 投票: majority / unanimous / weighted       │
│ 超时控制 + 错误处理 + 通知推送               │
└─────────────────────────────────────────────┘
```

### 5.3 技能执行器 (`skill-executor.ts`)

```
┌────────────────────────────────────────────────┐
│              Skill Executor                     │
├────────────────────────────────────────────────┤
│ executeSkillsForAgent()  → 按优先级执行技能     │
│ buildToolDefinitions()   → 生成 OpenAI Tool 定义│
│ executeToolChain()       → Agentic Loop 执行    │
│ createLLMCaller()        → 创建 LLM 调用函数    │
├────────────────────────────────────────────────┤
│ 执行模式:                                       │
│ builtin  → 内置处理器 (Z-AI SDK / 沙盒)        │
│ webhook  → HTTP 回调 + 签名验证                │
│ function → HTTP 函数调用                       │
├────────────────────────────────────────────────┤
│ Tool Chain (Agentic Loop):                     │
│ Plan → Execute Tools → Observe → Iterate       │
│ Max 5 iterations, 自动停止                     │
│ 支持 OpenAI Function Calling + 文本解析回退    │
└────────────────────────────────────────────────┘
```

### 5.4 Agent 记忆系统 (`agent-memory.ts`)

```
┌─────────────────────────────────────────────┐
│           MemoryManager                      │
├─────────────────────────────────────────────┤
│ memory  → 长期知识和事实                      │
│ user    → 用户偏好和交互历史                  │
│ soul    → 核心人格和行为准则                  │
├─────────────────────────────────────────────┤
│ getMemory()     → 读取 (带缓存)              │
│ updateMemory()  → 更新                       │
│ appendToMemory() → 追加 (自动去重)           │
│ searchMemory()  → 关键词搜索 (相关度排序)     │
│ compressMemory() → LLM 压缩 / 简单截断       │
│ learnFromInteraction() → 自动学习规则         │
│ buildMemoryContext() → 构建注入上下文          │
└─────────────────────────────────────────────┘
```

### 5.5 Agent 回复引擎 (`agent-reply.ts`)

```
用户消息 → 加载 Agent 配置 → 注入记忆上下文
         → 加载对话历史 → 构建 Tool 定义
         → 调用 LLM (带 Tools)
         → 如果有 Tool Calls → 执行技能 → 将结果注入消息 → 再次调用 LLM
         → 保存消息 → 自动学习 → 返回回复
```

### 5.6 LLM 提供商 (`llm-provider.ts`)

```
┌─────────────────────────────────────────────┐
│           LLM Provider System                │
├─────────────────────────────────────────────┤
│ OpenAI    → https://api.openai.com/v1       │
│ Anthropic → 原生 API                         │
│ Google    → Gemini API                       │
│ Ollama    → http://localhost:11434           │
│ Custom    → 自定义 baseUrl                   │
│ Z-AI      → z-ai-web-dev-sdk                │
├─────────────────────────────────────────────┤
│ chatCompletion()     → 标准聊天补全          │
│ chatCompletionStream() → 流式聊天补全        │
│ API Key 解密 → AES-256-GCM                  │
└─────────────────────────────────────────────┘
```

---

## 6. 安全架构

### 6.1 认证安全

| 层 | 机制 |
|----|------|
| 密码存储 | bcrypt 哈希 |
| Token 签发 | JWT HS256 (jose) |
| Token 存储 | httpOnly Cookie (防 XSS) |
| Token 传输 | SameSite=Lax (防 CSRF) |
| Refresh Token | 独立路径 `/api/auth/refresh` |

### 6.2 数据安全

| 层 | 机制 |
|----|------|
| API Key 加密 | AES-256-GCM (scrypt 派生密钥) |
| API Key 显示 | 前端掩码 `sk-••••••••••abcd` |
| 加密格式 | `iv:authTag:ciphertext` (三段式) |
| 向后兼容 | 未加密的 Key 仍可正常使用 |

### 6.3 速率限制

| 路由 | 限制 |
|------|------|
| 通用 API | 60 次/分钟 |
| 认证 API (`/api/auth/login`, `/api/auth/register`) | 10 次/分钟 |
| 限制维度 | IP + userId |
| 存储方式 | 内存 Map (5分钟自动清理) |

### 6.4 技能协议安全

| 层 | 机制 |
|----|------|
| 端点认证 | endpointToken 唯一令牌 |
| 回调签名 | callbackSecret HMAC 签名 |
| Agent 隔离 | 每个 Agent+Skill 绑定独立 Token |

---

## 7. 前端架构

### 7.1 页面结构

Hermes Hub 采用 **SPA 单页应用** 架构，仅有一个路由 `/`：

```
src/app/page.tsx  →  主 SPA 页面
    └── 根据 Zustand store.currentView 切换视图
```

### 7.2 组件树

```
page.tsx
├── AuthPage (未登录)
│   ├── LoginForm
│   └── RegisterForm
│
└── 已登录布局
    ├── Sidebar (导航)
    ├── View Components (按 currentView 切换)
    │   ├── Dashboard
    │   ├── AgentManager
    │   ├── AgentDetail
    │   ├── AgentControlCenter
    │   ├── ProviderManager
    │   ├── SkillMarketplace
    │   ├── ChatView
    │   ├── ChatRoomManager
    │   ├── WorkflowEditor
    │   ├── ChannelsView
    │   ├── JobsView
    │   ├── UsageView
    │   ├── ProfilesView
    │   ├── MemoryView
    │   ├── LogsView
    │   ├── FilesView
    │   ├── TerminalView
    │   ├── SessionSearch
    │   └── Settings
    └── Shared Components
        ├── NotificationPanel
        └── ConfirmDialog
```

### 7.3 状态管理 (Zustand)

```typescript
AppState {
  // 认证
  user, isAuthenticated
  
  // 导航
  currentView: ViewMode (19种视图)
  selectedAgentId, selectedConversationId, selectedWorkflowId
  
  // 数据缓存
  providers[], agents[], skills[], conversations[], chatRooms[]
  channels[], jobs[], profiles[], workflows[]
  
  // 通知
  notifications[] (支持实时+持久化合并)
  
  // UI 状态
  sidebarCollapsed, showCreateDialog, isLoading
}
```

### 7.4 API 客户端

`src/lib/api-client.ts` 提供统一的 API 调用封装：
- 自动携带 JWT Cookie
- 统一错误处理
- 请求/响应拦截
- 支持 SSE 流式响应

---

## 8. 微服务架构

### 8.1 Chat Service (Port 3003)

```
技术: Socket.IO + Bun (--hot)
协议: WebSocket (Socket.IO)
功能:
  - 实时聊天消息推送
  - 聊天室消息广播
  - 通知实时推送
  - 打字状态指示
  - Agent 在线状态同步
内部端点:
  - POST /internal/notifications (从主应用推送通知)
  - GET /api/health (健康检查)
认证:
  - JWT Cookie 验证 (解密 + 验签)
```

### 8.2 Skill WS Service (Port 3004)

```
技术: Socket.IO + Bun (--hot)
协议: WebSocket (Socket.IO)
功能:
  - 技能 WebSocket 双向通信
  - ACRP (Agent Capability Registration Protocol)
  - Agent 注册/心跳/断开
  - 能力调用和结果上报
  - 事件订阅和推送
认证:
  - Agent Token 验证
  - Endpoint Token 验证
```

### 8.3 Terminal Service (Port 3005)

```
技术: ws + Bun (--hot)
协议: WebSocket (原生)
功能:
  - 终端会话管理
  - PTY 仿真
  - 会话隔离 (按 userId)
  - 输入/输出实时传输
认证:
  - JWT 查询参数验证
```

---

## 9. 部署架构

### 9.1 开发环境

```bash
# 启动所有服务
./start-all.sh

# 或分别启动
bun run dev                      # Next.js :3000
cd mini-services/chat-service && bun run dev    # Chat :3003
cd mini-services/skill-ws && bun run dev        # Skill WS :3004
cd mini-services/terminal-service && bun run dev # Terminal :3005
```

### 9.2 生产构建

```bash
bun run build   # Next.js standalone 构建
# 输出: .next/standalone/
```

### 9.3 数据库

- **引擎**: SQLite (通过 Prisma ORM)
- **文件**: `db/custom.db`
- **迁移**: `bun run db:push` (开发) / `bun run db:migrate` (生产)
- **客户端**: `import { db } from '@/lib/db'` (单例模式)

### 9.4 网关

- **Caddyfile**: 端口 81 对外
- **路由规则**: `XTransformPort` 查询参数路由到内部服务
- **代理头**: 自动添加 Host, X-Forwarded-For, X-Forwarded-Proto, X-Real-IP

---

## 10. 项目结构

```
/home/z/my-project/
├── prisma/
│   └── schema.prisma           # 数据模型定义 (27 模型)
├── db/
│   └── custom.db               # SQLite 数据库文件
├── src/
│   ├── app/
│   │   ├── layout.tsx          # 根布局 (ThemeProvider, 字体)
│   │   ├── page.tsx            # 主 SPA 页面
│   │   ├── globals.css         # 全局样式
│   │   ├── api/                # 96 个 API 路由
│   │   │   ├── auth/           # 认证 (13 路由)
│   │   │   ├── agents/         # Agent 管理 (15 路由)
│   │   │   ├── acrp/           # ACRP 协议 (13 路由)
│   │   │   ├── providers/      # LLM 提供商 (5 路由)
│   │   │   ├── conversations/  # 对话 (5 路由)
│   │   │   ├── chat-rooms/     # 聊天室 (5 路由)
│   │   │   ├── skills/         # 技能 (6 路由)
│   │   │   ├── skill-protocol/ # 技能协议 (7 路由)
│   │   │   ├── workflows/      # 工作流 (7 路由)
│   │   │   ├── analytics/      # 分析 (4 路由)
│   │   │   ├── channels/       # 通道 (2 路由)
│   │   │   ├── context/        # 上下文 (3 路由)
│   │   │   ├── files/          # 文件 (6 路由)
│   │   │   ├── jobs/           # 定时任务 (5 路由)
│   │   │   ├── logs/           # 日志 (2 路由)
│   │   │   ├── memory/         # 记忆 (1 路由)
│   │   │   ├── notifications/  # 通知 (1 路由)
│   │   │   ├── profiles/       # 配置文件 (5 路由)
│   │   │   ├── search/         # 搜索 (1 路由)
│   │   │   ├── seed/           # 种子 (2 路由)
│   │   │   ├── settings/       # 设置 (1 路由)
│   │   │   ├── usage/          # 用量 (2 路由)
│   │   │   └── health/         # 健康检查 (1 路由)
│   │   └── middleware.ts       # (已移除，认证在 API 路由内)
│   ├── lib/
│   │   ├── workflow-engine.ts  # 工作流引擎 (66KB, ~1300行)
│   │   ├── agent-collaboration.ts # 协作协议 (47KB, ~1280行)
│   │   ├── skill-executor.ts   # 技能执行器 (38KB, ~1120行)
│   │   ├── api-client.ts       # API 客户端 (26KB)
│   │   ├── agent-reply.ts      # Agent 回复引擎 (13KB)
│   │   ├── context-engine.ts   # 上下文引擎 (21KB)
│   │   ├── skill-protocol.ts   # 技能协议 (15KB)
│   │   ├── llm-provider.ts     # LLM 提供商 (17KB)
│   │   ├── agent-memory.ts     # 记忆系统 (17KB)
│   │   ├── conversation-lineage.ts # 对话血缘 (5KB)
│   │   ├── rate-limit.ts       # 速率限制 (3KB)
│   │   ├── auth.ts             # 认证工具 (4KB)
│   │   ├── jwt.ts              # JWT 工具 (2KB)
│   │   ├── crypto.ts           # 加密工具 (2KB)
│   │   ├── store.ts            # Zustand Store (6KB)
│   │   ├── db.ts               # Prisma 客户端 (0.3KB)
│   │   └── utils.ts            # 工具函数 (0.2KB)
│   ├── components/
│   │   ├── auth/               # 认证页面
│   │   ├── layout/             # 侧边栏
│   │   ├── views/              # 19 个视图组件
│   │   ├── shared/             # 8 个共享组件
│   │   ├── ui/                 # 40+ shadcn/ui 原语
│   │   └── providers.tsx       # ThemeProvider
│   ├── i18n/
│   │   ├── index.tsx           # i18n 初始化
│   │   └── locales/            # 8 个语言文件
│   └── hooks/                  # use-mobile, use-toast
├── mini-services/
│   ├── chat-service/           # Port 3003, Socket.IO
│   ├── skill-ws/               # Port 3004, Socket.IO + ACRP
│   └── terminal-service/       # Port 3005, WebSocket
├── public/                     # 静态资源
├── Caddyfile                   # Caddy 反向代理配置
├── start-all.sh                # 一键启动脚本
├── next.config.ts              # Next.js 配置
├── tailwind.config.ts          # Tailwind 配置
├── components.json             # shadcn/ui 配置
├── package.json                # 依赖和脚本
└── tsconfig.json               # TypeScript 配置
```

---

## 11. 依赖清单

### 11.1 生产依赖 (60+)

| 类别 | 包 |
|------|------|
| **框架** | next, react, react-dom |
| **ORM** | @prisma/client, prisma |
| **UI** | @radix-ui/* (25+), lucide-react, framer-motion, cmdk, vaul, sonner |
| **终端** | @xterm/xterm, @xterm/addon-fit, @xterm/addon-web-links |
| **编辑器** | @mdxeditor/editor, react-syntax-highlighter, react-markdown |
| **图表** | recharts |
| **拖拽** | @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities |
| **表单** | react-hook-form, @hookform/resolvers, zod |
| **状态** | zustand, @tanstack/react-query, @tanstack/react-table |
| **实时** | socket.io, socket.io-client |
| **安全** | jose, bcryptjs |
| **AI SDK** | z-ai-web-dev-sdk |
| **国际化** | next-intl |
| **主题** | next-themes |
| **工具** | uuid, date-fns, js-yaml, sharp, class-variance-authority, clsx, tailwind-merge |

### 11.2 开发依赖

| 包 | 用途 |
|------|------|
| @tailwindcss/postcss | Tailwind CSS 4 PostCSS 插件 |
| @types/bcryptjs | bcryptjs 类型定义 |
| @types/react, @types/react-dom | React 类型定义 |
| bun-types | Bun 运行时类型 |
| eslint, eslint-config-next | 代码检查 |
| tailwindcss, tw-animate-css | 样式系统 |
| typescript | TypeScript 编译器 |

---

## 12. 关键设计决策

### 12.1 为什么选择 SPA 单页架构？

- 19 个视图无需 URL 路由，通过 Zustand 状态切换
- 减少服务端渲染开销，客户端状态管理更灵活
- 所有 API 通过 `/api/*` 前缀，清晰的前后端分离

### 12.2 为什么使用 SQLite？

- 轻量级部署，无需额外数据库服务
- Prisma ORM 抽象化数据库访问，未来可迁移到 PostgreSQL
- 适合单实例部署和小团队使用

### 12.3 为什么使用微服务架构？

- 实时通信（聊天、技能协议、终端）需要长连接
- 独立扩展：实时服务可单独水平扩展
- 隔离故障：一个服务崩溃不影响其他服务
- Bun 运行时提供更快的启动和执行速度

### 12.4 为什么使用 Caddy 作为网关？

- 仅暴露单端口 (81)，简化部署
- `XTransformPort` 查询参数路由，灵活且无需复杂配置
- 自动 HTTPS 和反向代理

### 12.5 为什么技能执行器支持三种模式？

- **builtin**: 内置技能无需外部服务，零延迟
- **webhook**: 适合已部署的 HTTP 服务
- **function**: 适合轻量级函数调用
- 三种模式覆盖了大多数集成场景

---

## 13. 运维监控

### 13.1 健康检查

| 端点 | 服务 | 预期响应 |
|------|------|---------|
| `/api/health` | Next.js (3000) | 200 OK |
| `/api/health?XTransformPort=3003` | Chat Service | 200 OK |
| `/api/health?XTransformPort=3004` | Skill WS | 200 OK |
| `/api/health?XTransformPort=3005` | Terminal Service | 200 OK |

### 13.2 日志

- **应用日志**: `dev.log` / `server.log` (stdout + tee)
- **数据库日志**: Prisma query logging (开发模式)
- **结构化日志**: `LogEntry` 数据库表，支持按类型/级别查询

### 13.3 用量追踪

- 每次 Agent 回复后记录 `UsageRecord`
- 包含：inputTokens, outputTokens, cacheReadTokens, reasoningTokens, estimatedCost
- 按 Agent / 对话 / 时间范围聚合统计

---

## 14. 已知技术债务

| 项目 | 严重度 | 描述 |
|------|--------|------|
| TypeScript 错误 | 中 | 约 16 个预存在的 TS 类型错误 |
| Workflow Prisma 同步 | 高 | `db.workflow` 为 undefined，需重新生成 Prisma Client |
| 前端 Workflow 执行 | 中 | 可视化编辑器使用模拟执行，未集成后端引擎 |
| 协作 UI | 中 | 后端协议完整但前端无独立操作界面 |
| 通道实现 | 低 | 数据模型就绪但实际消息桥接未实现 |
| Mock 技能 | 低 | 6 个技能返回模拟数据 |

---

*本文档随项目迭代同步更新。如需修改，请确保反映项目实际代码和技术实现。*
