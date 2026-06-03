# Hermes Hub Agent Portal 简化重构 - 需求规格说明书

> 版本: v1.0 | 日期: 2026-06-03 | 状态: draft

---

## 1. 背景

当前 Hermes Hub 的 Agent 创建/接入/控制体系存在严重的概念膨胀和交互破碎问题:

| 维度 | 当前状态 | 竞品参照 |
|------|----------|----------|
| 概念数量 | 6 个独立概念 (Agent/Skill/Plugin/Connection/Capability/ACRP Token) | 扣子: 1 个 Agent + Skills 装配; 飞书: 一句话搭建 |
| 操作步骤 | 从创建到可用需 7+ 步操作，跨越 3 个独立页面 | 扣子: 选模板 -> 装技能 -> 对话; 飞书: 描述需求 -> 确认 -> 使用 |
| 用户心智模型 | 需理解 ACRP/endpointToken/callbackUrl/callbackSecret 等 WebSocket 协议细节 | 扣子/飞书: 技术细节全部隐藏在系统内部 |
| 业务闭环 | Agent 创建后无对话入口，无任务追踪，无项目空间 | 扣子: 项目空间统一管理; Hermes Agent: 持久记忆 + cron + 技能自动提炼 |

核心矛盾: **人对人友好** 和 **Agent 对 Agent 友好** 的设计目标被混在了一起，导致人类用户被迫理解 Agent 间的协议细节。

---

## 2. 设计原则

### P1: 概念归一 -- 用户只关心 Agent 和 Skill

用户心智模型应该只有两层:
- **Agent**: 一个可以对话、能做事的数字助手
- **Skill**: Agent 可以装配的能力模块 (类似扣子的"行业技能包")

Plugin/Connection/Capability/ACRP Token 都是 **系统内部概念**，不应暴露给人类用户。

### P2: 操作路径最短 -- 从创建到对话不超过 3 步

参照扣子 Coze 的路径:
```
Step 1: 选类型 (内置助手 / 接入外部 Agent / 职业模板)
Step 2: 装技能 (从 Skill 市场选择或一键导入)
Step 3: 开始对话 (直接在 Agent 页面内对话)
```

### P3: 技术细节自动处理 -- 用户不配置协议参数

endpointToken、callbackUrl、callbackSecret、ACRP token、WebSocket 连接等，全部由系统自动生成和管理。用户只在"查看接入代码"时才能看到这些信息。

### P4: 业务闭环 -- 每个 Agent 有完整的生命周期

Agent 的生命周期: **创建 -> 配置 -> 对话 -> 执行任务 -> 查看结果 -> 持久记忆**。每个环节在同一页面流内完成，不需要跳转。

---

## 3. 功能需求 (EARS 格式)

### 3.1 Agent 统一入口

#### REQ-01: Agent 创建流程简化

**当** 用户想要创建一个新 Agent 时，**系统应** 提供三种创建方式并引导到同一结果:

| 创建方式 | 说明 | 参照 |
|----------|------|------|
| 创建内置助手 | 选择 LLM Provider + Model，填写 System Prompt | 当前 builtin 模式简化 |
| 接入外部 Agent | 选择 Agent 类型(Hermes Agent/OpenClaw/Claude Code/Codex/Trae/自定义)，一键生成接入引导 | 当前 acrp 模式简化 |
| 从职业模板创建 | 选择一个预置的 Agent 模板(内置 Skills + System Prompt + 配置) | 扣子职业模板 |

创建完成后，**系统应** 自动跳转到该 Agent 的详情页 (不再停留在列表页)。

#### REQ-02: Agent 模式合并

**当** 用户查看任何 Agent 时，**系统应** 不再区分 builtin/acrp 模式显示，而是统一展示:
- 基本信息 (名称/描述/头像/System Prompt)
- 连接状态 (内置助手显示 LLM 状态; 外部 Agent 显示 WebSocket 连接状态)
- 技能列表 (所有已装配的 Skills)
- 对话入口 (直接在页面内与 Agent 对话)

**当** Agent 是外部接入类型时，**系统应** 在详情页的"接入信息"折叠区内显示接入代码和 token (默认折叠，按需展开)。

#### REQ-03: 取消独立的 AgentControlCenter 页面

**当** 用户需要管理 ACRP Agent 时，**系统应** 将所有 ACRP 功能(查看连接状态、调用 capability、发送命令)合并到 Agent 详情页内，不再需要独立的"Agent Control"侧边栏入口。

### 3.2 Skill 统一装配

#### REQ-04: Skill/Plugin/Connection 合并为 Skill

**当** 用户想要给 Agent 添加能力时，**系统应** 提供统一的"装配技能"入口:

当前三种能力的映射关系:
| 当前概念 | 新概念 | 说明 |
|----------|--------|------|
| Skill | Skill (handler=builtin/webhook) | 内置技能或外部 Webhook 技能 |
| Plugin | Skill (handler=protocol) | 通过 Skill Protocol 连接的外部能力 |
| Connection | 自动处理 | WebSocket/HTTP 连接由系统根据 Skill 类型自动建立 |

