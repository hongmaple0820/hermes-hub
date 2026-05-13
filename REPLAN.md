# Hermes Hub — 产品与技术重新规划方案

> **版本**: 1.0  
> **日期**: 2025-06-13  
> **状态**: 诊断完成，待执行  
> **制定原因**: 当前产品存在严重的设计缺陷和技术落地问题，无法正常使用

---

## 第一部分：实事求是的问题诊断

### 1. 核心结论

**Hermes Hub 当前是一个"功能堆砌"而非"产品"的状态。** 它拥有 96 个 API、30 个数据模型、16 个视图、3 个微服务，但无法完成一个完整的用户旅程。一个新用户从注册到真正与 AI 对话，需要跨越 4 个独立的配置步骤，每一步都是死胡同。

### 2. 产品设计缺陷（严重）

#### 2.1 🔴 功能阻塞不闭环 — 新用户完全无法使用

**实测流程**：
```
注册 → 登录 → 进入空壳 Dashboard（0 agents, 0 providers）
    → 想聊天 → 点击"创建新对话" → 弹窗显示"暂无可用智能体" → 关闭 → 死胡同
    → 想创建 Agent → 点击"创建智能体" → 表单要求选择 LLM 供应商 → 下拉框为空 → 死胡同
    → 想添加 LLM 供应商 → 跳到 LLM 供应商页面 → 需要填写 API Key、Base URL、模型名 → 死胡同
```

**问题本质**：整个平台没有一条从 0 到 1 的通路。每个功能入口都是一个需要前置条件的死结：
- 聊天需要 Agent
- Agent 需要 LLM Provider  
- LLM Provider 需要用户自己有 API Key 并知道怎么填
- 没有任何引导，没有默认配置，没有快速体验

#### 2.2 🔴 交互逻辑不合理 — 概念堆砌、认知负担过重

**侧边栏导航**：18 个导航项，分 4 组（主要/通讯/管理/系统），新用户完全不知道从哪开始。

**概念过载**：用户需要同时理解：
- Agent（内置 vs ACRP）
- LLM Provider（6 种类型）
- Skill（12 种内置 + 自定义，3 种执行模式）
- Plugin（3 种类型）
- Connection（WebSocket 连接）
- ChatRoom vs Conversation
- Workflow（12 种节点，4 种边）
- Memory（3 段式）
- Profile（多环境配置）
- Channel（8 种 IM 平台）
- Job（定时任务）

**这是开发者的思维模型，不是用户的思维模型。** 一个普通用户只想要："我想和一个 AI 聊天"。

#### 2.3 🔴 使用很复杂 — 操作步骤碎片化

**场景：给 Agent 安装一个技能**
```
1. 进入 Agent 管理 → 点击 Agent → 进入 Agent 详情
2. 切换到"技能"标签 → 点击"添加技能"
3. 但技能在哪里？→ 需要先去技能市场浏览 → 找到技能 → 点击安装
4. 安装到哪个 Agent？→ 再选一次 Agent
5. 回到 Agent 详情 → 看到技能已安装 → 但技能是禁用的
6. 点击启用 → 还要配置参数
7. 回到聊天 → 开始对话 → 技能真的能用了吗？不确定
```

**7 步操作，涉及 3 个不同页面/视图，没有引导，没有反馈。**

#### 2.4 🔴 Agent 连接很麻烦也不准确

**ACRP 协议**（Agent Capability Registration Protocol）设计过于复杂：
- 外部 Agent 需要通过 WebSocket 连接到 skill-ws 服务
- 需要先生成 agentToken
- 需要注册 capabilities
- 需要发送心跳
- 需要处理 invocation 请求
- 需要上报结果

**实际效果**：普通用户根本无法让外部 Agent 接入。对于 95% 的用户，ACRP 是一个无法使用的功能。

**内置 Agent** 同样麻烦：
- 必须手动配置 LLM Provider
- 必须手填 API Key（甚至需要知道 Base URL）
- 必须手动创建 Agent
- 必须手动写 System Prompt
- 必须手动安装技能
- 整个过程没有任何模板或默认值

### 3. 技术实现缺陷（严重）

#### 3.1 🔴 Workflow 引擎完全不可用

**实测错误**：
```
GET /api/workflows → 500
"Cannot read properties of undefined (reading 'findMany')"
```

