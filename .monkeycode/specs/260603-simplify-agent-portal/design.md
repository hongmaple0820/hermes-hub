# Hermes Hub Agent Portal 简化重构 - 技术设计方案

> 版本: v1.0 | 日期: 2026-06-03 | 状态: draft

---

## 1. 总体架构变更

### 1.1 页面结构重组

**当前 (8 个独立页面/视图)**:
```
Sidebar:
  agents         -> AgentManager (列表)
  agent-detail   -> AgentDetail (5 Tab: Overview/Skills/Connections/Plugins/Integration)
  agent-control  -> AgentControlCenter (3 Tab: Connected/Remote/Setup)
  skills         -> SkillMarketplace (2 Tab: Store/My Skills)
  chat           -> ChatView
  chat-rooms     -> ChatRooms
  ... (其他)
```

**重构后 (6 个页面/视图)**:
```
Sidebar:
  agents         -> AgentPortal (统一入口: 列表 + 快速创建)
  agent-detail   -> AgentDetail (统一详情: 3 Tab: 配置/对话/历史)
  skills         -> SkillMarketplace (保持，作为 Skill 独立浏览入口)
  chat           -> ChatView (保持，全局对话入口)
  chat-rooms     -> ChatRooms (保持)
  ... (其他)
```

**关键变更**:
1. **取消** `agent-control` 视图 -- ACRP 管理功能合并到 `AgentDetail`
2. **AgentDetail** 从 5 Tab 简化为 3 Tab: 配置 / 对话 / 历史
3. **AgentManager** 改名为 **AgentPortal**，增加快速创建引导
4. **SkillMarketplace** 保持独立，但 Agent 详情页也可直接装配 Skill (双入口)

### 1.2 ViewMode 变更

```typescript
// store.ts - ViewMode 修改
export type ViewMode =
  | 'dashboard'
  | 'agents'          // AgentPortal
  | 'agent-detail'    // 简化后的 AgentDetail
  | 'providers'
  | 'skills'
  | 'chat'
  | 'chat-rooms'
  | 'settings'
  | 'channels'
  | 'jobs'
  | 'usage'
  | 'profiles'
  | 'memory'
  | 'logs'
  | 'files'
  | 'terminal'
  // 删除: 'agent-control'
  | 'notifications';
```

---

## 2. 数据模型变更

### 2.1 Agent 模型扩展 (向后兼容)

在现有 `Agent` 模型上新增字段，不删除旧字段:

```prisma
model Agent {
  // ... 保留所有现有字段 ...
  
  // 新增字段
  agentCategory    String   @default("assistant") // assistant, worker, coordinator
  templateId       String?  // 如果从模板创建，记录模板来源
  
  // 新增关系
  template         AgentTemplate? @relation(fields: [templateId], references: [id])
}
```

### 2.2 新增 AgentTemplate 模型

```prisma
model AgentTemplate {
  id          String   @id @default(cuid())
  name        String   @unique
  displayName String
  description String
  category    String   @default("assistant") // assistant, worker, coordinator
  icon        String?
  systemPrompt String
  agentType   String?  // 预设的 Agent 类型 (null 表示内置助手)
  skillIds    String   @default("[]") // JSON: 预装配的 Skill ID 列表
  config      String   @default("{}") // JSON: 预设配置 (model, temperature, etc.)
  isPublic    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  agents Agent[]
}
```

### 2.3 Skill 模型扩展

```prisma
model Skill {
  // ... 保留所有现有字段 ...
  
  // 新增字段
  handlerType  String  @default("builtin") // builtin, webhook, function, acrp
  // acrp 类型: 由 ACRP capability 自动转换生成的 Skill
  
  // 新增关系: 记录此 Skill 由哪个 capability 转换而来
  sourceCapabilityId String? // 如果是 ACRP 转换生成的，记录原始 capability ID
  sourceAgentId      String? // 生成此 Skill 的 Agent ID
}
```

### 2.4 AgentSkill 简化 (逻辑层面)

数据库表结构不变，但 Service 层统一处理:

- Plugin 绑定 -> 存储为 `AgentSkill` + handlerType=protocol
- Connection -> 系统自动创建，不在 UI 层显示

