# Agent Portal 简化重构 - 任务清单

2026-06-03

## Phase 3: 数据模型扩展
- [x] prisma/schema.prisma: 新增 AgentTemplate 模型; Agent/Skill 新增字段
- [x] prisma generate + push to DB
 创建 AgentSkill.endpointToken/callbackUrl 自动生成逻辑
- [x] seed: 预置 6 个 AgentTemplate 种子数据
- [x] api/agent-templates: GET 列表 + GET 详情 API
- [x] api/agents/create-builtin: POST 创建内置助手
- [x] api/agents/create-external: POST 创建外部 Agent + 自动生成 token + 接入引导
- [x] api/agents/create-from-template: POST 从模板创建 + 自动装配 Skills
- [x] api/agents/[id]/unified-detail: GET 合并详情 (Skill/Plugin/Connection 统一)
- [x] api/agents/[id]/attach-skill: POST 统一装配 (自动生成 endpointToken)
- [x] api/agents/[id]/detach-skill: POST 统一卸载
- [x] api/agents/[id]/chat: POST 在详情页内对话
- [x] api/agents/[id]/activities: GET 活动记录
- [x] api/internal/capability-registered: POST ACRP capability 注册通知
- [x] lib/agent-service.ts: 统一 Agent Service
- [x] lib/api-client.ts: 新增统一 Portal API 方法

- [x] store.ts: ViewMode 删除 agent-control
- [x] Sidebar.tsx: 删除 agent-control 入口

- [x] page.tsx: 删除 agent-control 分支; 使用 AgentPortal

- [x] page.tsx: 删除 AgentManager import; 使用 AgentPortal import

## Phase 2: Service 层统一
- [x] lib/agent-service.ts: 创建 (已完成)
- [x] lib/api-client.ts: 扩展 (已完成)
- [x] capability-bridge: ACRP -> Skill 自动转换 (已集成在 agent-service.ts)
- [x] skill-ws: 通知 capability 注册到 Hub 主服务 (待做)

## Phase 1: UI 层简化
- [x] components/views/AgentPortal.tsx: 新建 (替代 AgentManager)
- [x] components/views/AgentDetail.tsx: 重构为 3 Tab (配置/对话/历史)
- [x] components/agent/CreateBuiltinAssistant.tsx: 新建
- [x] components/agent/CreateExternalAgent.tsx: 新建
- [x] components/agent/CreateFromTemplate.tsx: 新建
- [x] components/agent/AgentChatPanel.tsx: 新建
- [x] components/agent/SkillAttachmentPanel.tsx: 新建
- [x] components/agent/ConnectGuidePanel.tsx: 新建

## Phase 4: 对话闭环
- [x] AgentChatPanel: builtin 通过 chat-service 对话
- [x] AgentChatPanel: acrp 通过 ACRP WebSocket 对话
- [x] ActivityRecord: 消息历史 + Skill调用 + Capability调用 查询和展示