原因：Prisma Client 单例缓存导致新添加的 Workflow 模型未生效。虽然 schema 已定义，db:push 已执行，prisma generate 已运行，但运行中的 Next.js 进程仍使用旧的 Prisma Client。

**更深层问题**：
- Workflow 编辑器使用模拟执行，与后端引擎断开
- Workflow API 路由创建执行记录但不实际运行引擎
- 执行引擎代码存在但从未被 API 调用

#### 3.2 🔴 半实现功能充斥整个系统

| 功能 | 前端 | 后端 | 实际可用 |
|------|------|------|---------|
| Workflow 执行 | ✅ 编辑器 | ❌ API 不调用引擎 | ❌ 不可用 |
| Agent 协作 | ❌ 无 UI | ✅ 6 种协议 | ❌ 无法触发 |
| Channel 消息桥接 | ✅ 配置页 | ❌ 无实际对接 | ❌ 不可用 |
| 6 个 Mock 技能 | ✅ 安装/启用 | ⚠️ 返回假数据 | ❌ 无真实功能 |
| 终端仿真 | ✅ xterm | ✅ VFS | ⚠️ 虚拟文件系统无实际用途 |
| 文件系统 | ✅ 浏览器 | ✅ VFS | ⚠️ 虚拟的，与 Agent 无关 |
| Profile 管理 | ✅ UI | ✅ API | ⚠️ 概念模糊，用途不明 |
| 日志系统 | ✅ 查看器 | ✅ DB 存储 | ⚠️ 看什么日志？ |
| 搜索 | ✅ 搜索框 | ✅ API | ⚠️ 搜索空对话？ |

**整个系统存在大量"看起来有但用不了"的功能**，这比没有功能更糟糕，因为它误导用户并制造认知混乱。

#### 3.3 🟡 架构过度工程化

**3 个微服务 + Caddy 网关**对于一个单用户/小团队平台是过度设计：
- Chat Service (3003) — 可以集成到 Next.js API Routes
- Skill WS (3004) — ACRP 的复杂度远超实际需求
- Terminal Service (3005) — VFS 终端与核心产品价值无关
- Caddy Gateway — XTransformPort 路由是 hack

**问题**：微服务增加了部署复杂度、开发调试成本，但没有带来实际价值。

#### 3.4 🟡 数据模型过度膨胀

30 个 Prisma 模型，但核心用户流程只用到了其中 5 个（User, LLMProvider, Agent, Conversation, Message）。其余模型要么服务于半实现功能，要么服务于过度设计的概念。

#### 3.5 🟡 TypeScript 类型错误

约 16 个预存在的 TypeScript 类型错误，说明代码质量管控不足。

### 4. 问题根源分析

```
根本原因：以技术能力为导向而非以用户需求为导向的设计思路

症状：
├── 功能堆砌（能做什么 → 加上）vs 产品思维（用户要什么 → 做好）
├── 概念先行（ACRP/技能协议/工作流引擎）vs 体验先行（怎么让用户最快用上）
├── 完整度幻觉（96 API + 30 模型 ≠ 可用产品）
└── 技术自嗨（微服务/DAG引擎/协作协议）vs 实用主义（先跑通核心闭环）
```

---

## 第二部分：重新规划 — 产品方案

### 1. 产品重新定位

**之前**：多 Agent 协作平台（面向开发者，概念密集，配置复杂）

**之后**：**AI 智能体工作台** — 一个让用户在 30 秒内开始与 AI 对话，并逐步赋予 AI 更多能力的平台

**核心原则**：
1. **零配置启动**：新用户注册后立即能和 AI 聊天，无需配置任何 API Key
2. **渐进式暴露**：只展示当前需要的选项，高级功能按需展开
3. **功能闭环**：每个操作都能走到底，不会有死胡同
4. **默认即用**：预配置默认值，用户不需要做选择就能用

### 2. 核心用户旅程重新设计

#### 2.1 新用户首次体验（30 秒法则）

```
注册/登录 → 自动创建默认智能体（使用 Z-AI 内置能力）→ 直接进入聊天界面
                                                    ↓
                                          用户已经可以对话了！
                                                    ↓
                              聊天中自然引导："想让我也能搜索网页吗？" → 一键启用技能
                                                    ↓
                              "想让我记住你的偏好吗？" → 一键开启记忆
                                                    ↓
                              "需要更专业的助手？" → 引导创建自定义 Agent
```