---

## 3. Service 层设计

### 3.1 AgentService (新增统一服务)

```typescript
// src/lib/agent-service.ts

export class AgentService {
  
  // 统一创建入口
  async createAgent(params: {
    type: 'builtin' | 'external' | 'template';
    name: string;
    description?: string;
    // builtin 专属
    providerId?: string;
    model?: string;
    systemPrompt?: string;
    // external 专属
    agentType?: string; // hermes-agent, openclaw, claude-code, etc.
    // template 专属
    templateId?: string;
  }): Promise<{
    agent: Agent;
    // external 模式时自动附带
    agentToken?: string;
    connectGuide?: ConnectGuide;
  }>;
  
  // 一键接入 (外部 Agent)
  async setupExternalAgent(agentId: string): Promise<{
    agentToken: string;
    connectGuide: ConnectGuide; // 包含 Python/JS/CLI 代码片段
  }>;
  
  // Capability 自动转 Skill
  async convertCapabilityToSkill(
    agentId: string,
    capability: AgentCapability
  ): Promise<Skill>;
  
  // 自动装配 Skill 到 Agent
  async autoInstallSkills(agentId: string, skillIds: string[]): Promise<AgentSkill[]>;
  
  // 获取 Agent 的统一详情 (合并 Skill/Plugin/Connection)
  async getAgentUnifiedDetail(agentId: string): Promise<UnifiedAgentDetail>;
}

interface ConnectGuide {
  python: string;
  javascript: string;
  cli: string;
}

interface UnifiedAgentDetail {
  agent: Agent;
  skills: UnifiedSkill[]; // 合并 Skill + Plugin + Connection
  connectionStatus: {
    type: 'llm' | 'websocket'; // 内置助手用 LLM, 外部 Agent 用 WebSocket
    connected: boolean;
    lastActivity: string | null;
  };
  recentActivities: ActivityRecord[];
}
```

### 3.2 SkillService 扩展

```typescript
// src/lib/skill-service.ts (扩展)

export class SkillService {
  
  // 统一装配入口 (替代分别调用 installSkill / createPlugin / createConnection)
  async attachSkillToAgent(
    agentId: string,
    skillId: string,
    options?: {
      config?: Record<string, any>;
      // 对于 webhook/protocol 类型，自动生成 endpoint
      autoGenerateEndpoint?: boolean;
    }
  ): Promise<{
    agentSkill: AgentSkill;
    // 如果是 webhook/protocol 类型，返回自动生成的连接信息
    endpoint?: {
      endpointToken: string;
      callbackUrl: string;
    };
  }>;
  
  // 从 ACRP Capability 自动创建 Skill
  async createSkillFromCapability(
    capability: AgentCapability,
    agentId: string
  ): Promise<Skill>;
}
```

### 3.3 CapabilityBridge (ACRP -> Skill 自动桥接)

```typescript
// src/lib/capability-bridge.ts (新增)

// 当 ACRP Agent 注册 capability 时，自动触发转换
export async function onCapabilityRegistered(
  agentId: string,
  capability: AgentCapability
): Promise<void> {
  // 1. 查找是否已有同名 Skill
  const existingSkill = await findSkillByCapability(capability);
  
  if (!existingSkill) {
    // 2. 创建新 Skill (handlerType=acrp)
    const skill = await SkillService.createSkillFromCapability(capability, agentId);
    
    // 3. 自动装配到 Agent
    await SkillService.attachSkillToAgent(agentId, skill.id, {
      autoGenerateEndpoint: true,
    });
  } else {
    // 4. 如果已存在，更新并确保装配到当前 Agent
    await ensureSkillAttached(agentId, existingSkill.id);
  }
}
```

---

## 4. API 层设计

### 4.1 新增统一 API

