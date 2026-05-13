# Hermes Hub — 产品文档

> **版本**: 0.2.0  
> **最后更新**: 2025-06-13  
> **仓库**: github.com/hongmaple0820/hermes-hub  
> **状态**: 积极开发中 (Active Development)

---

## 1. 产品定位

### 1.1 一句话描述

**Hermes Hub** 是一个多 Agent 协作平台，让用户创建、管理和协作运行 AI Agent，支持多 LLM 提供商接入、标准化技能插件系统、实时聊天、ACRP 外部 Agent 接入协议、DAG 工作流引擎和多 Agent 协作协议。

### 1.2 目标用户

| 用户类型 | 场景 |
|---------|------|
| **AI 开发者** | 构建和管理多个 AI Agent，快速切换 LLM 提供商和模型 |
| **企业用户** | 通过工作流自动化业务流程，使用多 Agent 协作处理复杂任务 |
| **研究人员** | 对比不同 LLM 提供商的表现，测试 Agent 协作模式 |
| **个人用户** | 统一管理个人 AI 助手，通过技能插件扩展 Agent 能力 |

### 1.3 核心价值主张

1. **统一入口**: 一个平台管理所有 AI Agent 和 LLM 提供商
2. **技能生态**: 标准化技能插件系统，Agent 可按需安装和调用技能
3. **工作流编排**: 可视化 DAG 工作流引擎，12 种节点类型支持复杂业务逻辑
4. **多 Agent 协作**: 6 种协作模式（委派、转交、广播、流水线、轮询、共识）
5. **开放接入**: ACRP 协议支持外部 Agent 接入，实现跨平台互操作

---

## 2. 功能模块总览

### 2.1 模块地图