**当** Skill 的 handler 为 webhook 或 protocol 时，**系统应** 自动生成 endpointToken/callbackUrl/callbackSecret，用户不手动配置。

#### REQ-05: Skill 装配流程简化

**当** 用户在 Agent 详情页装配 Skill 时，**系统应** 提供:
- Skill 市场浏览 (按分类筛选)
- 一键安装 (点击"添加"按钮即可，无需配置 endpoint/回调)
- 开关控制 (启用/禁用已装配的 Skill)
- 从 Git 导入 (高级功能，折叠在"高级"区域内)

### 3.3 对话闭环

#### REQ-06: Agent 详情页内置对话

**当** 用户进入任何 Agent 的详情页时，**系统应** 在页面右侧或底部提供对话面板，允许用户直接与该 Agent 进行对话，无需跳转到独立的 Chat 页面。

**当** Agent 是内置助手时，对话通过 LLM Provider 执行。
**当** Agent 是外部接入时，对话通过 ACRP WebSocket 转发到外部 Agent。

#### REQ-07: Agent 任务历史

**当** 用户查看 Agent 详情页时，**系统应** 显示该 Agent 最近的任务执行记录:
- 对话历史摘要
- Skill 调用记录 (何时调用了哪个 Skill，结果如何)
- Capability 调用记录 (针对 ACRP Agent)

### 3.4 接入引导

#### REQ-08: 外部 Agent 一键接入

**当** 用户选择"接入外部 Agent"创建方式时，**系统应** 自动:
1. 创建 Agent 记录
2. 生成 ACRP Token
3. 根据选择的 Agent 类型生成对应的接入代码片段 (Python/JS/CLI)
4. 实时显示连接状态 (等待连接 -> 已连接)

**当** 外部 Agent 连接成功时，**系统应** 自动:
1. 接收 Agent 注册的 capabilities 并转换为可装配的 Skills
2. 更新 Agent 状态为"在线"
3. 通知用户连接成功

#### REQ-09: ACRP Capability 自动转 Skill

**当** 外部 Agent 通过 ACRP 注册 capabilities 时，**系统应** 自动将每个 capability 转换为一个 Skill 记录:
- capability.name -> Skill.displayName
- capability.description -> Skill.description
- capability.category -> Skill.category
- capability.parameters -> Skill.configSchema
- handlerType = "acrp" (新增类型)

**当** capability 转换的 Skill 创建后，**系统应** 自动将其装配到该 Agent，默认启用。

### 3.5 项目空间 (Phase 2)

#### REQ-10: 项目空间概念

**当** 用户有多个 Agent 协作的需求时，**系统应** 提供"项目空间"功能:
- 一个项目包含: 目标描述 + 参与的 Agent 列表 + 共享文件 + 对话历史 + 产出记录
- 项目内的 Agent 可以通过 Hub 中转互相协作
- 项目空间独立管理，有专属的文件和对话区

> 注: 此需求为 Phase 2，不在本次重构范围内，但数据模型需预留扩展空间。

---

## 4. 非功能需求

### NFR-01: 数据兼容

重构后的数据模型必须向后兼容现有数据:
- Agent.mode 字段保留，但 UI 不再暴露给用户
- AgentSkill/AgentPlugin/AgentConnection 表保留，通过 Service 层统一映射
- 新增 Agent.handlerType 字段替代 mode 在 UI 层面的区分

### NFR-02: ACRP 协议兼容

底层 ACRP WebSocket 协议保持不变:
- skill-ws 微服务的 ACRP 流程不变
- endpointToken/agentToken 机制不变
- capability 注册/心跳/调用流程不变
- 仅在 UI 层面简化，后端 API 保持向后兼容

### NFR-03: 性能

- Agent 详情页加载时间 < 2s
- Skill 装配操作响应时间 < 500ms
- 对话面板首条消息响应时间 < 3s

---

## 5. 约束

1. 不修改 skill-ws 微服务的核心 WebSocket 协议
2. 不修改 chat-service 微服务的核心对话协议
3. 现有 API endpoint 保持可用 (旧 UI 可能仍在使用)
4. 前端技术栈不变 (Next.js + React + Zustand + shadcn/ui)

---

## 6. 术语映射表

| 旧术语 (用户可见) | 新术语 (用户可见) | 内部概念 (系统保留) |
|--------------------|-------------------|---------------------|
| builtin Agent | 内置助手 | Agent.mode=builtin |
| acrp Agent | 外部 Agent / 接入 Agent | Agent.mode=acrp |
| Skill | Skill / 技能 | Skill |
| Plugin | Skill (协议类型) | Skill.handlerType=protocol |
| Connection | (自动，不可见) | AgentConnection (系统自动创建) |
| ACRP Token | 接入密钥 | Agent.agentToken |
| endpointToken | (自动，不可见) | AgentSkill.endpointToken |
| callbackUrl | (自动，不可见) | AgentSkill.callbackUrl |
| callbackSecret | (自动，不可见) | AgentSkill.callbackSecret |
| Capability | 自动技能 | AgentCapability -> Skill (自动转换) |
| Agent Control Center | (合并到 Agent 详情页) | ACRP 管理功能 |
| Skill Marketplace | Skill 市场 / 技能市场 | Skill 列表页 |