| Endpoint | Method | 说明 |
|----------|--------|------|
| `/api/agents/create-builtin` | POST | 创建内置助手 (简化参数) |
| `/api/agents/create-external` | POST | 创建外部 Agent + 自动生成 token + 接入引导 |
| `/api/agents/create-from-template` | POST | 从模板创建 (自动装配 Skills) |
| `/api/agents/[id]/unified-detail` | GET | 获取合并后的 Agent 详情 (Skill/Plugin/Connection 统一) |
| `/api/agents/[id]/attach-skill` | POST | 统一装配 Skill (替代 installSkill + createPlugin + createConnection) |
| `/api/agents/[id]/detach-skill` | POST | 统一卸载 Skill |
| `/api/agents/[id]/chat` | POST | 在 Agent 详情页内发起对话 |
| `/api/agents/[id]/activities` | GET | 获取 Agent 最近活动记录 |
| `/api/agent-templates` | GET | 获取 Agent 模板列表 |
| `/api/agent-templates/[id]` | GET | 获取模板详情 |

### 4.2 旧 API 保留

所有现有 API endpoint 保持不变，新 API 是额外的简化入口:
- `/api/agents` (GET/POST) -> 保留
- `/api/agents/[id]` (GET/PATCH/DELETE) -> 保留
- `/api/acrp/*` -> 全部保留
- `/api/skill-protocol/*` -> 全部保留
- `/api/skills/*` -> 保留

旧 API 供高级用户和调试使用，新 API 供简化后的 UI 使用。

---

## 5. 前端组件设计

### 5.1 AgentPortal (替代 AgentManager)

```
┌─────────────────────────────────────────────────────────┐
│  Agent Portal                              [+ 创建]     │
│                                                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │  快速创建引导 (三选一卡片)                         │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐       │    │
│  │  │ 内置助手  │  │ 外部接入  │  │ 职业模板  │       │    │
│  │  │ 🤖       │  │ 🔗       │  │ 📋       │       │    │
│  │  │ 选择LLM  │  │ 选Agent  │  │ 选模板   │       │    │
│  │  │ 填Prompt │  │ 一键生成 │  │ 一键创建 │       │    │
│  │  └──────────┘  └──────────┘  └──────────┘       │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  我的 Agent 列表                                         │
│  ┌─────────────────────────────────────────────────┐    │
│  │  🤖 研发助手  | 内置助手 | GPT-4 | 🟢在线       │    │
│  │  🔗 Hermes    | 外部Agent | ws | 🟢在线         │    │
│  │  🤖 运营助手  | 内置助手 | Claude | 🔴离线      │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  搜索: [___]   筛选: [全部|内置|外部|模板]               │
└─────────────────────────────────────────────────────────┘
```

**组件文件**: `src/components/views/AgentPortal.tsx`

**关键交互**:
- 点击"内置助手" -> 弹出简化创建表单 (名称 + LLM选择 + System Prompt)
- 点击"外部接入" -> 弹出类型选择 -> 创建后自动跳转详情页展示接入引导
- 点击"职业模板" -> 弹出模板选择 -> 创建后自动跳转详情页
- Agent 列表卡片点击 -> 跳转 AgentDetail

### 5.2 AgentDetail (简化重构)

从 5 Tab + Integration -> 简化为 3 Tab:

```
┌─────────────────────────────────────────────────────────┐
│  ← 返回  |  研发助手  🟢在线  |  [编辑] [删除]         │
│                                                          │
│  [配置] [对话] [历史]                                     │
│                                                          │
│  ─── 配置 Tab ──────────────────────────────────────     │
│  │ 基本信息:                                            │
│  │   名称: 研发助手                                     │
│  │   描述: 辅助研发团队...                               │
│  │   System Prompt: (编辑区)                            │
│  │   LLM: GPT-4o / OpenAI                              │
│  │                                                      │
│  │ 已装配技能:                                          │
│  │   🔍 web-search        [开/关]  [卸载]              │
│  │   📄 pdf               [开/关]  [卸载]              │
│  │   💻 code-execution    [开/关]  [卸载]              │
│  │   [+ 从市场添加技能]                                  │
│  │                                                      │
│  │ 接入信息 (仅外部Agent显示，默认折叠):                │
│  │   Agent Token: acrp_xxxx                             │
│  │   接入代码: Python / JS / CLI (折叠展示)            │
│  │   Capability 管理: [查看] [调用] (折叠展示)          │
│  └─────────────────────────────────────────────────── │
│                                                          │
│  ─── 对话 Tab ──────────────────────────────────────     │
│  │  对话面板 (右侧 60%):                                │
│  │   ┌──────────────────────────────┐                  │
│  │   │  Agent: 你好，我是研发助手... │                  │
│  │   │  User: 帮我搜索...           │                  │
│  │   │  Agent: [调用 web-search]    │                  │
│  │   └──────────────────────────────┘                  │
│  │  [输入框]                                           │
│  └─────────────────────────────────────────────────── │
│                                                          │
│  ─── 历史 Tab ──────────────────────────────────────     │
│  │  最近对话: ...                                       │
│  │  Skill 调用记录: ...                                 │
│  │  Capability 调用记录: ...                            │
│  └─────────────────────────────────────────────────── │
└─────────────────────────────────────────────────────────┘
```