**关键变化**：
- 注册后自动创建一个"默认助手"Agent，使用 Z-AI SDK（无需用户配 API Key）
- 用户第一眼看到的是聊天界面，不是空壳 Dashboard
- 高级功能通过对话中自然引导，而不是埋在层层菜单里

#### 2.2 日常使用流程

```
打开平台 → 看到对话列表 → 选择对话/创建新对话 → 聊天
                                              ↓
                                    需要新能力？→ 对话中 @技能名
                                    需要专业 Agent？→ 侧边栏"新建智能体"
                                    需要多 Agent？→ 聊天室里添加 Agent
```

#### 2.3 进阶用户流程

```
设置 → LLM 供应商 → 添加自己的 API Key → 创建自定义 Agent → 高级配置
                                                              ↓
                                                    工作流编排（可选）
                                                    多 Agent 协作（可选）
                                                    ACRP 接入（可选）
```

### 3. 信息架构重新设计

#### 3.1 之前 vs 之后

| | 之前（18 个导航项） | 之后（5 个核心区域） |
|---|---|---|
| **核心** | 仪表盘/智能体/LLM供应商/技能/Agent控制 | **对话**（合并聊天+聊天室+搜索） |
| **通讯** | 聊天/聊天室 | **智能体**（合并Agent+供应商+技能+控制） |
| **管理** | 定时任务/用量/配置/记忆/工作流 | **自动化**（合并工作流+定时任务） |
| **系统** | 日志/文件/终端/设置 | **设置**（合并其余所有） |

#### 3.2 新导航结构

```
💬 对话         — 所有对话和聊天室的入口，新消息实时提示
🤖 智能体       — Agent 管理 + LLM 配置 + 技能，统一面板
⚡ 自动化       — 工作流 + 定时任务
📊 分析         — Dashboard + 用量统计
⚙️ 设置         — 账号/渠道/高级/关于
```

#### 3.3 首页 = 对话页

**新用户登录后直接进入对话列表**，而不是空壳 Dashboard：
- 如果没有对话：显示欢迎消息 + 快速开始建议
- 如果有对话：显示对话列表，最近的在最上面
- 右侧或顶部：快速创建新对话

### 4. 关键功能重新设计

#### 4.1 默认智能体（零配置启动核心）

**实现方案**：
- 用户注册时，系统自动创建一个名为" Hermes 助手"的默认 Agent
- 该 Agent 使用 Z-AI SDK 作为 LLM Provider（无需用户 API Key）
- 预装基础技能：web-search, translation
- 默认启用记忆系统
- System Prompt 预设为友好的通用助手

**技术方案**：
```typescript
// 在 /api/auth/register 的 POST handler 中
async function createDefaultAgent(userId: string) {
  // 1. 创建 Z-AI 内置 Provider
  const provider = await db.lLMProvider.create({
    data: {
      userId,
      name: 'Z-AI (内置)',
      provider: 'z-ai',
      apiKey: 'z-ai-sdk', // 使用 SDK，不需要真实 key
      baseUrl: 'z-ai-sdk',
      defaultModel: 'default',
      isActive: true,
    }
  });
  
  // 2. 创建默认 Agent
  const agent = await db.agent.create({
    data: {
      userId,
      name: 'Hermes 助手',
      description: '你的默认 AI 助手',
      mode: 'builtin',
      providerId: provider.id,
      systemPrompt: '你是 Hermes 助手，一个友好、专业的 AI 助手...',
      temperature: 0.7,
      maxTokens: 4096,
      isPublic: false,
    }
  });
  
  // 3. 安装基础技能
  await installDefaultSkills(agent.id);
  
  return agent;
}
```

#### 4.2 对话中技能调用（而非手动安装）

**之前**：去技能市场 → 浏览 → 安装到 Agent → 回来聊天 → 不知道技能是否生效

**之后**：
- Agent 默认带有所有可用技能的"认知"（LLM 能看到所有可用 Tool 定义）
- 用户在对话中自然触发挥技能（如"帮我搜索 XXX"→ 自动调用 web-search）
- 首次使用某技能时，弹出确认："Hermes 助手想要使用网页搜索功能，允许吗？"
- 确认后技能自动启用，无需手动安装