```
┌─────────────────────────────────────────────────────────────────┐
│                        Hermes Hub                                │
├─────────┬──────────┬──────────┬──────────┬──────────┬──────────┤
│  认证   │  Agent   │   聊天   │  技能    │  工作流   │  协作    │
│  系统   │  管理    │   系统   │  市场    │  引擎    │  协议    │
├─────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│  LLM    │  终端    │  通道    │  定时    │  记忆    │  通知    │
│  提供商 │  仿真    │  对接    │  任务    │  系统    │  系统    │
├─────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│  文件   │  日志    │  用量    │  配置    │  分析    │  搜索    │
│  系统   │  系统    │  追踪    │  文件    │  仪表盘  │  系统    │
└─────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

### 2.2 功能模块详细说明

#### 2.2.1 认证与用户系统

| 功能 | 描述 | 状态 |
|------|------|------|
| 用户注册/登录 | 邮箱+密码注册，bcrypt 密码哈希 | ✅ 已实现 |
| JWT 认证 | HS256 签名，httpOnly Cookie + Bearer Token 双模式 | ✅ 已实现 |
| Token 刷新 | Access Token 7天 + Refresh Token 30天 | ✅ 已实现 |
| 密码修改 | 支持修改密码 | ✅ 已实现 |
| OAuth 集成 | Codex / Nous / Copilot 设备码授权流程 | ✅ 已实现 |
| 用户资料 | 头像、昵称、个人简介 | ✅ 已实现 |
| 速率限制 | 通用 API 60次/分钟，认证 API 10次/分钟 | ✅ 已实现 |
| API Key 加密 | AES-256-GCM 加密存储，界面掩码显示 | ✅ 已实现 |

#### 2.2.2 Agent 管理系统

| 功能 | 描述 | 状态 |
|------|------|------|
| 创建 Agent | 支持内置(builtin)和 ACRP 两种模式 | ✅ 已实现 |
| Agent 配置 | 系统提示词、模型选择、温度、最大Token | ✅ 已实现 |
| Agent 状态 | online / offline / busy / error 四种状态 | ✅ 已实现 |
| Agent 发现 | 浏览公开 Agent 列表 | ✅ 已实现 |
| Agent 技能绑定 | 为 Agent 安装/卸载/启用/禁用技能 | ✅ 已实现 |
| Agent 插件 | Webhook / Function / Hermes-Protocol 三种类型 | ✅ 已实现 |
| Agent 连接管理 | WebSocket 连接配置和状态监控 | ✅ 已实现 |
| ACRP 协议 | Agent 能力注册协议，外部 Agent 通过 WebSocket 接入 | ✅ 已实现 |
| Agent 控制中心 | 统一管理 Agent 能力调用和状态 | ✅ 已实现 |

#### 2.2.3 LLM 提供商系统

| 功能 | 描述 | 状态 |
|------|------|------|
| 多提供商支持 | OpenAI / Anthropic / Google / Ollama / Custom / Z-AI | ✅ 已实现 |
| 提供商管理 | 增删改查，API Key 加密存储 | ✅ 已实现 |
| 模型配置 | 自定义模型列表，默认模型设置 | ✅ 已实现 |
| 连接测试 | 测试 API Key 和端点可用性 | ✅ 已实现 |
| 加密状态 | 查询 API Key 加密状态 | ✅ 已实现 |

#### 2.2.4 聊天系统

| 功能 | 描述 | 状态 |
|------|------|------|
| 1对1对话 | 与单个 Agent 的私密对话 | ✅ 已实现 |
| 对话管理 | 创建、列表、删除、继续对话 | ✅ 已实现 |
| 消息类型 | text / image / file / system / tool_call / tool_result | ✅ 已实现 |
| 流式响应 | SSE 实时流式输出 Agent 回复 | ✅ 已实现 |
| 停止生成 | 支持中途停止流式响应 | ✅ 已实现 |
| 对话血缘 | 追踪对话压缩/续接的完整链路 | ✅ 已实现 |
| 上下文压缩 | 自动压缩过长对话历史 | ✅ 已实现 |
| 搜索会话 | 搜索历史对话内容 | ✅ 已实现 |

#### 2.2.5 聊天室（多 Agent）

| 功能 | 描述 | 状态 |
|------|------|------|
| 创建聊天室 | 多 Agent 协作讨论空间 | ✅ 已实现 |
| 加入/离开 | 邀请码加入，成员管理 | ✅ 已实现 |
| Agent 参与 | 多个 Agent 加入同一聊天室 | ✅ 已实现 |
| Token 触发 | 达到 Token 阈值时自动触发 Agent 发言 | ✅ 已实现 |
| 上下文压缩 | 聊天室对话历史自动压缩 | ✅ 已实现 |
| 实时消息 | Socket.IO 实时推送 | ✅ 已实现 |

#### 2.2.6 技能市场

| 功能 | 描述 | 状态 |
|------|------|------|
| 技能列表 | 浏览所有可用技能，按分类筛选 | ✅ 已实现 |
| 安装/卸载 | 一键安装技能到 Agent，支持卸载 | ✅ 已实现 |
| 技能分类 | communication / productivity / development / data / media / utility / general | ✅ 已实现 |
| 技能详情 | 查看 Markdown 指令、参数定义、来源信息 | ✅ 已实现 |
| 导入技能 | 从 JSON/YAML 导入自定义技能 | ✅ 已实现 |
| 内置技能 | 12 个内置技能（web-search, image-gen, TTS, 翻译等） | ✅ 已实现 |
| 技能协议 | WebSocket 双向通信，心跳保活，事件订阅 | ✅ 已实现 |

**内置技能清单：**

| 技能名 | 描述 | 后端实现 |
|--------|------|---------|
| `web-search` | 网页搜索 | ✅ Z-AI SDK |
| `image-generation` | AI 图片生成 | ✅ Z-AI SDK |
| `text-to-speech` | 文本转语音 | ✅ Z-AI SDK |
| `translation` | 多语言翻译 | ✅ Z-AI SDK |
| `code-execution` | JavaScript 代码执行 | ✅ 沙盒执行 |
| `http-request` | HTTP 请求发送 | ✅ 真实 HTTP |
| `weather-query` | 天气查询 | ⚠️ Mock 数据 |
| `document-processing` | 文档处理 | ⚠️ Mock 数据 |
| `data-analysis` | 数据分析 | ⚠️ Mock 数据 |
| `email-sender` | 邮件发送 | ⚠️ Mock 数据 |
| `database-query` | 数据库查询 | ⚠️ Mock 数据 |
| `reminder` | 提醒设置 | ⚠️ Mock 数据 |

#### 2.2.7 工作流引擎

| 功能 | 描述 | 状态 |
|------|------|------|
| DAG 工作流 | 有向无环图工作流定义和执行 | ✅ 已实现 |
| 12 种节点类型 | agent-call / skill-invoke / condition / transform / parallel / merge / http-request / code-exec / human-input / delay / sub-workflow / loop | ✅ 已实现 |
| 4 种边类型 | default / condition-true / condition-false / error | ✅ 已实现 |
| 可视化编辑器 | SVG 画布，拖拽节点，贝塞尔曲线连线，缩放平移 | ✅ 已实现 |
| 模板变量 | `{{variables.key}}` / `{{nodes.id.output}}` 模板替换 | ✅ 已实现 |
| 条件分支 | JSONPath / JavaScript 表达式条件判断 | ✅ 已实现 |
| 错误策略 | stop / skip / fallback 三种错误处理策略 | ✅ 已实现 |
| 重试策略 | 指数退避重试 | ✅ 已实现 |
| 执行记录 | 完整的工作流执行历史和节点结果 | ✅ 已实现 |
| 取消/恢复 | 支持取消和恢复工作流执行 | ✅ 已实现 |
| 触发方式 | manual / webhook / schedule / event / api | ✅ 已实现 |
| 人工审批 | human-input 节点暂停等待人工输入 | ✅ 已实现 |
| 子工作流 | 嵌套调用其他工作流 | ✅ 已实现 |
| 循环节点 | 遍历数组执行循环体 | ✅ 已实现 |

#### 2.2.8 Agent 协作协议

| 协作模式 | 描述 | 状态 |
|---------|------|------|
| **委派 (Delegation)** | Agent A 将子任务委派给 Agent B，获取结果 | ✅ 已实现 |
| **转交 (Handoff)** | Agent A 将对话上下文转交给 Agent B | ✅ 已实现 |
| **广播 (Broadcast)** | Agent A 同时向多个 Agent 发送任务，聚合结果 | ✅ 已实现 |
| **流水线 (Pipeline)** | 多个 Agent 顺序处理，前一个输出作为后一个输入 | ✅ 已实现 |
| **轮询 (Round Robin)** | 多个 Agent 轮流发言讨论 | ✅ 已实现 |
| **共识 (Consensus)** | 多个 Agent 独立评估后投票表决 | ✅ 已实现 |

聚合策略: best / merge / vote / first-success  
投票策略: majority / unanimous / weighted

#### 2.2.9 Agent 记忆系统

| 功能 | 描述 | 状态 |
|------|------|------|
| 三段式记忆 | memory(知识) / user(偏好) / soul(人格) | ✅ 已实现 |
| 记忆 CRUD | 读取、更新、追加、清除记忆 | ✅ 已实现 |
| 记忆搜索 | 关键词搜索，相关度排序 | ✅ 已实现 |
| 记忆压缩 | LLM 摘要压缩 + 简单截断两种方式 | ✅ 已实现 |
| 自动学习 | 从用户对话中提取偏好和事实 | ✅ 已实现 |
| 上下文注入 | 自动将记忆注入 Agent 系统提示词 | ✅ 已实现 |

#### 2.2.10 通道系统

| 功能 | 描述 | 状态 |
|------|------|------|
| 多平台对接 | Telegram / Discord / Slack / WhatsApp / Matrix / 飞书 / 微信 / 企微 | ✅ 已实现(框架) |
| 通道配置 | 平台特定配置（Token、ID等） | ✅ 已实现 |
| 启用/禁用 | 独立控制每个通道的启用状态 | ✅ 已实现 |
| 同步状态 | 连接状态监控 | ✅ 已实现 |

> ⚠️ 通道系统目前已有数据模型和 API，但实际消息桥接功能尚未实现，需要对接各平台 API。

#### 2.2.11 定时任务

| 功能 | 描述 | 状态 |
|------|------|------|
| 任务管理 | 创建、暂停、恢复、删除定时任务 | ✅ 已实现 |
| Cron 调度 | Cron 表达式定义执行时间 | ✅ 已实现 |
| Agent 绑定 | 指定执行任务的 Agent | ✅ 已实现 |
| 技能绑定 | 任务可调用指定技能 | ✅ 已实现 |
| 投递目标 | 指定结果投递到 IM 平台 | ✅ 已实现 |
| 执行统计 | 完成次数、最后状态、错误信息 | ✅ 已实现 |

#### 2.2.12 其他系统

| 模块 | 功能 | 状态 |
|------|------|------|
| **文件系统** | 虚拟文件系统，支持 local / docker / ssh / singularity 后端 | ✅ 已实现 |
| **终端仿真** | xterm.js 终端，WebSocket 实时交互，会话隔离 | ✅ 已实现 |
| **日志系统** | agent / gateway / error / access 四类日志，分级记录 | ✅ 已实现 |
| **用量追踪** | Token 消耗统计，费用估算，按 Agent / 对话分组 | ✅ 已实现 |
| **分析仪表盘** | 实时统计概览，趋势图表，Agent / 用量 / 技能分布 | ✅ 已实现 |
| **通知系统** | 9 种通知类型，实时推送 + 持久化存储 | ✅ 已实现 |
| **多配置文件** | 多环境 Profile 切换，导入/导出配置 | ✅ 已实现 |
| **全局搜索** | 搜索历史会话内容 | ✅ 已实现 |
| **国际化** | 8 语言支持 (en/zh/ja/ko/fr/de/es/pt) | ✅ 已实现 |
| **深色模式** | 亮色/暗色主题切换 | ✅ 已实现 |

---

## 3. 用户流程

### 3.1 新用户入门流程

```
注册账号 → 登录 → 添加 LLM 提供商(如 OpenAI) → 创建第一个 Agent → 开始聊天
```

### 3.2 Agent 使用流程

```
创建 Agent → 配置系统提示词 → 选择模型 → 安装技能 → 开始对话
                                                    ↓
                                              查看记忆 → 压缩记忆