**组件文件**: 重构 `src/components/views/AgentDetail.tsx`

**关键交互变更**:
- "配置" Tab: 合并 Overview + Skills + Connections + Plugins，Skill/Plugin 统一为"已装配技能"，Connection 自动处理
- "对话" Tab: 新增，直接在 Agent 详情页内对话 (类似扣子的对话式交互)
- "历史" Tab: 新增，展示对话/Skill调用/Capability调用记录
- "接入信息": 折叠区，仅外部 Agent 可见，默认折叠

### 5.3 创建流程组件

#### CreateBuiltinAssistant (简化表单)

```typescript
// src/components/agent/CreateBuiltinAssistant.tsx
interface Props {
  onSuccess: (agent: Agent) => void;
}

// 简化表单字段:
// - 名称 (必填)
// - 描述 (可选)
// - System Prompt (可选，有预设模板)
// - LLM Provider + Model (下拉选择)
// - 温度 (滑块，默认 0.7)
```

#### CreateExternalAgent (一键接入)

```typescript
// src/components/agent/CreateExternalAgent.tsx
interface Props {
  onSuccess: (agent: Agent & { agentToken: string; connectGuide: ConnectGuide }) => void;
}

// 流程:
// Step 1: 选择 Agent 类型 (hermes-agent / openclaw / claude-code / codex / trae / custom)
// Step 2: 填名称 + 描述
// Step 3: 创建 -> 自动生成 token 和接入代码 -> 跳转详情页
```

#### CreateFromTemplate (模板选择)

```typescript
// src/components/agent/CreateFromTemplate.tsx
interface Props {
  onSuccess: (agent: Agent) => void;
}

// 流程:
// Step 1: 浏览模板列表 (卡片展示)
// Step 2: 选择模板 -> 预览配置 + Skills
// Step 3: 确认创建 -> 自动装配 Skills -> 跳转详情页
```

### 5.4 AgentDetail 内的对话面板

```typescript
// src/components/agent/AgentChatPanel.tsx
interface Props {
  agentId: string;
  agentName: string;
  mode: 'builtin' | 'acrp'; // 决定对话路由
}

// builtin 模式: 通过 chat-service API 发送消息
// acrp 模式: 通过 ACRP WebSocket 转发消息
// 显示 Skill 调用过程 (tool_call / tool_result 消息)
```

### 5.5 SkillAttachmentPanel (统一装配面板)

```typescript
// src/components/agent/SkillAttachmentPanel.tsx
interface Props {
  agentId: string;
  attachedSkills: UnifiedSkill[];
  onAttach: (skillId: string) => void;
  onDetach: (agentSkillId: string) => void;
  onToggle: (agentSkillId: string, enabled: boolean) => void;
}

interface UnifiedSkill {
  id: string;
  skillId: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  icon?: string;
  handlerType: 'builtin' | 'webhook' | 'function' | 'acrp' | 'protocol';
  isEnabled: boolean;
  sourceLabel: string; // "内置" / "Webhook" / "ACRP自动" / "协议连接"
}
```

---

## 6. 初始 Agent 模板数据

预置 6 个职业模板，覆盖核心场景:

| 模板名 | displayName | 描述 | agentType | 预装配 Skills |
|--------|-------------|------|-----------|---------------|
| research-assistant | 研发助手 | 辅助代码开发、调试和技术调研 | null (内置) | web-search, code-execution, pdf |
| operations-assistant | 运营助手 | 内容策划、数据分析和市场调研 | null | web-search, charts, ppt, xlsx |
| content-writer | 内容创作 | 文案写作、SEO 优化和内容策略 | null | web-search, blog-writer, seo-content-writer |
| finance-analyst | 金融分析 | 股票分析、市场研究和财务报告 | null | web-search, stock-analysis-skill, finance |
| project-manager | 项目管理 | 任务追踪、进度管理和团队协调 | null | web-search, auto-target-tracker |
| hermes-agent-template | Hermes Agent 接入 | 接入 Hermes Agent，自动获取其全部能力 | hermes-agent | (ACRP 自动注册) |

---

## 7. WebSocket 微服务变更

### 7.1 skill-ws 扩展

**不修改现有协议**，新增一个事件:

```typescript
// 新增 WebSocket 事件: capability:registered
// 当 ACRP Agent 注册 capability 后，skill-ws 向 Hub 主服务推送通知
// Hub 主服务接收通知后调用 CapabilityBridge 进行自动转换

// skill-ws/index.ts 新增:
socket.on('agent:register', async (data) => {
  // ... 现有注册逻辑 ...
  
  // 新增: 向 Hub 主服务通知 capability 注册
  await notifyHubCapabilityRegistered(agentId, capabilities);
});

// 新增内部 HTTP 端点 (供 skill-ws 调用):
// POST /api/internal/capability-registered
// Body: { agentId, capabilities[] }
```

### 7.2 Hub 主服务新增内部 API

```typescript
// src/app/api/internal/capability-registered/route.ts (新增)
// 接收 skill-ws 的 capability 注册通知
// 调用 CapabilityBridge 自动转换
```

---

## 8. 迁移策略

### Phase 1: UI 层简化 (本次重构核心)

1. 新建 AgentPortal 组件，替代 AgentManager
2. 重构 AgentDetail (3 Tab + 对话面板 + 历史面板)
3. 新建 CreateBuiltinAssistant / CreateExternalAgent / CreateFromTemplate 组件
4. 新建 AgentChatPanel 组件
5. 新建 SkillAttachmentPanel 组件
6. 更新 store.ts ViewMode (删除 agent-control)
7. 更新 Sidebar.tsx (删除 agent-control 入口)

### Phase 2: Service 层统一

1. 新建 AgentService (统一创建/详情/装配)
2. 新建 SkillService 扩展 (统一装配)
3. 新建 CapabilityBridge (ACRP -> Skill 自动转换)
4. 新增统一 API endpoints

### Phase 3: 数据模型扩展

1. 新增 AgentTemplate 模型 + 迁移
2. Agent 模型新增 agentCategory/templateId 字段 + 迁移
3. Skill 模型新增 handlerType=acrp + sourceCapabilityId + sourceAgentId + 迁移
4. 种子数据: 预置 6 个 AgentTemplate

### Phase 4: 对话闭环

1. 新建 AgentChatPanel 对话面板
2. 实现内置助手的对话路由 (通过 chat-service)
3. 实现外部 Agent 的对话路由 (通过 ACRP WebSocket)
4. 新建 ActivityRecord 查询和展示

### Phase 5: 项目空间 (远期)

1. 新增 ProjectSpace 模型
2. 新增项目空间 UI
3. Agent 间协作路由

---

## 9. 文件变更清单

### 新增文件