#### 4.3 智能体管理统一面板

**之前**：Agent 管理 / LLM 供应商 / 技能市场 / Agent 控制中心 — 4 个独立视图

**之后**：一个统一面板
```
🤖 智能体面板
├── 我的智能体（卡片列表）
│   ├── Hermes 助手（默认，已连接） ← 直接点进去就聊天
│   ├── 代码助手（自定义）
│   └── + 创建新智能体
├── AI 模型（折叠区，高级用户）
│   ├── Z-AI（内置，默认激活）
│   ├── + 添加自定义模型（OpenAI / Anthropic / ...）
└── 可用技能（折叠区，按需浏览）
    ├── ✅ 网页搜索（已启用）
    ├── ✅ 翻译（已启用）
    ├── 🔲 图片生成
    └── 🔲 更多...
```

#### 4.4 Agent 创建流程简化

**之前**：10+ 个表单字段，需要理解所有概念

**之后**：3 步创建
```
第1步：名字和用途（名字 + 一句话描述）
第2步：AI 模型（默认 Z-AI，高级用户可选自定义）
第3步：能力（勾选需要的技能，默认推荐）
→ 创建完成 → 立即开始对话
```

### 5. 需要砍掉/合并的功能

#### 5.1 砍掉（当前阶段无价值）

| 功能 | 原因 | 替代方案 |
|------|------|---------|
| ACRP 控制中心 | 99% 用户不会用，设计过于复杂 | 未来作为插件/API开放 |
| 虚拟终端 | VFS 无实际用途，与核心产品无关 | 未来作为独立插件 |
| 虚拟文件系统 | 同上 | 同上 |
| Profile 多配置 | 概念模糊，使用场景不明确 | 未来考虑 |
| Channel 消息桥接 | 框架在但功能未实现 | 未来独立模块 |
| OAuth（Codex/Nous/Copilot） | 无实际对接 | 未来按需 |

#### 5.2 合并

| 之前 | 之后 | 合并方式 |
|------|------|---------|
| 仪表盘 + 用量 | 分析 | Dashboard 统一展示 |
| Agent管理 + LLM供应商 + 技能 + ACRP控制 | 智能体 | 统一面板 |
| 聊天 + 聊天室 + 搜索 | 对话 | Tab 切换 |
| 工作流 + 定时任务 | 自动化 | 统一入口 |
| 记忆 + 日志 + 文件 + 终端 + 设置 | 设置 | 折叠分组 |

#### 5.3 保留但重构

| 功能 | 重构方向 |
|------|---------|
| Agent 协作 | 从独立 API → 聊天室中的自然交互 |
| 工作流引擎 | 从复杂 DAG → 简单的 Agent 链式编排 |
| 记忆系统 | 从手动管理 → 自动启用 + 对话中可查看 |

---

## 第三部分：重新规划 — 技术架构方案

### 1. 架构原则

1. **先跑通再优化**：砍掉一切不闭环的功能，集中精力把核心路径做到极致
2. **最小微服务**：减少到 1 个微服务（Chat），其余合并到 Next.js
3. **默认即用**：Z-AI SDK 作为默认 Provider，零配置
4. **渐进式复杂度**：简单功能不需要理解复杂概念

### 2. 新系统架构

```
                    ┌─────────────┐
                    │   Browser   │
                    │  (SPA App)  │
                    └──────┬──────┘
                           │ HTTP / WebSocket
                           ▼
                    ┌─────────────┐
                    │   Caddy :81 │
                    └──────┬──────┘
                           │
              ┌────────────┴────────────┐
              │                         │
      ┌───────▼──────┐         ┌───────▼──────┐
      │  Next.js     │         │ Chat Service │
      │  :3000       │         │ :3003        │
      │              │         │ Socket.IO    │
      │ - API Routes │         │ 实时消息推送  │
      │ - Z-AI SDK   │         │ 通知推送      │
      │ - Prisma/DB  │         │ 在线状态      │
      │ - 技能执行    │         └──────────────┘
      │ - 工作流引擎  │
      └──────┬───────┘
             │
      ┌──────▼──────┐
      │   SQLite    │
      │  (Prisma)   │
      └─────────────┘
```