```

### 3.3 工作流使用流程

```
创建工作流 → 拖拽节点 → 配置节点参数 → 连接边 → 保存 → 激活 → 手动/自动触发执行
                                                                     ↓
                                                               查看执行记录
```

### 3.4 多 Agent 协作流程

```
选择协作模式(如 Pipeline) → 选择参与 Agent → 输入任务 → 执行 → 查看聚合结果
```

### 3.5 ACRP 外部 Agent 接入流程

```
生成 Agent Token → 外部 Agent 使用 Token 连接 WebSocket → 注册能力 → 心跳保活 → 平台调用能力
```

---

## 4. 界面视图

| 视图 | 组件 | 描述 |
|------|------|------|
| **Dashboard** | Dashboard.tsx | 统计概览，趋势图表，快捷操作 |
| **Agent 管理** | AgentManager.tsx | Agent 列表、创建、编辑、删除 |
| **Agent 详情** | AgentDetail.tsx | Agent 配置、技能、对话、能力详情 |
| **Agent 控制中心** | AgentControlCenter.tsx | 统一控制和监控 Agent |
| **LLM 提供商** | ProviderManager.tsx | 提供商管理，API Key 配置 |
| **技能市场** | SkillMarketplace.tsx | 技能浏览、安装、详情 |
| **聊天** | ChatView.tsx | 1对1对话，流式响应 |
| **聊天室** | ChatRoomManager.tsx | 多 Agent 聊天室 |
| **工作流** | WorkflowEditor.tsx | DAG 可视化编辑器和执行监控 |
| **通道** | ChannelsView.tsx | IM 平台对接配置 |
| **定时任务** | JobsView.tsx | Cron 任务管理 |
| **用量** | UsageView.tsx | Token 消耗和费用统计 |
| **配置文件** | ProfilesView.tsx | 多环境 Profile 管理 |
| **记忆** | MemoryView.tsx | Agent 记忆管理 |
| **日志** | LogsView.tsx | 系统日志查看 |
| **文件** | FilesView.tsx | 虚拟文件系统 |
| **终端** | TerminalView.tsx | xterm.js 终端仿真 |
| **搜索** | SessionSearch.tsx | 会话内容搜索 |
| **设置** | Settings.tsx | 全局设置 |

---

## 5. 国际化

支持 8 种语言，翻译文件位于 `src/i18n/locales/`：

| 语言 | 代码 | 文件 |
|------|------|------|
| English | en | en.json |
| 简体中文 | zh | zh.json |
| 日本語 | ja | ja.json |
| 한국어 | ko | ko.json |
| Français | fr | fr.json |
| Deutsch | de | de.json |
| Español | es | es.json |
| Português | pt | pt.json |

---

## 6. 已知限制与未来规划

### 6.1 当前限制

1. **通道系统**: 数据模型和 API 已就绪，但实际消息桥接尚未实现
2. **部分技能为 Mock**: weather-query, document-processing, data-analysis, email-sender, database-query, reminder 目前返回模拟数据
3. **Workflow 执行引擎**: 前端可视化编辑器使用模拟执行，尚未与后端引擎完全集成
4. **协作 UI**: 后端协作协议已实现，但前端协作操作界面尚未独立实现
5. **TypeScript 错误**: 约 16 个预存在的 TypeScript 类型错误
6. **Prisma 同步**: Workflow 模型添加后需重新生成 Prisma Client

### 6.2 短期规划 (P2)

- [ ] Workflow 引擎与 API 执行路由集成
- [ ] 工作流模板系统
- [ ] Webhook / 定时触发器
- [ ] 实时工作流执行进度（Socket.IO 推送）
- [ ] Agent 协作 UI 界面
- [ ] Workflow Editor 增强（撤销/重做、复制粘贴、小地图）

### 6.3 中期规划

- [ ] 通道系统实际对接（Telegram / Discord / Slack）
- [ ] Mock 技能替换为真实 API 实现
- [ ] Workflow 并行节点真实并行执行
- [ ] Agent 记忆向量化搜索（嵌入 + 相似度匹配）
- [ ] 多租户支持
- [ ] Agent 模板市场
- [ ] 批量操作和 Agent 群组管理

### 6.4 长期规划

- [ ] 分布式 Agent 运行时
- [ ] Agent 学习和自适应优化
- [ ] 跨实例 Agent 发现和通信
- [ ] 可视化 Agent 编排（低代码/零代码）
- [ ] 企业级审计和合规
- [ ] 插件开发者生态和 SDK

---

## 7. 版本历史

| 版本 | 日期 | 描述 |
|------|------|------|
| 0.1.0 | 2025-05 | 初始版本，基础 Agent 管理、聊天、技能系统 |
| 0.2.0 | 2025-06 | P0 安全加固、QA 修复、P1 增强（加密、限流、分析）、P2 工作流引擎、协作协议、记忆系统 |

---

*本文档随项目迭代同步更新。如需修改，请确保反映项目实际状态。*