| 文件路径 | 说明 |
|----------|------|
| `src/components/views/AgentPortal.tsx` | Agent 统一入口 (替代 AgentManager) |
| `src/components/agent/CreateBuiltinAssistant.tsx` | 内置助手创建表单 |
| `src/components/agent/CreateExternalAgent.tsx` | 外部 Agent 一键接入 |
| `src/components/agent/CreateFromTemplate.tsx` | 模板创建 |
| `src/components/agent/AgentChatPanel.tsx` | Agent 详情页内对话面板 |
| `src/components/agent/SkillAttachmentPanel.tsx` | 统一 Skill 装配面板 |
| `src/components/agent/ConnectGuidePanel.tsx` | 接入代码展示 (折叠区) |
| `src/components/agent/AgentActivityList.tsx` | Agent 活动记录列表 |
| `src/lib/agent-service.ts` | 统一 Agent Service |
| `src/lib/skill-service.ts` | 扩展 Skill Service |
| `src/lib/capability-bridge.ts` | ACRP -> Skill 自动桥接 |
| `src/app/api/agents/create-builtin/route.ts` | 内置助手创建 API |
| `src/app/api/agents/create-external/route.ts` | 外部 Agent 创建 API |
| `src/app/api/agents/create-from-template/route.ts` | 模板创建 API |
| `src/app/api/agents/[id]/unified-detail/route.ts` | 统一详情 API |
| `src/app/api/agents/[id]/attach-skill/route.ts` | 统一装配 API |
| `src/app/api/agents/[id]/detach-skill/route.ts` | 统一卸载 API |
| `src/app/api/agents/[id]/chat/route.ts` | Agent 内对话 API |
| `src/app/api/agents/[id]/activities/route.ts` | 活动记录 API |
| `src/app/api/agent-templates/route.ts` | 模板列表 API |
| `src/app/api/agent-templates/[id]/route.ts` | 模板详情 API |
| `src/app/api/internal/capability-registered/route.ts` | 内部通知 API |
| `prisma/migrations/...` | 数据模型迁移 |

### 修改文件

| 文件路径 | 变更内容 |
|----------|----------|
| `src/lib/store.ts` | ViewMode 删除 agent-control; 新增 templateList |
| `src/components/layout/Sidebar.tsx` | 删除 agent-control 入口 |
| `src/app/page.tsx` | agents 视图渲染 AgentPortal; 删除 agent-control 分支 |
| `prisma/schema.prisma` | 新增 AgentTemplate; Agent/Skill 新增字段 |

### 保留但不修改的文件

| 文件路径 | 说明 |
|----------|------|
| `src/components/views/AgentManager.tsx` | 保留，供高级模式切换 (Phase 1 结束后可选删除) |
| `src/components/views/AgentControlCenter.tsx` | 保留，功能合并到 AgentDetail |
| `src/components/views/SkillMarketplace.tsx` | 保留，作为 Skill 独立浏览入口 |
| `mini-services/skill-ws/index.ts` | 保留，仅新增 capability 注册通知推送 |
| 所有 `/api/acrp/*` | 保留 |
| 所有 `/api/skill-protocol/*` | 保留 |
| 所有 `/api/agents/*` (现有) | 保留 |

---

## 10. 验证方案

### 10.1 功能验证

| 测试场景 | 验证方法 |
|----------|----------|
| 创建内置助手 | 创建 -> 详情页展示 -> 对话面板可用 |
| 创建外部 Agent | 创建 -> 自动生成 token -> 接入引导展示 -> WebSocket 连接 -> capability 自动转 Skill |
| 从模板创建 | 选模板 -> 自动装配 Skills -> 详情页展示 |
| Skill 装配/卸载 | 在详情页一键添加/移除 Skill，无需配置 endpoint |
| 对话闭环 | Agent 详情页内对话 -> Skill 调用可视化 -> 消息历史在"历史" Tab 可查 |
| ACRP 接入闭环 | 创建 -> 获取代码 -> Agent 连接 -> capability 注册 -> 自动 Skill -> 可对话 |
| 旧数据兼容 | 旧 builtin/acrp Agent 正常显示在新 UI |

### 10.2 性能验证

- Agent 详情页加载: `time curl /api/agents/[id]/unified-detail` < 2s
- Skill 装配响应: `time curl -X POST /api/agents/[id]/attach-skill` < 500ms

### 10.3 兼容性验证

- 旧 API 正常工作: `/api/agents`, `/api/acrp/*`, `/api/skills/*`
- skill-ws ACRP 流程正常: 外部 Agent 可连接、注册、心跳
- 现有数据不丢失: 旧 Agent/Skill/Plugin 数据在新 UI 正确显示