**变化**：
- **砍掉 Skill WS (3004)**：ACRP 功能降级为 API 轮询或未来插件
- **砍掉 Terminal Service (3005)**：VFS 终端不是核心价值
- **保留 Chat Service (3003)**：实时消息推送仍有价值
- **技能执行移入 Next.js**：内置技能在 Next.js API Routes 中直接执行

### 3. 数据模型精简

#### 3.1 核心模型（保留）

| 模型 | 用途 | 变化 |
|------|------|------|
| User | 用户认证 | 无变化 |
| LLMProvider | AI 模型配置 | 增加 `isBuiltIn` 字段标识内置 Provider |
| Agent | AI 智能体 | 增加 `isDefault` 字段，注册时自动创建 |
| AgentSkill | Agent↔技能绑定 | 无变化 |
| Skill | 技能定义 | 无变化 |
| Conversation | 对话会话 | 无变化 |
| ConversationParticipant | 对话成员 | 无变化 |
| Message | 消息 | 无变化 |
| ChatRoom | 聊天室 | 无变化 |
| ChatRoomMember | 聊天室成员 | 无变化 |
| ChatRoomAgent | 聊天室 Agent | 无变化 |
| ChatRoomMessage | 聊天室消息 | 无变化 |
| AgentMemory | Agent 记忆 | 无变化 |
| Notification | 通知 | 无变化 |
| UsageRecord | 用量追踪 | 无变化 |
| Workflow | 工作流 | 保留但降低优先级 |
| WorkflowExecution | 工作流执行 | 同上 |

#### 3.2 降级/冻结的模型（不删，但停止开发）

| 模型 | 原因 |
|------|------|
| AgentCapability | ACRP 降级 |
| CapabilityInvocation | ACRP 降级 |
| AgentPlugin | 使用场景不明确 |
| AgentConnection | ACRP 降级 |
| Channel | 消息桥接未实现 |
| Job | 合并到 Workflow 触发器 |
| Profile | 概念模糊 |
| FileEntry | VFS 不是核心价值 |
| LogEntry | 过度设计，console + 文件日志足够 |
| AppSettings | 简化为前端 localStorage |
| OAuthToken | OAuth 未实际对接 |
| ContextSnapshot | 合并到 Memory |
| Friendship | 社交功能暂不需要 |

### 4. API 重构

#### 4.1 新增关键 API

| API | 方法 | 用途 |
|-----|------|------|
| `/api/quickstart` | GET | 返回新用户引导状态（是否有 agent/provider/conversation） |
| `/api/quickstart/setup` | POST | 一键初始化：创建默认 Provider + Agent + 安装基础技能 |
| `/api/agents/[id]/chat` | POST | 简化的聊天 API：传 agentId + message，自动创建/复用对话 |
| `/api/agents/[id]/skills/toggle` | POST | 一键启用/禁用技能（替代安装/卸载流程） |
| `/api/skills/available` | GET | Agent 可用但未启用的技能列表（替代技能市场浏览） |

#### 4.2 修改现有 API

| API | 变化 |
|-----|------|
| `POST /api/auth/register` | 注册后自动调用 quickstart/setup |
| `POST /api/agents` | 简化必填字段，providerId 可选（默认用内置 Z-AI） |
| `POST /api/conversations/[id]/messages` | Agent 无 Provider 时使用 Z-AI SDK 兜底 |
| `GET /api/workflows` | 修复 Prisma Client 缓存问题 |

#### 4.3 废弃/冻结的 API

- `/api/acrp/*`（13 个路由）— 冻结
- `/api/skill-protocol/*`（7 个路由）— 冻结
- `/api/terminal/*` — 移除
- `/api/files/*`（6 个路由）— 冻结
- `/api/profiles/*`（5 个路由）— 冻结
- `/api/channels/*`（2 个路由）— 冻结
- `/api/auth/codex/*`, `/api/auth/nous/*`, `/api/auth/copilot/*` — 冻结

### 5. 前端重构

#### 5.1 页面路由

**仍然使用 SPA 架构（单路由 `/`）**，但大幅简化视图：

```typescript
type ViewMode = 
  // 核心
  | 'chat'           // 对话列表 + 聊天（默认首页）
  | 'chat-room'      // 聊天室
  // 管理
  | 'agents'         // 智能体统一面板
  | 'agent-detail'   // 智能体详情/编辑
  | 'workflows'      // 工作流（低优先级）
  // 系统
  | 'analytics'      // 分析面板
  | 'settings'       // 设置
```

