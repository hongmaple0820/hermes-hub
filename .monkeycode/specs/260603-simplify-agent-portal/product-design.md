# Hermes Hub 产品设计文档

> **版本**: v2.1  
> **日期**: 2026-06-04  
> **状态**: 已完成重构 + 边缘场景补充  
> **文档类型**: 产品设计说明书 (PRD)

---

## 目录

1. [产品概述](#1-产品概述)
2. [用户画像与场景](#2-用户画像与场景)
3. [产品架构](#3-产品架构)
4. [核心功能设计](#4-核心功能设计)
5. [用户流程设计](#5-用户流程设计)
6. [数据模型设计](#6-数据模型设计)
7. [界面设计规范](#7-界面设计规范)
8. [技术实现要点](#8-技术实现要点)
9. [非功能需求](#9-非功能需求)
10. [附录](#10-附录)
11. [异常处理状态机设计](#11-异常处理状态机设计)
12. [LLM Provider 配置流程](#12-llm-provider-配置流程)
13. [ChatRoom 功能设计](#13-chatroom-功能设计)
14. [Agent 删除流程](#14-agent-删除流程)
15. [上下文压缩策略](#15-上下文压缩策略)
16. [交互逻辑修正](#16-交互逻辑修正)
17. [团队协作数据模型](#17-团队协作数据模型)
18. [账单与用量限额](#18-账单与用量限额)
19. [Skill Protocol 连接流程](#19-skill-protocol-连接流程)
20. [注册登录流程](#20-注册登录流程)
21. [Agent 编辑流程](#21-agent-编辑流程)
22. [对话消息交互规范](#22-对话消息交互规范)
23. [系统通知机制](#23-系统通知机制)
24. [权限矩阵](#24-权限矩阵)
25. [搜索功能设计](#25-搜索功能设计)
26. [键盘快捷键](#26-键盘快捷键)
27. [数据导出/导入](#27-数据导出导入)
28. [Provider 故障切换](#28-provider-故障切换)
29. [Agent 状态转换图](#29-agent-状态转换图)
30. [全局 Chat 与 Detail 对话统一](#30-全局-chat-与-detail-对话统一)

---

## 1. 产品概述

### 1.1 产品定位

**Hermes Hub** 是一个多智能体协作平台，定位为 AI 智能体的"操作系统"——连接、管理和调度各类 AI 智能体（Agent）与技能（Skill），让开发者和个人用户能够快速构建、部署和使用 AI 助手。

### 1.2 核心价值主张

| 价值维度 | 描述 |
|---------|------|
| **统一入口** | 一个平台管理所有 Agent，无论是云端 LLM 还是本地 AI 工具 |
| **即插即用** | Skill 系统让 Agent 能力可扩展，像安装 App 一样简单 |
| **开放协议** | ACRP 协议支持任何 Agent 接入，打破平台壁垒 |
| **协作生态** | 多 Agent 协作，构建复杂 AI 工作流 |

### 1.3 目标用户

```
┌─────────────────────────────────────────────────────────────┐
│                    目标用户金字塔                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│     ┌──────────┐                                            │
│     │ 开发者   │  <--- 使用 ACRP 接入自定义 Agent           │
│     │  ~20%   │      需要协议对接、技能开发                   │
│     └────┬─────┘                                            │
│          │                                                  │
│     ┌────┴─────┐                                            │
│     │ 进阶用户 │  <--- 使用模板创建专业 Agent                │
│     │  ~30%   │      需要工作流编排、多 Agent 协作           │
│     └────┬─────┘                                            │
│          │                                                  │
│     ┌────┴─────┐                                            │
│     │ 普通用户 │  <--- 使用内置助手快速上手                  │
│     │  ~50%   │      需要简单对话、一键创建                  │
│     └──────────┘                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 竞品分析

| 维度 | Hermes Hub | 扣子 (Coze) | 飞书多维表格 | Dify | OpenClaw |
|------|------------|-------------|--------------|------|----------|
| **Agent 创建** | 3 种方式（内置/外部/模板） | 模板 + 自定义 | 一句话创建 | 工作流编排 | CLI 为主 |
| **Skill 生态** | 内置 + Git + ACRP 自动 | 插件市场 | 公式/自动化 | 工具节点 | 内置工具 |
| **外部 Agent** | ACRP 协议 | 不支持 | 不支持 | API 调用 | 本地优先 |
| **对话体验** | 页内对话 + 全局聊天 | 页内对话 | 表格内对话 | 调试界面 | 终端对话 |
| **多 Agent** | 聊天室模式 | 工作流 | 不支持 | 工作流 | 多实例 |
| **技术细节** | 可配置但默认隐藏 | 完全隐藏 | 完全隐藏 | 部分暴露 | 完全暴露 |
| **开源程度** | 开源 + 自托管 | 闭源 | 闭源 | 开源 | 开源 |

**差异化定位**: Hermes Hub 是唯一同时支持"开箱即用的内置助手"和"开放协议接入外部 Agent"的开源平台。

---

## 2. 用户画像与场景

### 2.1 用户画像

#### 画像 A: 小明的个人助手（普通用户）

```yaml
背景: 产品经理，需要 AI 辅助日常工作
技术能力: 能使用 ChatGPT，但不会编程
核心需求:
  - 快速创建不同场景的助手（写作、数据分析、编程辅助）
  - 不需要理解技术细节
  - 希望一次配置，长期使用
使用场景:
  - 使用"内容创作"模板创建写作助手
  - 直接对话生成文案
  - 查看历史记录回顾之前的创作
```

#### 画像 B: 李工的开发团队（进阶用户）

```yaml
背景: 10 人研发团队，需要统一 AI 工具
技术能力: 熟悉 AI 概念，能配置 API
核心需求:
  - 团队共享的 Agent 配置
  - 接入 Claude Code 等本地工具
  - 自定义 Skill 扩展能力
使用场景:
  - 创建"代码审查"Agent，接入 Claude Code
  - 开发内部 Skill（Git 提交规范检查）
  - 多 Agent 协作完成复杂任务
```

#### 画像 C: 王架构的企业集成（开发者）

```yaml
背景: 大型企业，需要集成内部系统
技术能力: 资深开发，理解协议设计
核心需求:
  - 自定义 Agent 接入内部系统
  - 完整的协议控制和监控
  - 安全性和审计能力
使用场景:
  - 基于 ACRP 协议开发企业 Agent
  - 实现自定义 Capability（操作内部 API）
  - 集成到企业 SSO 和审计系统
```

### 2.2 核心使用场景

#### 场景 1: 快速创建个人助手

```mermaid
flowchart LR
    A[用户进入 Agent Portal] --> B[选择"内置助手"]
    B --> C[填写名称+选择 LLM]
    C --> D[可选配置 System Prompt]
    D --> E[一键创建]
    E --> F[自动跳转到详情页]
    F --> G[直接开始对话]
    
    style A fill:#e1f5fe
    style G fill:#c8e6c9
```

#### 场景 2: 接入本地 AI 工具

```mermaid
flowchart LR
    A[用户选择"外部接入"] --> B[选择 Agent 类型]
    B --> C[系统自动生成 Token]
    C --> D[显示接入代码]
    D --> E[用户在本地运行代码]
    E --> F[Agent 自动连接]
    F --> G[Capability 自动转为 Skills]
    G --> H[开始对话]
    
    style A fill:#e1f5fe
    style H fill:#c8e6c9
```

#### 场景 3: 团队协作空间

```mermaid
flowchart TD
    A[创建项目空间] --> B[邀请团队成员]
    B --> C[添加多个 Agent]
    C --> D[上传项目文件]
    D --> E[Agent 协同工作]
    E --> F[产出物沉淀]
    
    style A fill:#e1f5fe
    style F fill:#c8e6c9
```

---

## 3. 产品架构

### 3.1 系统架构图

```mermaid
flowchart TB
    subgraph Client["客户端层"]
        Web[Web UI<br/>Next.js + React]
        CLI[CLI Tool<br/>Hermes CLI]
    end
    
    subgraph Gateway["网关层"]
        Next[Next.js API Routes]
        Auth[Auth Middleware]
    end
    
    subgraph Services["服务层"]
        AppService[App Service<br/>Port 3000]
        ChatService[Chat Service<br/>Port 3003]
        WSService[Skill WS Service<br/>Port 3004]
    end
    
    subgraph Data["数据层"]
        PostgreSQL[(PostgreSQL)]
        Prisma[Prisma ORM]
    end
    
    subgraph External["外部系统"]
        OpenAI[OpenAI API]
        Anthropic[Anthropic API]
        CustomAgent[Custom Agents<br/>ACRP Protocol]
    end
    
    Web --> Next
    CLI --> Next
    Next --> Auth
    Auth --> AppService
    AppService --> ChatService
    AppService --> WSService
    ChatService --> OpenAI
    ChatService --> Anthropic
    WSService --> CustomAgent
    AppService --> Prisma
    Prisma --> PostgreSQL
```

### 3.2 功能模块划分

```
┌────────────────────────────────────────────────────────────────┐
│                        Hermes Hub                               │
├────────────────┬────────────────┬────────────────┬───────────────┤
│   Agent 管理    │   Skill 生态   │   对话系统     │   用户系统   │
├────────────────┼────────────────┼────────────────┼───────────────┤
│ • 创建 Agent   │ • Skill 市场   │ • 单 Agent 对话│ • 用户管理   │
│ • 配置 Agent   │ • Skill 装配   │ • 聊天室      │ • 权限控制   │
│ • 管理状态     │ • Skill 开发   │ • 消息历史    │ • OAuth 登录 │
│ • ACRP 接入    │ • Capability   │ • 上下文管理  │ • 使用统计   │
│ • 模板系统     │ • 自动转换     │ • 流式响应    │ • 设置管理   │
└────────────────┴────────────────┴────────────────┴───────────────┘
```

### 3.3 技术栈选型

| 层级 | 技术选型 | 选型理由 |
|------|---------|---------|
| **前端** | Next.js 16 + React 19 + TypeScript | SSR/SSG 支持、类型安全、生态丰富 |
| **UI 组件** | shadcn/ui + Tailwind CSS | 可定制、无障碍支持、现代设计 |
| **状态管理** | Zustand | 轻量、TypeScript 友好、无样板代码 |
| **后端** | Next.js API Routes + Node.js | 全栈统一、简化部署 |
| **数据库** | PostgreSQL + Prisma | 关系型数据、类型安全 ORM |
| **实时通信** | Socket.IO | WebSocket 封装、自动降级、房间支持 |
| **认证** | NextAuth.js | 多 Provider 支持、Session 管理 |
| **国际化** | next-intl | 与 Next.js 深度集成、支持复数/格式化 |
| **测试** | Vitest + Testing Library | 现代测试框架、组件测试友好 |

---

## 4. 核心功能设计

### 4.1 Agent 管理系统

#### 4.1.1 Agent 创建流程

**设计原则**: 从 7+ 步骤简化到 3 步以内

```
┌─────────────────────────────────────────────────────────────┐
│                     Agent Portal                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  快速创建引导                         │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │   │
│  │  │  🤖          │  │  🔗          │  │  📋      │ │   │
│  │  │  内置助手     │  │  外部接入     │  │  模板    │ │   │
│  │  │              │  │              │  │          │ │   │
│  │  │ • 选择 LLM   │  │ • 选择类型   │  │ • 6种预设│ │   │
│  │  │ • 填 Prompt  │  │ • 一键生成   │  │ • 预装技能│ │   │
│  │  │ • 3 步完成   │  │ • 自动 Token │  │ • 开箱即用│ │   │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │   │
│  │                                                      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  我的 Agents                         │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ 🤖 研发助手    | 内置 | GPT-4    | 🟢在线 | ...     │   │
│  │ 🔗 Hermes Dev | 外部 | ws       | 🟢在线 | ...      │   │
│  │ 🤖 内容助手    | 模板 | Claude  | 🔴离线 | ...      │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**三种创建方式对比**:

| 方式 | 输入步骤 | 技术配置 | 适用场景 | 目标用户 |
|------|---------|---------|---------|---------|
| **内置助手** | 3 步（名称、LLM、Prompt） | 无 | 快速原型、个人助手 | 普通用户 |
| **外部接入** | 2 步（名称、类型） | 系统自动生成 | 接入 Claude Code/Trae | 进阶用户 |
| **职业模板** | 2 步（选择模板、确认） | 预配置 | 专业场景、团队协作 | 普通用户 |

#### 4.1.2 Agent Detail 页面设计

**设计原则**: 5 Tab 简化为 3 Tab，所有操作在同一页面完成

```
┌────────────────────────────────────────────────────────────────┐
│ ← 返回    研发助手    🟢在线    [编辑] [删除]                   │
├────────────────────────────────────────────────────────────────┤
│ [配置]    [对话]    [历史]                                      │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ─────────────── 配置 Tab ───────────────                      │
│                                                                │
│  基本信息                                                      │
│  ├─ 名称: 研发助手                                            │
│  ├─ 描述: 辅助研发团队进行技术调研和代码审查                   │
│  ├─ System Prompt: [编辑区域]                                   │
│  └─ LLM: OpenAI / GPT-4o                                      │
│                                                                │
│  已装配技能                                                    │
│  ├─ 🔍 web-search        [开] [关] [卸载]                     │
│  ├─ 📄 pdf-reader        [开] [关] [卸载]                     │
│  ├─ 💻 code-execution    [开] [关] [卸载]                     │
│  └─ [+ 从 Skill 市场添加]                                     │
│                                                                │
│  ▼ 接入信息（仅外部 Agent 显示）                                │
│  ├─ Agent Token: acrp_xxxxx [复制]                             │
│  ├─ 接入代码: [Python] [JavaScript] [CLI]                    │
│  └─ Capability: [查看列表] [测试调用]                          │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ─────────────── 对话 Tab ───────────────                      │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                         │   │
│  │  Agent: 你好，我是研发助手。有什么可以帮你的？          │   │
│  │                                                         │   │
│  │  User: 帮我搜索 React 19 的新特性                      │   │
│  │                                                         │   │
│  │  Agent: 🔍 [调用 web-search]...                         │   │
│  │         React 19 的新特性包括...                        │   │
│  │                                                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                │
│  [输入消息...] [发送]                                          │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ─────────────── 历史 Tab ───────────────                      │
│                                                                │
│  最近对话                                                       │
│  ├─ 2024-06-01  React 19 调研                                 │
│  ├─ 2024-05-28  代码审查辅助                                  │
│                                                                │
│  Skill 调用记录                                                │
│  ├─ web-search  10次  成功率 100%                            │
│  ├─ pdf-reader  3次   成功率 100%                             │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4.2 Skill 生态系统

#### 4.2.1 Skill 概念统一

**术语映射** (系统内部保留，用户侧统一):

| 系统概念 | 用户可见 | 内部存储 | 说明 |
|---------|---------|---------|------|
| Skill | 技能 | `Skill` | 内置或可调用能力 |
| Plugin | 技能 | `Skill` (handlerType=protocol) | 通过协议连接的外部能力 |
| Connection | (自动) | `AgentConnection` | WebSocket/HTTP 连接 |
| Capability | 自动技能 | `Skill` (handlerType=acrp) | ACRP 自动转换的能力 |

**用户心智模型**:
```
Agent = 数字助手
Skill = Agent 会做的事情（搜索、读文档、执行代码...）

操作: "给我的 Agent 装上 Skills"
```

#### 4.2.2 Skill 装配流程

```mermaid
sequenceDiagram
    actor User
    participant AgentDetail as Agent Detail Page
    participant SkillMarket as Skill Market
    participant API as API
    participant DB as Database
    
    User->>AgentDetail: 点击"添加 Skill"
    AgentDetail->>SkillMarket: 打开 Skill 市场弹窗
    User->>SkillMarket: 浏览/搜索 Skill
    User->>SkillMarket: 点击"添加到 Agent"
    SkillMarket->>API: POST /api/agents/{id}/attach-skill
    API->>API: 自动生成 endpointToken/callbackUrl
    API->>DB: 创建 AgentSkill 记录
    API-->>SkillMarket: 返回成功
    SkillMarket-->>AgentDetail: 刷新 Skill 列表
    AgentDetail-->>User: 显示新装配的 Skill
```

#### 4.2.3 Skill 类型系统

```typescript
// Skill 处理器类型
enum HandlerType {
  BUILTIN = 'builtin',      // 内置实现，直接执行
  WEBHOOK = 'webhook',      // HTTP 回调
  FUNCTION = 'function',    // 函数调用
  ACRP = 'acrp',            // ACRP Agent 能力自动转换
  PROTOCOL = 'protocol',    // Skill Protocol 连接
}

// Skill 分类
enum SkillCategory {
  COMMUNICATION = 'communication',  // 通讯类（邮件、消息）
  PRODUCTIVITY = 'productivity',    // 生产力（日程、提醒）
  DEVELOPMENT = 'development',       // 开发（代码、Git）
  DATA = 'data',                     // 数据（分析、可视化）
  MEDIA = 'media',                   // 媒体（图片、视频、音频）
  UTILITY = 'utility',               // 工具（搜索、计算）
  GENERAL = 'general',               // 通用
}
```

### 4.3 对话系统

#### 4.3.1 对话架构

```mermaid
flowchart TD
    subgraph User["用户输入"]
        UI[Chat UI]
    end
    
    subgraph Routing["路由层"]
        Router{Agent 类型}
    end
    
    subgraph Builtin["内置助手"]
        LLM[LLM Provider]
        SkillExec[Skill Executor]
    end
    
    subgraph External["外部 Agent"]
        WS[WebSocket Gateway]
        ACRP[ACRP Handler]
    end
    
    subgraph Response["响应"]
        Stream[流式响应]
        History[历史存储]
    end
    
    UI --> Router
    Router -->|builtin| LLM
    Router -->|acrp| WS
    LLM --> SkillExec
    SkillExec -->|调用| SkillExec
    WS --> ACRP
    LLM --> Stream
    ACRP --> Stream
    Stream --> History
```

#### 4.3.2 对话特性

| 特性 | 说明 |
|------|------|
| **流式响应** | SSE 实时输出，支持打字效果 |
| **Skill 调用可视化** | 显示 Skill 调用过程和结果 |
| **上下文管理** | Token 超限自动压缩 |
| **多会话** | 支持同时与多个 Agent 对话 |
| **聊天室** | 多 Agent 群聊模式 |

### 4.4 ACRP 协议系统

#### 4.4.1 协议架构

```mermaid
flowchart LR
    subgraph Hub["Hermes Hub"]
        WSS[WebSocket Server]
        Auth[Token Auth]
        Bridge[Capability Bridge]
    end
    
    subgraph Agent["External Agent"]
        Client[WS Client]
        Cap[Capabilities]
    end
    
    Agent -->|1. Connect| WSS
    WSS -->|2. Authenticate| Auth
    Auth -->|3. Register| Bridge
    Bridge -->|4. Convert| Skill
    Agent <-->|5. Bidirectional| WSS
```

#### 4.4.2 连接流程

```
┌─────────────────────────────────────────────────────────────┐
│                   外部 Agent 接入流程                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: Hub 生成 Token                                       │
│  ├─ User: 创建外部 Agent                                     │
│  └─ System: 生成 acrp_xxxxx Token                           │
│                                                              │
│  Step 2: 复制接入代码                                        │
│  ├─ System: 生成 Python/JS/CLI 代码                         │
│  └─ User: 复制代码到本地环境                                  │
│                                                              │
│  Step 3: Agent 连接                                          │
│  ├─ Agent: 使用 Token 连接 ws://localhost:3004               │
│  ├─ Hub: 验证 Token，建立连接                                 │
│  └─ UI: 显示"已连接"状态                                     │
│                                                              │
│  Step 4: Capability 注册                                     │
│  ├─ Agent: 发送 capabilities 列表                            │
│  ├─ Hub: 自动转换为 Skills                                   │
│  └─ Hub: 自动装配到 Agent                                     │
│                                                              │
│  Step 5: 开始使用                                            │
│  ├─ User: 在对话 Tab 发送消息                                │
│  ├─ Hub: 通过 WebSocket 转发                                  │
│  └─ Agent: 处理并返回结果                                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### 4.4.3 Capability 自动转换

```typescript
// Capability (来自外部 Agent) -> Skill (Hub 内部)
interface Capability {
  capabilityId: string;    // "model.switch"
  name: string;            // "切换模型"
  description: string;     // "切换到不同的 LLM 模型"
  category: string;        // "system"
  parameters: JSONSchema;   // 参数定义
}

// 自动转换为
interface Skill {
  id: string;              // 新生成
  name: string;            // "model-switch" (normalized)
  displayName: string;     // "切换模型"
  description: string;     // 同上
  category: string;        // 同上
  handlerType: 'acrp';     // 标记来源
  sourceCapabilityId: string; // "model.switch"
  sourceAgentId: string;   // Agent ID
}
```

### 4.5 模板系统

#### 4.5.1 预置模板列表

| 模板 | 类别 | 预装 Skills | System Prompt 风格 |
|------|------|-------------|-------------------|
| **研发助手** | Development | web-search, code-execution, pdf | 技术专家，代码优先 |
| **运营助手** | Productivity | web-search, charts, ppt, xlsx | 数据驱动，结果导向 |
| **内容创作** | Media | web-search, blog-writer, seo | 创意写作，SEO 优化 |
| **金融分析** | Data | web-search, stock-analysis, finance | 量化分析，风险提示 |
| **项目管理** | Productivity | web-search, auto-target-tracker | 任务拆解，进度追踪 |
| **通用助手** | General | web-search | 友好、通用 |

#### 4.5.2 模板数据结构

```typescript
interface AgentTemplate {
  id: string;
  name: string;              // "research-assistant"
  displayName: string;       // "研发助手"
  description: string;       // "辅助代码开发..."
  category: 'assistant' | 'worker' | 'coordinator';
  icon?: string;             // Lucide icon name
  systemPrompt: string;      // 预设 Prompt
  skillIds: string[];        // 预装 Skill IDs
  config: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}
```

---

## 5. 用户流程设计

### 5.1 新用户首次使用流程

```mermaid
flowchart TD
    Start([访问 Hermes Hub]) --> Register{已有账号?}
    Register -->|否| SignUp[注册账号]
    Register -->|是| Login[登录]
    SignUp --> Login
    
    Login --> Dashboard[进入 Dashboard]
    Dashboard --> FirstAction{首次操作?}
    
    FirstAction -->|创建 Agent| Portal[Agent Portal]
    FirstAction -->|探索 Skills| Market[Skill Market]
    FirstAction -->|查看示例| Examples[示例页面]
    
    Portal --> Create[创建第一个 Agent]
    Create --> Detail[Agent Detail]
    Detail --> Chat[开始对话]
    
    Chat --> Satisfied{满意?}
    Satisfied -->|是| Continue[继续使用]
    Satisfied -->|否| Modify[调整配置]
    Modify --> Chat
    
    Continue --> End([完成])
```

### 5.2 Agent 创建完整流程

#### 流程 A: 内置助手

```
用户路径:
1. Agent Portal → 点击"内置助手"卡片
2. 填写表单:
   - 名称（必填）
   - 描述（可选）
   - 选择 LLM Provider（默认 OpenAI）
   - 选择 Model（默认 GPT-4）
   - System Prompt（可选，有预设模板）
   - 温度设置（可选，默认 0.7）
3. 点击"创建"
4. 系统自动:
   - 创建 Agent 记录
   - 关联 LLM Provider
   - 跳转到 Agent Detail
5. 用户在 Detail 页面直接对话

总步骤: 3 步（Portal → 表单 → Detail）
```

#### 流程 B: 外部接入

```
用户路径:
1. Agent Portal → 点击"外部接入"卡片
2. 选择 Agent 类型:
   - Hermes Agent
   - Claude Code
   - Trae
   - OpenClaw
   - 自定义
3. 填写名称和描述
4. 点击"创建"
5. 系统自动:
   - 创建 Agent 记录
   - 生成 agentToken (acrp_xxxxx)
   - 生成接入代码（Python/JS/CLI）
6. 显示接入引导页面:
   - 显示 Token [复制按钮]
   - 显示代码片段 [切换语言]
   - 实时连接状态指示器
7. 用户在本地运行代码
8. Hub 检测到连接，状态变为"已连接"
9. Capability 自动转为 Skills
10. 用户开始对话

总步骤: 4 步（Portal → 类型选择 → 接入引导 → 对话）
```

#### 流程 C: 从模板创建

```
用户路径:
1. Agent Portal → 点击"职业模板"卡片
2. 浏览模板列表（卡片展示）
3. 点击模板卡片查看详情:
   - 显示描述
   - 显示预装 Skills 列表
   - 显示预设配置
4. 点击"使用此模板"
5. 填写名称（可修改）
6. 点击"创建"
7. 系统自动:
   - 创建 Agent
   - 复制模板配置
   - 预装所有 Skills
8. 跳转到 Agent Detail
9. 用户直接对话或进一步配置

总步骤: 3 步（Portal → 模板选择 → Detail）
```

### 5.3 Skill 装配流程

```
用户路径:
1. 在 Agent Detail → 配置 Tab
2. 查看"已装配 Skills"区域
3. 点击"+ 从 Skill 市场添加"
4. 打开 Skill Market 弹窗:
   - 分类筛选（全部/开发/数据/媒体...）
   - 搜索框
   - Skill 卡片列表（图标、名称、描述）
5. 浏览并找到需要的 Skill
6. 点击 Skill 卡片的"添加"按钮
7. 系统自动:
   - 生成 endpointToken（如需要）
   - 创建 AgentSkill 记录
   - 设置默认配置
8. 弹窗关闭，Skill 列表刷新
9. 新 Skill 默认启用，可立即使用

可选操作:
- 点击 Skill 的开关：启用/禁用
- 点击 Skill 的设置：修改配置
- 点击 Skill 的卸载：移除
```

---

## 6. 数据模型设计

### 6.1 核心实体关系图

```mermaid
erDiagram
    User ||--o{ Agent : creates
    User ||--o{ LLMProvider : configures
    User ||--o{ Conversation : participates
    
    Agent ||--o{ AgentSkill : has
    Agent ||--o{ AgentConnection : has
    Agent ||--o{ Conversation : has
    Agent ||--o{ AgentCapability : registers
    Agent }o--|| AgentTemplate : created_from
    Agent }o--|| LLMProvider : uses
    
    Skill ||--o{ AgentSkill : attached_to
    Skill }o--|| AgentCapability : converted_from
    
    AgentSkill ||--|| Skill : references
    
    Conversation ||--o{ Message : contains
    Conversation }o--o{ User : participants
    
    ChatRoom ||--o{ ChatRoomMember : has
    ChatRoom ||--o{ ChatRoomAgent : has_agents
    
    User ||--o{ ChatRoomMember : joins
    Agent ||--o{ ChatRoomAgent : participates
```

### 6.2 核心模型定义

#### User 模型

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  avatar    String?
  password  String
  bio       String?
  role      String   @default("user") // user, admin
  status    String   @default("online")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  agents         Agent[]
  providers      LLMProvider[]
  conversations  ConversationParticipant[]
  messages       Message[]
  memberships    ChatRoomMember[]
}
```

#### Agent 模型

```prisma
model Agent {
  id          String   @id @default(cuid())
  userId      String
  name        String
  description String?
  avatar      String?
  systemPrompt String?
  
  // 模式
  mode        String   @default("builtin") // builtin, acrp
  agentCategory String @default("assistant") // assistant, worker, coordinator
  
  // LLM 配置
  providerId  String?
  model       String?
  temperature Float?
  maxTokens   Int?
  
  // ACRP 配置
  agentToken      String?   @unique
  agentType       String?   // hermes-agent, claude-code, trae, custom
  agentVersion    String?
  agentPlatform   String?
  agentMetadata   String    @default("{}")
  wsConnected     Boolean   @default(false)
  lastHeartbeatAt DateTime?
  registeredAt    DateTime?
  
  // 模板
  templateId      String?
  
  status      String   @default("offline") // online, offline, busy, error
  isPublic    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user         User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider     LLMProvider?      @relation(fields: [providerId], references: [id])
  template     AgentTemplate?    @relation(fields: [templateId], references: [id])
  skills       AgentSkill[]
  capabilities AgentCapability[]
  conversations Conversation[]
}
```

#### Skill 模型

```prisma
model Skill {
  id            String   @id @default(cuid())
  name          String   @unique
  displayName   String
  description   String
  category      String   @default("general")
  icon          String?
  
  // 处理器配置
  handlerType   String   @default("builtin") // builtin, webhook, function, acrp, protocol
  handlerUrl    String?
  
  // Skill Protocol
  endpointToken    String?  @unique
  callbackUrl      String?
  callbackSecret   String?
  protocolVersion  String   @default("v1")
  events           String   @default("[]")
  wsConnected      Boolean  @default(false)
  
  // 配置
  configSchema     String   @default("{}")
  parameters       String   @default("[]")
  instructions     String   @default("")
  
  // 来源追踪
  sourceType       String   @default("built-in") // built-in, agentskills-registry, git, acrp-auto
  sourceCapabilityId String?
  sourceAgentId      String?
  
  isEnabled     Boolean  @default(true)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  agents AgentSkill[]
}
```

#### AgentSkill 关联模型

```prisma
model AgentSkill {
  id        String  @id @default(cuid())
  agentId   String
  skillId   String
  config    String  @default("{}")
  isEnabled Boolean @default(true)
  priority  Int     @default(0)

  // Skill Protocol 绑定配置
  endpointToken   String?   @unique
  callbackUrl     String?
  callbackSecret  String?
  lastInvokedAt   DateTime?
  invokeCount     Int       @default(0)
  wsConnected     Boolean   @default(false)

  agent Agent @relation(fields: [agentId], references: [id], onDelete: Cascade)
  skill Skill @relation(fields: [skillId], references: [id])

  @@unique([agentId, skillId])
}
```

#### AgentTemplate 模型

```prisma
model AgentTemplate {
  id          String   @id @default(cuid())
  name        String   @unique
  displayName String
  description String
  category    String   @default("assistant")
  icon        String?
  systemPrompt String
  skillIds    String   @default("[]")
  config      String   @default("{}")
  isPublic    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  agents Agent[]
}
```

### 6.3 数据流设计

#### Agent 创建数据流

```mermaid
flowchart LR
    subgraph Input["用户输入"]
        Form[创建表单]
    end
    
    subgraph Service["服务层"]
        AS[AgentService]
        SS[SkillService]
    end
    
    subgraph DB["数据库"]
        Agent[(Agent)]
        AgentSkill[(AgentSkill)]
        Template[(AgentTemplate)]
    end
    
    Form --> AS
    AS -->|创建记录| Agent
    AS -->|需要预装| SS
    SS -->|创建关联| AgentSkill
    Template -->|模板数据| AS
```

---

## 7. 界面设计规范

### 7.1 设计系统

基于 **shadcn/ui** 和 **Tailwind CSS** 构建的设计系统：

#### 颜色系统

```css
/* Primary */
--primary: hsl(222 47% 11%);      /* 深灰蓝 - 主色 */
--primary-foreground: hsl(210 40% 98%);

/* Secondary */
--secondary: hsl(210 40% 96.1%); /* 浅灰 - 辅助 */
--secondary-foreground: hsl(222 47% 11%);

/* Accent */
--accent: hsl(210 40% 96.1%);     /* 强调 */
--accent-foreground: hsl(222 47% 11%);

/* Status */
--success: hsl(142 76% 36%);      /* 绿色 - 在线/成功 */
--warning: hsl(38 92% 50%);       /* 橙色 - 警告 */
--destructive: hsl(0 84% 60%);    /* 红色 - 离线/错误 */

/* Muted */
--muted: hsl(210 40% 96.1%);      /* 背景灰 */
--muted-foreground: hsl(215 16% 47%); /* 次要文字 */
```

#### 字体系统

| 级别 | 大小 | 字重 | 用途 |
|------|------|------|------|
| H1 | 2rem (32px) | 700 | 页面标题 |
| H2 | 1.5rem (24px) | 600 | 区块标题 |
| H3 | 1.25rem (20px) | 600 | 卡片标题 |
| Body | 1rem (16px) | 400 | 正文 |
| Small | 0.875rem (14px) | 400 | 辅助文字 |
| XSmall | 0.75rem (12px) | 400 | 标签 |

#### 间距系统

```css
/* 基于 4px 的倍数 */
--space-1: 0.25rem;  /* 4px */
--space-2: 0.5rem;   /* 8px */
--space-3: 0.75rem;  /* 12px */
--space-4: 1rem;     /* 16px */
--space-6: 1.5rem;   /* 24px */
--space-8: 2rem;     /* 32px */
--space-12: 3rem;    /* 48px */
```

### 7.2 组件规范

#### Agent 卡片

```
┌─────────────────────────────────────────┐
│  ┌─────┐                                │
│  │ 🤖  │  Agent 名称                     │
│  └─────┘  类型标签 | 状态指示            │
│           描述文字...                     │
│  ┌────────┐ ┌────────┐ ┌────────┐       │
│  │ Skill1 │ │ Skill2 │ │ +3    │       │
│  └────────┘ └────────┘ └────────┘       │
└─────────────────────────────────────────┘

规格:
- 宽度: 280px - 320px
- 高度: auto (最小 120px)
- 圆角: 12px (--radius-lg)
- 阴影: sm (默认), md (hover)
- 边框: 1px solid border
- 状态指示: 8px 圆点 (绿色=在线, 灰色=离线)
```

#### Skill 标签

```
┌───────────────────────┐
│  🔍  web-search  [×]  │
└───────────────────────┘

规格:
- 高度: 28px
- 圆角: 6px (--radius-md)
- 背景: secondary
- 图标: 16px Lucide icon
- 删除按钮: 悬停显示
```

#### 对话气泡

```
User:
┌─────────────────────────────┐
│ 用户消息内容                  │
│                    12:34   │
└─────────────────────────────┘

Agent:
┌─────────────────────────────┐
│  🤖 Agent 名称               │
│ Agent 消息内容               │
│ [Skill: web-search]          │
│                    12:35   │
└─────────────────────────────┘

规格:
- 最大宽度: 80%
- 内边距: 12px 16px
- 圆角: 16px
- User: 右侧对齐, primary 背景
- Agent: 左侧对齐, secondary 背景
```

### 7.3 布局规范

#### Agent Portal 布局

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar    │              Main Content                      │
│  (240px)    │                                              │
│             │  ┌─────────────────────────────────────────┐ │
│  Dashboard  │  │           Quick Create Cards            │ │
│  Agents     │  │  [Builtin] [External] [Templates]         │ │
│  Skills     │  └─────────────────────────────────────────┘ │
│  Chat       │                                              │
│  ...        │  ┌─────────────────────────────────────────┐ │
│             │  │           My Agents Grid                │ │
│             │  │  [Card] [Card] [Card] [Card]            │ │
│             │  │  [Card] [Card] ...                      │ │
│             │  └─────────────────────────────────────────┘ │
│             │                                              │
└─────────────────────────────────────────────────────────────┘
```

#### Agent Detail 布局

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar    │              Main Content                      │
│             │                                              │
│             │  ┌─────────────────────────────────────────┐ │
│             │  │  Header: 名称 | 状态 | 操作按钮        │ │
│             │  ├─────────────────────────────────────────┤ │
│             │  │  [配置] [对话] [历史]                    │ │
│             │  ├─────────────────────────────────────────┤ │
│             │  │                                          │ │
│             │  │  Tab Content                             │ │
│             │  │  (配置/对话/历史)                        │ │
│             │  │                                          │ │
│             │  └─────────────────────────────────────────┘ │
│             │                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.4 响应式设计

| 断点 | 宽度 | 布局调整 |
|------|------|---------|
| **Desktop** | ≥1280px | 完整侧边栏 + 主内容区 |
| **Laptop** | 1024-1279px | 可收起侧边栏 |
| **Tablet** | 768-1023px | 侧边栏变底部导航 |
| **Mobile** | <768px | 单栏布局，抽屉导航 |

---

## 8. 技术实现要点

### 8.1 状态管理

使用 **Zustand** 进行全局状态管理：

```typescript
// store.ts
interface AppState {
  // View 状态
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  
  // Agent 状态
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
  
  // Skill 状态
  selectedSkillId: string | null;
  setSelectedSkillId: (id: string | null) => void;
  
  // UI 状态
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}
```

### 8.2 API 设计

#### RESTful API 规范

| 资源 | 操作 | Endpoint | 说明 |
|------|------|----------|------|
| Agent | 创建内置 | POST /api/agents/create-builtin | 简化参数 |
| Agent | 创建外部 | POST /api/agents/create-external | 自动生成 token |
| Agent | 从模板 | POST /api/agents/create-from-template | 自动装配 |
| Agent | 获取详情 | GET /api/agents/{id}/unified-detail | 统一详情 |
| Agent | 装配 Skill | POST /api/agents/{id}/attach-skill | 一键装配 |
| Agent | 对话 | POST /api/agents/{id}/chat | 页内对话 |

#### 错误处理规范

```typescript
interface ApiError {
  error: string;
  details?: string;
  code: string;
}

// HTTP 状态码映射
400 - 参数错误
401 - 未认证
403 - 无权限
404 - 资源不存在
409 - 资源冲突
500 - 服务器错误
```

### 8.3 实时通信

#### WebSocket 连接管理

```typescript
// Socket.IO 事件定义
interface ServerToClientEvents {
  'agent:status': (data: { agentId: string; status: string }) => void;
  'skill:invoked': (data: { agentId: string; skillName: string }) => void;
  'message:new': (data: { conversationId: string; message: Message }) => void;
}

interface ClientToServerEvents {
  'agent:subscribe': (agentId: string) => void;
  'agent:unsubscribe': (agentId: string) => void;
  'message:send': (data: { conversationId: string; content: string }) => void;
}
```

### 8.4 性能优化

| 优化点 | 策略 |
|--------|------|
| **首屏加载** | SSR + 代码分割 + 懒加载 |
| **Agent 列表** | 虚拟滚动 (react-window) |
| **对话历史** | 分页加载 + 无限滚动 |
| **Skill 调用** | 防抖 + 缓存 |
| **图片资源** | Next.js Image 组件优化 |
| **WebSocket** | 自动重连 + 心跳检测 |

---

## 9. 非功能需求

### 9.1 性能指标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| 首屏加载时间 | < 2s | Lighthouse |
| Agent 详情页加载 | < 1.5s | API 响应时间 |
| Skill 装配响应 | < 500ms | API 响应时间 |
| 对话首条消息 | < 3s | 端到端测量 |
| WebSocket 连接 | < 1s | 连接时间 |
| 并发用户支持 | 1000+ | 压力测试 |

### 9.2 安全要求

| 方面 | 措施 |
|------|------|
| **认证** | JWT + Session 双模式，支持 OAuth |
| **授权** | RBAC 权限模型，资源级访问控制 |
| **传输** | HTTPS/WSS 强制加密 |
| **存储** | 敏感字段加密（API Key、Token） |
| **注入** | SQL 注入防护（Prisma ORM） |
| **XSS** | React 自动转义 + CSP 策略 |
| **CSRF** | SameSite Cookie + CSRF Token |

### 9.3 可访问性

| 标准 | 要求 |
|------|------|
| **WCAG** | 2.1 AA 级合规 |
| **键盘** | 全功能支持 Tab 导航 |
| **屏幕阅读器** | ARIA 标签完整 |
| **对比度** | 文本对比度 ≥ 4.5:1 |
| **焦点** | 可见焦点指示器 |

### 9.4 浏览器兼容性

| 浏览器 | 最低版本 |
|--------|---------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

---

## 10. 附录

### 10.1 术语表

| 术语 | 定义 |
|------|------|
| **Agent** | 智能体，可执行任务的 AI 实体 |
| **Skill** | 技能，Agent 的能力模块 |
| **ACRP** | Agent Capability Registration Protocol，智能体能力注册协议 |
| **Capability** | 能力，ACRP Agent 注册的可用功能 |
| **Builtin** | 内置模式，使用云端 LLM 的 Agent |
| **Portal** | 统一入口，Agent 管理的主界面 |
| **Handler** | 处理器，Skill 的执行方式 |
| **Bridge** | 桥接器，ACRP 到 Skill 的自动转换 |

### 10.2 文件清单

| 文件 | 路径 | 说明 |
|------|------|------|
| AgentPortal | `src/components/views/AgentPortal.tsx` | Agent 统一入口 |
| AgentDetail | `src/components/views/AgentDetail.tsx` | Agent 详情页 |
| AgentService | `src/lib/agent-service.ts` | Agent 服务层 |
| SkillService | `src/lib/skill-service.ts` | Skill 服务层 |
| CapabilityBridge | `src/lib/capability-bridge.ts` | 能力自动转换 |
| api-client | `src/lib/api-client.ts` | API 客户端 |

### 10.3 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| v2.1 | 2026-06-04 | 边缘场景补充（章节 11-30） |
| v2.0 | 2026-06-03 | Agent Portal 简化重构 |
| v1.0 | 2026-04-XX | 初始版本发布 |

---

## 11. 异常处理状态机设计

### 11.1 错误分类体系

**必须定义的错误场景**:
1. 外部 Agent 断线
2. LLM 接口超时/失败
3. Skill 调用失败
4. WebSocket 连接异常
5. 数据库操作失败

**错误类型枚举**:
```typescript
enum ErrorCategory {
  CONNECTION_ERROR = 'connection_error',
  AUTHENTICATION_ERROR = 'auth_error',
  TIMEOUT_ERROR = 'timeout_error',
  LLM_ERROR = 'llm_error',
  SKILL_ERROR = 'skill_error',
  DATABASE_ERROR = 'database_error',
  VALIDATION_ERROR = 'validation_error',
  RATE_LIMIT_ERROR = 'rate_limit_error',
  QUOTA_EXCEEDED = 'quota_exceeded',
}
```

**错误严重程度**: INFO / WARNING / ERROR / CRITICAL

### 11.2 外部 Agent 断线处理

**状态机流程**:
```
[已连接] --30s无心跳--> [心跳缺失] --10s--> [已断开]
    |                        |
    |                        v
    |                   [自动重连] --成功--> [已连接]
    |                        |
    |                        v
    |                   [重连失败] --3次--> [需手动恢复]
```

**UI 状态对应表**:

| 状态 | 图标 | 提示文案 | 用户操作 |
|------|------|---------|---------|
| Connected | 🟢 | "在线" | 正常对话 |
| HeartbeatMissing | 🟡 | "连接不稳定..." | 等待自动恢复 |
| Disconnected | 🔴 | "已断开，正在重连(1/3)..." | 等待或手动重连 |
| Failed | ❌ | "连接失败" | [重新连接] [查看配置] |
| ManualRecovery | ⚠️ | "需要重新配置" | [查看接入代码] |

**实现参数**:
- 心跳检测间隔: 30s
- 超时容忍: 10s
- 最大重连次数: 3 次
- 指数退避: 1s, 2s, 4s

### 11.3 LLM 接口错误处理

| HTTP状态 | 错误码 | 自动重试 | 用户提示 | 降级策略 |
|---------|--------|---------|---------|---------|
| 429 | RATE_LIMIT | 3次 | "请求繁忙" | 延迟执行 |
| 504 | TIMEOUT | 1次 | "响应较慢" | 缩短输出 |
| 401 | INVALID_KEY | 否 | "API Key无效" | 无 |
| 403 | QUOTA_EXCEEDED | 否 | "用量已用完" | 提示升级 |
| 500 | SERVER_ERROR | 1次 | "服务暂时不可用" | 切换备用Provider |
| 404 | MODEL_NOT_FOUND | 否 | "模型不可用" | 自动降级 |

### 11.4 Skill 调用失败处理

**对话界面展示**:
```
Agent: 🔍 [调用 web-search]
⚠️ Skill 调用失败
   原因: 网络超时
   [重试] [跳过]
Agent: 抱歉，搜索功能暂时不可用...
```

**处理策略**:
- 超时: 自动重试 2 次
- 执行错误: 不重试
- 网络错误: 自动重试 3 次
- 参数校验失败: 不重试

---

## 12. LLM Provider 配置流程

### 12.1 Provider 管理入口

**位置**: Settings → LLM Providers

### 12.2 配置流程

**Step 1**: 选择 Provider 类型 (OpenAI/Anthropic/Google/Ollama)

**Step 2**: 填写配置
- API Key (必填)
- Base URL (可选)
- 可用模型 (多选)
- 默认模型 (单选)

**Step 3**: 测试连接
```
测试连接...
├─ 验证 API Key... 通过
├─ 获取模型列表... 通过
├─ 测试对话... 通过
└─ 保存配置... 完成
```

### 12.3 配置校验规则
- API Key 格式校验
- 至少选择一个可用模型
- 必须设置默认模型
- 测试连接成功后才能保存

---

## 13. ChatRoom 功能设计

### 13.1 功能概述

支持多 Agent 群聊，用户和多个 Agent 在同一对话中协作。

### 13.2 创建流程

1. 侧边栏 → Chat Rooms → [创建聊天室]
2. 填写名称、描述、选择参与 Agent
3. 开始群聊

### 13.3 数据模型

```prisma
model ChatRoom {
  id          String   @id @default(cuid())
  name        String
  description String?
  createdBy   String
  createdAt   DateTime @default(now())
  members     ChatRoomMember[]
  agents      ChatRoomAgent[]
  messages    ChatRoomMessage[]
}

model ChatRoomMember {
  id       String @id @default(cuid())
  roomId   String
  userId   String
  role     String @default("member")
  joinedAt DateTime @default(now())
}

model ChatRoomAgent {
  id      String @id @default(cuid())
  roomId  String
  agentId String
  addedAt DateTime @default(now())
}
```

---

## 14. Agent 删除流程

### 14.1 删除入口

Agent Detail → [删除] 按钮 (红色危险操作)

### 14.2 认对话框

```
⚠️ 删除 Agent

确定要删除 "研发助手" 吗？

此操作将永久删除：
• Agent 配置信息
• 关联的 Skills
• ACRP 连接记录

[x] 保留对话历史

请输入 Agent 名称以确认:
[研发助手          ]

[取消]    [确认删除]
```

### 14.3 级联删除规则

**必须删除**:
- Agent 记录
- AgentSkill 关联
- AgentConnection 记录

**可选保留**:
- Conversation 记录
- Message 记录

### 14.4 删除后跳转

跳转回 Agent Portal，显示 Toast: "Agent 已删除"

---

## 15. 上下文压缩策略

### 15.1 触发条件

Token 数超过阈值时触发:
- 内置助手: 4000 tokens
- 外部 Agent: 8000 tokens

### 15.2 压缩策略

**策略 1: 截断 (默认)**
- 保留最近 N 条消息
- 丢弃早期消息

**策略 2: 摘要**
- 生成早期消息摘要
- 保留摘要 + 最近消息

### 15.3 用户感知

```
💡 上下文已压缩
   当前对话较长，已自动压缩早期内容。
   [查看详情] [不再提示]
```

---

## 16. 交互逻辑修正

### 16.1 步骤数矛盾

**原问题**: 流程 B 标注"总步骤 4 步"，正文列了 10 步

**修正**: 标注为"核心步骤 3 步"

### 16.2 新建 Agent 跳转 Tab

**原问题**: 创建后直接跳转到对话 Tab

**修正**: 统一跳转到配置 Tab

### 16.3 Skill 弹窗关闭逻辑

**原问题**: 添加后立即关闭弹窗

**修正**: 保持弹窗打开，已添加 Skill 显示禁用状态

### 16.4 历史 Tab 粒度

**原问题**: 对话历史与 Skill 调用统计混放

**修正**: 
- 历史 Tab: 仅对话会话列表
- 配置 Tab: Skill 条目下显示调用统计

---

## 17. 团队协作数据模型

### 17.1 Team 模型

```prisma
model Team {
  id          String   @id @default(cuid())
  name        String
  description String?
  ownerId     String
  createdAt   DateTime @default(now())
  members     TeamMember[]
  agents      Agent[]
}

model TeamMember {
  id     String @id @default(cuid())
  teamId String
  userId String
  role   String @default("member")
  joinedAt DateTime @default(now())
}
```

### 17.2 Agent 可见性

- **private**: 仅创建者可见
- **team**: 团队成员可见
- **public**: 所有人可见

---

## 18. 账单与用量限额

### 18.1 用量统计

```prisma
model UsageRecord {
  id         String   @id @default(cuid())
  userId     String
  agentId    String?
  provider   String
  model      String
  inputTokens  Int
  outputTokens Int
  cost       Float
  createdAt  DateTime @default(now())
}
```

### 18.2 限额机制

**限额层级**:
- 用户级: 总用量限额
- Agent 级: 单个 Agent 限额
- 月度限额: 每月重置

**超额处理**:
1. 达到 80%: 邮件警告
2. 达到 100%: 提示升级，允许超额 10%
3. 超过 110%: 暂停服务

---

## 19. Skill Protocol 连接流程

### 19.1 WebSocket 连接时序

```
1. Client -> Server: ws.connect()
2. Server -> Client: 要求认证
3. Client -> Server: { endpointToken }
4. Server -> Client: 认证成功 + agentId
5. Client -> Server: skill:register { capabilities }
6. Server -> Client: 注册成功确认
7. Server -> Client: 定期 heartbeat (30s)
8. Client -> Server: skill:heartbeat 响应
```

### 19.2 错误处理

- 认证失败: 关闭连接，提示重新配置
- 心跳超时: 标记离线，尝试重连
- 消息格式错误: 返回错误，不关闭连接

---

## 20. 注册登录流程

### 20.1 注册流程

1. 填写邮箱、用户名、密码
2. 箱验证 (发送验证码)
3. 验证成功后进入 Dashboard

### 20.2 OAuth 登录

支持的 Provider:
- GitHub
- Google
- 企业 SSO

### 20.3 安全机制

- 密码强度要求: 8位以上，包含大小写+数字
- 登录失败锁定: 5次失败锁定15分钟
- Session 过期: 7天

---

## 21. Agent 编辑流程

### 21.1 编辑模式切换

**Agent Detail → 配置 Tab** 有两种模式：

| 模式 | 触发 | 可编辑内容 | 保存方式 |
|------|------|------------|---------|
| **查看模式** | 默认 | 仅查看，不可编辑 | 无 |
| **编辑模式** | 点击[编辑]按钮 | 名称、描述、System Prompt、LLM 配置 | [保存] [取消] |

**编辑按钮位置**: Agent Detail 页面右上角

### 21.2 各字段编辑规范

#### 名称
- 类型: 单行文本
- 校验: 非空，1-50 字符，不允许纯空格
- 实时校验: 输入时即时显示错误

#### 描述
- 类型: 多行文本
- 校验: 0-500 字符
- 可选字段

#### System Prompt
- 类型: 多行文本 (代码编辑器风格)
- 字数统计: 实时显示字符数
- 模板库: 点击[从模板选择]加载预设 Prompt
- 保存行为: 修改 System Prompt 后需要确认"是否重新开始对话?"

#### LLM 配置
- Provider: 下拉选择 (仅显示已配置的 Provider)
- Model: 下拉选择 (仅显示该 Provider 的可用模型)
- Temperature: 滑块 (0.0 - 2.0, 步进 0.1)
- Max Tokens: 数字输入 (100 - 32000)

### 21.3 编辑保存流程

```
1. 用户点击 [编辑]
2. 页面进入编辑模式:
   - 所有可编辑字段变为输入状态
   - 显示 [保存] [取消] 按钮
   - [删除] 按钮隐藏 (防止误操作)
3. 用户修改字段
4. 修改时实时校验:
   - 无效输入: 红色边框 + 错误提示
   - 有效输入: 正常显示
5. 用户点击 [保存]:
   - 前端校验通过
   - 调用 PATCH /api/agents/{id}
   - 成功: Toast "已保存"，退出编辑模式
   - 失败: Toast "保存失败"，保持编辑模式
6. 用户点击 [取消]:
   - 所有修改丢弃
   - 恢复查看模式
```

### 21.4 脏数据检测

- 任何字段修改后，[保存]按钮高亮
- 用户尝试离开页面时弹出确认对话框:
  "您有未保存的更改，是否放弃修改?"

---

## 22. 对话消息交互规范

### 22.1 消息类型

| 类型 | 样式 | 来源 | 特殊处理 |
|------|------|------|---------|
| **用户消息** | 右对齐，primary 背景 | 用户输入 | 可编辑（发送后30s内） |
| **Agent 消息** | 左对齐，secondary 背景 | LLM/ACRP | 不可编辑 |
| **系统消息** | 中间对齐，muted 背景 | 系统通知 | 灰色小字 |
| **Skill 调用** | 左对齐，带图标 | Agent 触发 | 可展开详情 |
| **错误消息** | 左对齐，destructive 背景 | 异常 | 带[重试]按钮 |

### 22.2 消息操作

#### 用户消息操作

| 操作 | 触发方式 | 条件 | 说明 |
|------|---------|------|------|
| **复制** | 右键菜单 / 长按 | 始终可用 | 复制消息原文 |
| **编辑** | 右键菜单 / 双击 | 发送后 30s 内 | 编辑后重新发送 |
| **删除** | 右键菜单 / 长按 | 仅自己的消息 | 删除后显示"消息已删除" |
| **重新发送** | 右键菜单 | 消息发送失败时 | 重新尝试发送 |

#### Agent 消息操作

| 操作 | 触发方式 | 条件 | 说明 |
|------|---------|------|------|
| **复制** | 右键菜单 / 长按 | 始终可用 | 复制消息原文 |
| **引用回复** | 右键菜单 | 始终可用 | 在回复中引用此消息 |
| **评分** | 消息底部按钮 | 始终可用 | 👍 / 👎 评分 |
| **查看详情** | 消息底部按钮 | Skill 调用消息 | 展开调用参数和结果 |

### 22.3 消息编辑流程

```
1. 用户双击自己发送的消息 (30s内)
2. 消息进入编辑状态:
   - 消息内容变为输入框
   - 显示 [保存] [取消] 按钮
3. 用户修改内容
4. 点击 [保存]:
   - 原消息标记为"已编辑"
   - 发送新消息到 Agent
   - Agent 根据新消息重新生成回复
5. 点击 [取消]:
   - 恢复原文
```

### 22.4 Skill 调用消息展开

```
折叠状态:
┌─────────────────────────────────┐
│ 🔍 [web-search] "今天天气"      │
└─────────────────────────────────┘

展开状态:
┌─────────────────────────────────┐
│ 🔍 web-search 调用详情          │
├─────────────────────────────────┤
│ 输入参数:                       │
│   query: "今天天气"             │
│   maxResults: 5                 │
│                                 │
│ 输出结果:                       │
│   [1] 北京: 晴, 28°C           │
│   [2] 上海: 多云, 25°C         │
│   调用耗时: 1.2s               │
│                                 │
│ [收起详情]                      │
└─────────────────────────────────┘
```

### 22.5 消息渲染规范

| 内容类型 | 渲染方式 | 说明 |
|---------|---------|------|
| **Markdown** | react-markdown | 支持标题、列表、链接 |
| **代码块** | 语法高亮 + 复制按钮 | 支持 30+ 语言 |
| **图片** | 内联显示 + 点击放大 | URL 图片自动渲染 |
| **表格** | HTML 表格 | Markdown 表格渲染 |
| **链接** | 可点击 + 安全提示 | 外部链接显示安全提示 |
| **LaTeX** | KaTeX 渲染 | 数学公式支持 |

---

## 23. 系统通知机制

### 23.1 通知类型

| 类型 | 触发场景 | 展示方式 | 持续时间 |
|------|---------|---------|---------|
| **Agent 状态变更** | 在线/离线/断线 | Toast + 侧边栏图标更新 | 5s |
| **Skill 调用结果** | 调用成功/失败 | 对话内展示 | 永久 |
| **用量告警** | 达到 80%/100% | 顶部 Banner + 邮件 | 持久 |
| **协作邀请** | 被邀请加入 Team | Toast + 通知列表 | 持久 |
| **系统更新** | 版本升级/维护 | 全屏 Banner | 持久 |

### 23.2 通知中心

**入口**: 侧边栏 → Notifications (🔔图标带未读数)

```
┌─────────────────────────────────────────┐
│ 通知中心                    [全部已读]  │
├─────────────────────────────────────────┤
│ 🔴 Agent "研发助手" 已离线        2m  │
│ 🟢 Agent "Hermes Dev" 已连接     5m  │
│ ⚠️ 用量已达 80%                  1h  │
│ 📧 李工邀请您加入团队            2h  │
│                                         │
│ [查看全部]                              │
└─────────────────────────────────────────┘
```

### 23.3 通知数据模型

```prisma
model Notification {
  id         String   @id @default(cuid())
  userId     String
  type       String   // agent_status, skill_result, quota_alert, team_invite, system_update
  title      String
  message    String
  read       Boolean  @default(false)
  actionUrl  String?  // 点击后跳转的 URL
  createdAt  DateTime @default(now())
}
```

---

## 24. 权限矩阵

### 24.1 角色定义

| 角色 | 范围 | 权限 |
|------|------|------|
| **owner** | Team | 全部权限 + 管理成员 + 删除 Team |
| **admin** | Team | 管理 Agent + 管理成员 + 配置 |
| **member** | Team | 使用 Team Agent + 对话 + 查看历史 |
| **user** | 个人 | 管理自己的 Agent + Skill + 对话 |
| **guest** | 受邀 | 仅对话（对 public Agent） |

### 24.2 操作权限矩阵

| 操作 | owner | admin | member | user | guest |
|------|-------|-------|--------|------|-------|
| 创建 Agent | ✅ | ✅ | ✅(仅个人) | ✅ | ❌ |
| 编辑 Agent | ✅(全部) | ✅(Team内) | ✅(仅自己) | ✅(仅自己) | ❌ |
| 删除 Agent | ✅(全部) | ✅(Team内) | ✅(仅自己) | ✅(仅自己) | ❌ |
| 装配 Skill | ✅ | ✅ | ✅(仅自己) | ✅(仅自己) | ❌ |
| 与 Agent 对话 | ✅ | ✅ | ✅ | ✅ | ✅(仅public) |
| 查看 Agent 配置 | ✅ | ✅ | ✅(Team内) | ✅(仅自己) | ❌ |
| 管理 Provider | ✅ | ✅ | ✅(仅自己) | ✅(仅自己) | ❌ |
| 查看 Dashboard | ✅ | ✅ | ✅(受限) | ✅(受限) | ❌ |
| 管理团队成员 | ✅ | ✅ | ❌ | ❌ | ❌ |
| 删除 Team | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 25. 搜索功能设计

### 25.1 搜索入口

**全局搜索**: Command Palette (⌘K / Ctrl+K)

### 25.2 搜索范围

| 搜索对象 | 索引字段 | 结果展示 |
|---------|---------|---------|
| **Agent** | 名称、描述、System Prompt | Agent 卡片 + [查看] |
| **Skill** | 名称、displayName、描述 | Skill 标签 + [添加到Agent] |
| **对话历史** | 消息内容 | 消息片段 + [打开对话] |
| **模板** | 名称、displayName、描述 | 模板卡片 + [使用] |
| **Provider** | 名称、provider | Provider 卡片 + [配置] |

### 25.3 搜索交互

```
┌─────────────────────────────────────────┐
│ 🔍 搜索...                              │
├─────────────────────────────────────────┤
│                                         │
│ Agent                                   │
│ ├─ 🤖 研发助手  → [查看]               │
│ ├─ 🔗 Hermes Dev → [查看]              │
│                                         │
│ Skill                                   │
│ ├─ 🔍 web-search → [添加]              │
│ ├─ 💻 code-execution → [添加]          │
│                                         │
│ 对话                                    │
│ ├─ "React 19 调研" → [打开]            │
│ ├─ "代码审查辅助" → [打开]             │
│                                         │
│ 模板                                    │
│ ├─ 📋 研发助手 → [使用模板]             │
│                                         │
└─────────────────────────────────────────┘
```

### 25.4 搜索排序规则

1. 确名称匹配优先
2. 当前用户创建的内容优先
3. 最近修改/使用优先
4. 按类别分组展示

---

## 26. 键盘快捷键

### 26.1 全局快捷键

| 快捷键 | 功能 | 适用范围 |
|--------|------|---------|
| ⌘K / Ctrl+K | 打开 Command Palette | 全局 |
| ⌘1 | Dashboard | 全局 |
| ⌘2 | Agent Portal | 全局 |
| ⌘3 | Agent Detail (当前选中) | 全局 |
| ⌘4 | Provider Manager | 全局 |
| ⌘5 | Skill Marketplace | 全局 |
| ⌘6 | Chat | 全局 |
| ⌘7 | Chat Rooms | 全局 |
| ⌘8 | Settings | 全局 |
| ⌘/ | 切换侧边栏 | 全局 |
| ⌘. | 关闭弹窗/对话框 | 全局 |

### 26.2 对话快捷键

| 快捷键 | 功能 | 适用范围 |
|--------|------|---------|
| Enter | 发送消息 | 对话输入框 |
| Shift+Enter | 换行 | 对话输入框 |
| ⌘Shift+C | 复制最后一条回复 | 对话页面 |
| ⌘R | 重新生成回复 | 对话页面 |
| ↑ | 编辑上一条消息(30s内) | 对话输入框 |

### 26.3 Agent Detail 快捷键

| 快捷键 | 功能 | 适用范围 |
|--------|------|---------|
| ⌘E | 进入编辑模式 | Agent Detail |
| ⌘S | 保存编辑 | 编辑模式 |
| Escape | 退出编辑/取消操作 | Agent Detail |

---

## 27. 数据导出/导入

### 27.1 Agent 配置导出

**入口**: Agent Detail → [更多] → [导出配置]

**导出格式**: JSON
```json
{
  "version": "2.0",
  "exportedAt": "2026-06-04T12:00:00Z",
  "agent": {
    "name": "研发助手",
    "description": "辅助研发...",
    "systemPrompt": "你是一个技术专家...",
    "mode": "builtin",
    "agentCategory": "assistant",
    "model": "gpt-4",
    "temperature": 0.7,
    "maxTokens": 2048
  },
  "skills": [
    { "name": "web-search", "config": {} },
    { "name": "code-execution", "config": {} }
  ]
}
```

### 27.2 对话历史导出

**入口**: 对话页面 → [更多] → [导出对话]

**导出格式**: Markdown
```markdown
# 对话: React 19 调研
## 日期: 2026-06-04

### User
帮我搜索 React 19 的新特性

### Agent (研发助手)
🔍 [调用 web-search] ...

React 19 的新特性包括:
- Server Components
- Actions
...
```

### 27.3 Agent 配置导入

**入口**: Agent Portal → [更多] → [导入配置]

**流程**:
1. 选择 JSON 文件上传
2. 系统解析并校验格式
3. 预览配置内容
4. 用户确认创建
5. 自动创建 Agent + 装配 Skills

---

## 28. Provider 故障切换

### 28.1 故障检测

**检测方式**:
- 每次对话调用时检测响应状态
- 定时健康检查 (每 5 分钟 ping 一次)

### 28.2 切换流程

```
1. 检测到 Provider A 故障 (连续3次调用失败)
2. 查找备用 Provider B (同类型,已配置,健康)
3. 自动切换:
   - 临时将 Agent 的 providerId 改为 Provider B
   - 通知用户: "已自动切换到 Provider B"
4. Provider A 恢复后:
   - 通知用户: "Provider A 已恢复"
   - 不自动切回 (避免频繁切换)
   - 用户可手动切回
```

### 28.3 健康检查 API

```typescript
// GET /api/providers/health
interface ProviderHealth {
  providerId: string;
  status: 'healthy' | 'degraded' | 'down';
  lastCheck: DateTime;
  responseTimeMs: number;
  errorRate: number; // 最近 1h 的错误率
}
```

---

## 29. Agent 状态转换图

### 29.1 状态定义

| 状态 | 含义 | 触发条件 |
|------|------|---------|
| **offline** | 未连接 | 默认状态/Agent 创建后 |
| **online** | 正常运行 | 内置助手: LLM 可用; 外部: WS 连接 |
| **busy** | 正在处理 | 正在执行对话/Skill调用 |
| **error** | 异常状态 | Provider故障/连接失败 |
| **disconnected** | 临时断开 | 心跳缺失(外部Agent) |

### 29.2 状态转换规则

```
offline ──创建──→ offline
offline ──首次对话──→ online (内置助手)
offline ──WS连接──→ online (外部Agent)
online ──收到对话──→ busy
busy ──对话完成──→ online
online ──Provider故障──→ error
online ──心跳缺失──→ disconnected
disconnected ──重连成功──→ online
disconnected ──重连失败──→ error
error ──Provider恢复──→ online (需手动)
error ──重新连接──→ online (需手动)
```

### 29.3 UI 状态指示器

```
🟢 online    → 绿色实心圆点 + "在线"
🟡 busy      → 绿色脉冲圆点 + "处理中..."
🔴 offline   → 灰色圆点 + "离线"
❌ error     → 红色圆点 + "异常" + [修复]按钮
🟡 disconnected → 黄色圆点 + "重连中..." + 重连计数
```

---

## 30. 全局 Chat 与 Detail 对话统一

### 30.1 统一会话模型

**核心规则**: 全局 Chat 和 Agent Detail 的对话 Tab 共享同一套 Conversation 数据。

```prisma
model Conversation {
  id          String @id @default(cuid())
  agentId     String
  title       String?
  createdAt   DateTime @default(now())
  messages    Message[]
}
```

### 30.2 两个入口的定位

| 入口 | 侧边栏 Chat | Agent Detail 对话 Tab |
|------|-------------|---------------------|
| **定位** | 全局对话入口，可切换 Agent | 特定 Agent 的专属对话 |
| **默认行为** | 显示最近对话列表 | 直接进入当前 Agent 对话 |
| **创建对话** | 选择 Agent → 开始新对话 | 自动开始/继续对话 |
| **切换 Agent** | 可以 | 不可以（固定当前 Agent） |
| **数据源** | 同一个 Conversation 表 | 同一个 Conversation 表 |

### 30.3 交互规则

1. 在 Chat 中选中 Agent A 的对话 → 跳转到 Agent A 的 Detail 对话 Tab → 显示同一对话
2. 在 Detail 对话 Tab 中新发的消息 → Chat 中也能看到
3. 在 Chat 中新发的消息 → Detail 对话 Tab 中也能看到
4. 两个入口的消息流实时同步（通过 WebSocket）

---

**文档结束**

*本文档由 Hermes Hub 产品团队维护*  
*最后更新: 2026-06-04*