**从 18 个视图 → 7 个视图**

#### 5.2 新首页 = 对话

```typescript
// page.tsx 核心逻辑
if (!isAuthenticated) return <AuthPage />;

// 首次登录检测
if (needsQuickStart) return <QuickStartPage />;

// 默认展示对话
return <ChatLayout>
  <Sidebar />  {/* 简化到5个导航项 */}
  <ChatView /> {/* 默认视图 */}
</ChatLayout>
```

#### 5.3 QuickStart 页面（关键新增）

新用户首次登录时展示：
```
┌─────────────────────────────────────────┐
│                                         │
│   👋 欢迎来到 Hermes Hub！              │
│                                         │
│   你的 AI 助手已经准备好了              │
│                                         │
│   ┌───────────────────────────────┐     │
│   │ 🤖 Hermes 助手                │     │
│   │ 已就绪 · Z-AI 内置模型        │     │
│   │ 能力：聊天 / 搜索 / 翻译      │     │
│   └───────────────────────────────┘     │
│                                         │
│   [  开始对话  ]   [  自定义设置  ]      │
│                                         │
└─────────────────────────────────────────┘
```

### 6. 实施路线图

#### Phase 0：紧急修复（1-2 天）

1. ✅ 修复 Workflow API 500 错误（重启 dev server 使 Prisma Client 生效）
2. ✅ 修复 Prisma Client 缓存问题
3. ✅ 清理 TypeScript 错误

#### Phase 1：零配置启动（3-5 天）— 核心价值

1. 实现 Z-AI SDK 作为内置默认 Provider
2. 注册时自动创建默认 Agent + Provider
3. 新首页 = 对话界面
4. QuickStart 页面
5. 简化侧边栏导航（5 个核心区域）

#### Phase 2：交互优化（3-5 天）

1. 智能体统一面板（合并 Agent + Provider + Skill）
2. 对话中技能自动触发 + 确认弹窗
3. Agent 创建 3 步流程
4. 聊天室自然协作交互
5. 功能闭环检查（每个操作都能走到底）

#### Phase 3：功能完善（3-5 天）

1. Workflow 引擎与 API 真正集成
2. Agent 记忆自动启用 + 对话中查看
3. 分析面板（Dashboard + 用量统一）
4. Mock 技能替换为真实实现或移除
5. 移除/隐藏不可用的功能

#### Phase 4：打磨与扩展（持续）

1. UI 细节打磨、动画、响应式
2. 工作流模板
3. 多 Agent 协作在聊天室中的自然交互
4. i18n 同步更新
5. 性能优化

### 7. 关键技术决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 默认 LLM | Z-AI SDK | 零配置，内置可用 |
| 微服务数量 | 减到 1 个（Chat） | 简化部署，降低复杂度 |
| SPA vs MPA | 保持 SPA | 已有投资，无需重写 |
| 数据库 | 保持 SQLite | 足够用，迁移成本低 |
| 砍掉的功能 | 冻结不删 | 保留代码，未来可恢复 |
| ACRP | 降级为 API | WebSocket ACRP 过于复杂 |

---

## 第四部分：核心度量标准

### 产品健康度指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 新用户从注册到首次对话的步骤数 | 4+ (不可达) | 1 |
| 新用户从注册到首次对话的时间 | 无法完成 | < 30秒 |
| 侧边栏导航项数 | 18 | 5 |
| 视图数量 | 16+ | 7 |
| 死胡同（操作无法继续）数量 | 多处 | 0 |
| 半实现功能占比 | ~40% | < 10% |
| 500 错误的 API 数量 | ≥ 1 | 0 |

### 技术健康度指标

| 指标 | 当前 | 目标 |
|------|------|------|
| TypeScript 错误数 | ~16 | 0 |
| 微服务数量 | 3+网关 | 1+网关 |
| API 路由数 | 96 | ~50（活跃） |
| Prisma 模型数 | 30 | 17（活跃） |
| 不可用的 API 占比 | ~30% | 0% |

---

*本文档是对 Hermes Hub 项目现状的实事求是评估和重新规划。所有诊断基于实际代码审查和用户流程测试，不回避问题。方案的核心思路是：**先让用户能用起来，再逐步完善高级功能**。*
