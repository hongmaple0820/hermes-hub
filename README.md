# Hermes Hub 项目说明文档

> 📦 **项目名称**: hermes-hub  
> 🔗 **仓库地址**: [https://github.com/hongmaple0820/hermes-hub](https://github.com/hermes-hub)  
> 📝 **最后更新**: 2026年4月

---

## 📋 目录

1. [项目简介](#-项目简介)
2. [核心特性](#-核心特性)
3. [技术架构](#-技术架构)
4. [环境要求](#-环境要求)
5. [安装与部署](#-安装与部署)
6. [配置说明](#-配置说明)
7. [使用指南](#-使用指南)
8. [协议说明](#-协议说明)
9. [开发指南](#-开发指南)
10. [常见问题](#-常见问题)

---

## 🔍 项目简介

**Hermes Hub** 是一个功能丰富的多智能体协作平台，旨在连接、管理和调度各类 AI 智能体（Agent）与技能（Skill）。平台支持通过 WebSocket 和 HTTP 两种方式与外部智能体通信，并提供完整的技能插件协议、远程能力调用和对话管理功能。

### 核心定位
- 🤖 **智能体管理中心**: 统一管理 Builtin 和 ACRP 模式的智能体
- 🔌 **技能插件系统**: 支持技能安装、配置、调用和生命周期管理
- 🌐 **多协议通信**: WebSocket 优先，支持 HTTP 回退的混合通信架构
- 🌍 **国际化支持**: 内置 8 种语言（中/英/日/韩/德/西/法/葡）

---

## ✨ 核心特性

### 🔹 智能体管理 (Agent Management)
| 模式 | 说明 | 适用场景 |
|------|------|----------|
| **Builtin** | Hub 内置 LLM 驱动的智能体，直接调用 OpenAI/Anthropic/Google 等提供商 | 快速原型、简单任务 |
| **ACRP** | 通过 Agent Capability Registration Protocol 连接的远程智能体 | 本地部署、自定义智能体、Claude Code、Trae 等 |

### 🔹 技能插件系统 (Skill Plugin System)
```
┌─────────────────────────────────┐
│  Skill Marketplace (技能市场)    │
├─────────────────────────────────┤
│ ✅ 技能浏览与搜索                 │
│ ✅ 一键安装到指定智能体           │
│ ✅ 技能配置与优先级管理           │
│ ✅ WebSocket/HTTP 双模式连接      │
│ ✅ 实时连接状态监控               │
└─────────────────────────────────┘
```

### 🔹 ACRP 协议 (Agent Capability Registration Protocol)
- 🔐 **Token 认证**: 基于 `agentToken` 的安全连接认证
- 🔄 **双向通信**: 支持 `capability:invoke` 和 `capability:result` 事件
- ❤️ **心跳监测**: 自动检测智能体在线状态（30秒间隔）
- 📊 **能力注册**: 智能体可动态注册可执行能力（如 `model.switch`, `skill.install`）

### 🔹 对话与上下文管理
- 🧠 **上下文压缩引擎**: CJK 感知的 token 估算，支持增量/全量压缩
- 🔗 **对话血缘追踪**: 支持多会话链接，记录完整的对话历史链
- 💬 **实时聊天**: 支持流式响应、打字指示器、消息状态显示

### 🔹 用户体验增强
- 🎨 **主题系统**: 支持 Light / Dark / System 主题切换 + 强调色自定义
- 🌐 **多语言**: 8 种语言完整国际化支持
- ⌨️ **键盘快捷键**: 全局快捷键支持，提升操作效率
- 📱 **响应式设计**: 适配桌面端和移动端

### 🔹 Agent Portal 简化流程 (v2.0+)

**概念统一**
- Skill / Plugin / Connection 统一为 **Skill** 概念
- 用户只需关注 Agent + Skill，无需理解底层技术细节

**操作简化**
- **Agent Portal**: 三卡片快速创建 (内置助手 / 外部接入 / 职业模板)
- **Agent Detail**: 5 Tab 简化为 3 Tab (配置 / 对话 / 历史)
- **Skill 装配**: 一键添加，自动处理 endpoint/callback 配置

**业务闭环**
- 创建 Agent → 自动装配 Skills → 在详情页内直接对话 → 查看历史记录
- 外部 Agent 接入 → 自动生成 Token → 复制代码 → 连接 → Capability 自动转 Skill → 可对话

**预置模板**
6 个职业模板开箱即用，自动预装配相关 Skills：
| 模板 | 预装 Skills |
|------|-------------|
| 研发助手 | web-search, code-execution, pdf |
| 运营助手 | web-search, charts, ppt, xlsx |
| 内容创作 | web-search, blog-writer, seo-content-writer |
| 金融分析 | web-search, stock-analysis-skill, finance |
| 项目管理 | web-search, auto-target-tracker |
| Hermes Agent | (ACRP 自动注册) |

## 🏗️ 技术架构

### 微服务架构
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Next.js App   │     │   chat-service  │     │    skill-ws     │
│   (Port 3000)   │◄───►│   (Port 3003)   │◄───►│   (Port 3004)   │
│                 │     │                 │     │                 │
│ • 前端 UI       │     │ • LLM 流式调用  │     │ • Socket.IO 服务器│
│ • REST API      │     │ • 技能调度      │     │ • ACRP 协议处理 │
│ • Prisma ORM    │     │ • 上下文管理    │     │ • 双认证中间件  │
│ • 数据库管理    │     │ • OAuth 集成    │     │ • 内部 HTTP API │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

### 技术栈
| 分类 | 技术选型 |
|------|----------|
| **前端框架** | Next.js 16 + React + TypeScript |
| **UI 组件** | shadcn/ui + Tailwind CSS |
| **状态管理** | Zustand |
| **后端服务** | Node.js + Bun 运行时 |
| **数据库** | PostgreSQL + Prisma ORM |
| **实时通信** | Socket.IO (WebSocket) |
| **认证授权** | JWT + OAuth 2.0 Device Code |
| **国际化** | next-intl (8 语言支持) |
| **主题管理** | next-themes |

### 项目结构
```
hermes-hub/
├── src/                    # Next.js 主应用
│   ├── app/               # App Router 页面和 API 路由
│   ├── components/        # React 组件
│   ├── lib/              # 工具库 (db, auth, protocol 等)
│   └── store/            # 全局状态管理
├── mini-services/         # 微服务模块
│   ├── chat-service/     # 聊天服务 (Port 3003)
│   └── skill-ws/         # WebSocket 服务 (Port 3004)
├── prisma/               # 数据库 Schema 和迁移
├── skills/               # 内置技能定义
├── agent-ctx/            # 智能体上下文管理
├── examples/             # 使用示例和客户端代码
└── .zscripts/            # 自动化部署脚本
```

---

## ⚙️ 环境要求

### 系统要求
- ✅ Node.js 18+ 或 Bun 1.0+
- ✅ PostgreSQL 14+
- ✅ Git

### 推荐配置
```bash
# 开发环境
内存: ≥ 4GB
磁盘: ≥ 2GB 可用空间
网络: 本地开发无需外网，生产环境需开放 3000/3003/3004 端口
```

---

## 🚀 安装与部署

### 1. 克隆项目
```bash
git clone https://github.com/hongmaple0820/hermes-hub.git
cd hermes-hub
```

### 2. 安装依赖
```bash
# 使用 Bun (推荐)
bun install

# 或使用 npm
npm install
```

### 3. 配置环境变量
```bash
# 复制示例配置
cp .env.example .env

# 编辑 .env 文件，配置以下内容:
DATABASE_URL="postgresql://user:pass@localhost:5432/hermes_hub"
NEXTAUTH_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# LLM 提供商配置 (按需启用)
OPENAI_API_KEY="sk-..."
ANTHROPIC_API_KEY="sk-ant-..."
GOOGLE_AI_API_KEY="..."

# 服务端口配置
CHAT_SERVICE_PORT=3003
SKILL_WS_PORT=3004
```

### 4. 初始化数据库
```bash
# 应用 Prisma Schema
bun run db:push

# 或生成迁移文件 (生产环境推荐)
bun run db:migrate
```

### 5. 启动服务

#### 开发模式 (热重载)
```bash
# 启动所有服务 (推荐)
bun run dev:all

# 或分别启动:
# 1. Next.js 主应用
bun run dev

# 2. 聊天服务 (新终端)
cd mini-services/chat-service && bun run dev

# 3. WebSocket 服务 (新终端)
cd mini-services/skill-ws && bun run dev
```

#### 生产模式
```bash
# 构建应用
bun run build

# 启动服务
bun run start:all
```

### 6. 使用 Caddy 反向代理 (可选)
项目包含 `Caddyfile` 配置，可一键启用 HTTPS 和 WebSocket 代理：
```bash
caddy start --config Caddyfile
```

---

## ⚙️ 配置说明

### 核心配置项

#### `.env` 主要参数
| 变量名 | 说明 | 示例值 |
|--------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://...` |
| `NEXTAUTH_SECRET` | NextAuth.js 加密密钥 | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | 应用基础 URL | `http://localhost:3000` |
| `OPENAI_API_KEY` | OpenAI API 密钥 | `sk-...` |
| `CHAT_SERVICE_URL` | 聊天服务地址 | `http://localhost:3003` |
| `SKILL_WS_URL` | WebSocket 服务地址 | `http://localhost:3004` |
| `ALLOWED_DEV_ORIGINS` | 开发环境允许的 CORS 源 | `http://localhost:3000` |

#### 智能体连接配置 (ACRP)
当创建 ACRP 模式智能体时，系统会生成:
```json
{
  "agentToken": "acrp_xxx",
  "wsConnectUrl": "wss://your-domain.com/?XTransformPort=3004",
  "wsDirectUrl": "ws://localhost:3004/",
  "connectionMode": "websocket"
}
```

外部智能体使用 `agentToken` 通过 Socket.IO 连接:
```javascript
// JavaScript 示例 (socket.io-client)
import { io } from "socket.io-client";

const socket = io("ws://localhost:3004", {
  auth: { agentToken: "acrp_xxx" }
});

// 注册能力
socket.emit("agent:register", {
  name: "my-agent",
  version: "1.0.0",
  platform: "custom",
  capabilities: [
    {
      capabilityId: "model.switch",
      name: "切换模型",
      parameters: { type: "object", properties: { model: { type: "string" } } }
    }
  ]
});

// 监听能力调用
socket.on("capability:invoke", async (data) => {
  const result = await executeCapability(data.capabilityId, data.params);
  socket.emit("capability:result", {
    invocationId: data.invocationId,
    result: result
  });
});
```

---

## 📖 使用指南

### 1. 用户注册与登录
1. 访问 `http://localhost:3000`
2. 点击 "注册" 填写用户名、邮箱、密码
3. 登录后可进入主界面

### 2. 创建智能体 (简化流程)

Hermes Hub 提供三种快速创建 Agent 的方式：

#### 方式一：内置助手 (Builtin)
适合快速创建基于云端 LLM 的 AI 助手。

```
侧边栏 → Agents → 创建内置助手
```
- 填写名称和描述
- 选择 LLM 提供商 (OpenAI / Anthropic / Google)
- 配置 System Prompt (可选预设模板)
- 一键创建，立即可用

#### 方式二：外部 Agent (ACRP)
适合接入 Claude Code、Trae、OpenClaw 等本地 AI 工具。

```
侧边栏 → Agents → 外部接入
```
- 选择 Agent 类型 (Hermes Agent / Claude Code / Trae / OpenClaw / 自定义)
- 系统自动生成 Agent Token
- 复制接入代码 (Python / JavaScript / CLI)
- 在本地环境中运行代码完成连接
- 外部 Agent 的能力自动转换为 Skills

#### 方式三：职业模板
适合基于预置模板快速创建专业 Agent。

```
侧边栏 → Agents → 从模板创建
```
- 选择职业模板 (研发助手 / 运营助手 / 内容创作 / 金融分析 / 项目管理)
- 系统自动预装配相关 Skills
- 可预览模板配置和预装技能
- 一键创建，开箱即用

### 3. 管理智能体

```
侧边栏 → Agents → 点击 Agent 卡片
```

Agent 详情页提供三大功能 Tab：

**配置 Tab**
- 编辑基本信息 (名称、描述、System Prompt)
- 查看/管理已装配 Skills (一键添加/移除)
- 外部 Agent 的接入信息 (Token、代码、Capability 管理)

**对话 Tab**
- 在 Agent 详情页内直接对话
- 支持内置助手 (LLM) 和外部 Agent (WebSocket) 两种模式
- 实时显示 Skill 调用过程

**历史 Tab**
- 查看对话历史记录
- 查看 Skill 调用记录
- 查看 Capability 调用记录 (外部 Agent)

### 4. 安装技能

```
侧边栏 → Skill Marketplace → 浏览技能 → Install
```
- 支持按类别/处理器类型筛选
- 也可在 Agent 详情页直接装配 Skills (双入口)
- 装配后自动处理端点和回调配置

### 5. 开始对话

```
侧边栏 → Chat → 选择智能体 → 输入消息
```
- 支持多会话管理
- 消息支持 Markdown 渲染
- 长按消息可复制/删除

---

## 🔐 协议说明

### Skill Plugin Protocol v2.0
```
┌─────────────────────────────────────┐
│ 双向通信事件定义                      │
├─────────────────────────────────────┤
│ Agent → Hub                          │
│ • skill:register    - 注册技能能力    │
│ • skill:heartbeat   - 心跳保活        │
│ • skill:event       - 发送事件消息    │
│ • capability:result - 返回调用结果    │
│                                      │
│ Hub → Agent                          │
│ • skill:invoke      - 调用技能        │
│ • skill:notification - 发送通知      │
│ • capability:invoke - 调用注册能力   │
│ • agent:command     - 发送控制命令   │
└─────────────────────────────────────┘
```

### ACRP 认证流程
```
1. Hub 生成 agentToken → 用户复制
2. 外部智能体使用 token 连接 WebSocket
3. skill-ws 验证 token → 返回连接确认
4. 智能体发送 agent:register 注册能力
5. Hub 保存能力信息，建立双向通道
6. 定时心跳维持连接状态
```

### 安全机制
- 🔑 **Token 认证**: 所有 WebSocket 连接必须携带有效 token
- 🔄 **签名验证**: HTTP 回调使用 HMAC-SHA256 签名
- ⏱️ **超时控制**: 能力调用默认 60 秒超时
- 🚫 **权限隔离**: 用户只能管理自己的智能体和技能

---

## 💻 开发指南

### 项目脚本
```bash
# 开发
bun run dev              # 启动 Next.js
bun run dev:all          # 启动所有服务

# 构建
bun run build           # 生产构建
bun run start           # 启动生产服务

# 数据库
bun run db:push         # 同步 Schema (开发)
bun run db:migrate      # 生成迁移 (生产)
bun run db:studio       # 打开 Prisma Studio

# 代码质量
bun run lint            # ESLint 检查
bun run lint:fix        # 自动修复

# 测试
bun run test            # 运行测试套件
```

### 添加新技能
1. 在 `skills/` 目录创建技能定义文件
2. 实现 `handler` 函数处理调用逻辑
3. 在 `src/lib/skill-protocol.ts` 注册技能元数据
4. 更新 i18n 文件添加多语言描述

### 添加新语言
1. 复制 `src/locales/en.json` 为 `xx.json`
2. 翻译所有 key 的值
3. 在 `src/lib/i18n.ts` 添加语言配置
4. 更新 `package.json` 的 `locales` 数组

### API 开发规范
```typescript
// 示例: 新建 API 路由 src/app/api/example/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    
    const body = await req.json();
    // 业务逻辑...
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
```

---

## ❓ 常见问题

### Q: 启动后访问 3000 端口无响应？
```bash
# 检查服务状态
ps aux | grep node
ps aux | grep bun

# 查看日志
tail -f logs/nextjs.log

# 检查端口占用
lsof -i :3000
```

### Q: 数据库连接失败？
```bash
# 验证 PostgreSQL 是否运行
sudo systemctl status postgresql

# 测试连接
psql $DATABASE_URL -c "SELECT 1;"

# 确保用户有创建数据库权限
```

### Q: WebSocket 连接被拒绝？
- 检查 `SKILL_WS_URL` 配置是否正确
- 确认防火墙开放 3004 端口
- 使用 Caddy 代理时检查 `Caddyfile` 的 WebSocket 配置

### Q: 如何调试 ACRP 连接问题？
1. 打开浏览器开发者工具 → Network → WS
2. 查看 `skill-ws` 服务日志: `tail -f mini-services/skill-ws/logs/*.log`
3. 使用 `GET /api/acrp/agents` 检查智能体注册状态

### Q: Agent Portal 和旧版 Agent Manager 的区别？
**Agent Portal (新版)**:
- 三卡片快速创建 (内置助手 / 外部接入 / 模板)
- Agent Detail 简化为 3 Tab
- Skill/Plugin/Connection 统一为 Skill 概念
- 外部 Agent 的 ACRP 管理合并到 Agent Detail

**Agent Manager (旧版)**:
- 已保留但默认不再显示
- 可通过 URL `/agents/legacy` 访问 (如需要)

### Q: 如何从旧版迁移数据？
简化流程完全向后兼容，旧数据自动适配：
- 旧 Builtin Agent → 在新 Agent Portal 正常显示
- 旧 ACRP Agent → 在新 Agent Detail 的"配置" Tab 管理
- 旧 Plugin/Connection → 自动显示为 Skill (handlerType=protocol)

### Q: Capability 如何自动转换为 Skill？
当外部 Agent 通过 ACRP 注册 capability 时：
1. 系统自动创建对应的 Skill (handlerType=acrp)
2. 自动装配到该 Agent
3. 在 Agent Detail 的"配置" Tab 中显示

无需手动操作，Capability 变更实时同步为 Skill。

### Q: 生产环境如何部署？
```bash
# 1. 构建应用
bun run build

# 2. 使用 PM2 管理进程 (推荐)
pm2 start ecosystem.config.cjs

# 3. 配置 Nginx/Caddy 反向代理
# 4. 启用 HTTPS 证书
# 5. 设置环境变量 (不要使用 .env 文件)
```

---

## 🤝 贡献指南

1. 🔀 Fork 本仓库
2. 🌿 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 💾 提交更改 (`git commit -m 'feat: add AmazingFeature'`)
4. 📤 推送到分支 (`git push origin feature/AmazingFeature`)
5. 🔄 创建 Pull Request

### 代码规范
- 使用 TypeScript 严格模式
- 遵循 ESLint + Prettier 配置
- 组件使用函数式 + Hooks
- API 路由统一错误处理

### 提交信息规范
```
feat:     新功能
fix:      修复问题
docs:     文档更新
style:    代码格式 (不影响逻辑)
refactor: 重构 (非新功能/修复)
test:     测试相关
chore:    构建/工具/配置
```

---

## 📄 许可证

本项目采用 **MIT License**，详见 [LICENSE](LICENSE) 文件。

---

> ⚠️ **注意事项**
> - 生产环境请务必修改默认密钥和配置
> - 建议启用 HTTPS 和 WSS 保障通信安全
> - 定期备份数据库和配置文件
> - 关注 GitHub Issues 获取最新问题和修复

---

## 📋 版本更新日志

### v2.0 - Agent Portal 简化流程 (2026-06-03)

**重大更新**
- 全新 Agent Portal 界面，三卡片快速创建 Agent
- Agent Detail 重构为 3 Tab (配置 / 对话 / 历史)
- Skill/Plugin/Connection 统一为 Skill 概念
- 外部 Agent 的 ACRP 管理合并到 Agent Detail
- 新增 6 个职业模板，自动预装配 Skills
- Capability 自动转换为 Skill，无需手动操作

**API 新增**
- `/api/agents/create-builtin` - 创建内置助手
- `/api/agents/create-external` - 创建外部 Agent
- `/api/agents/create-from-template` - 从模板创建
- `/api/agents/[id]/unified-detail` - 统一详情
- `/api/agents/[id]/attach-skill` - 统一装配 Skill
- `/api/agents/[id]/chat` - Agent 内对话
- `/api/agent-templates` - 模板列表

**向后兼容**
- 所有旧 API 保持正常工作
- 旧数据自动适配新 UI
- Agent Manager 保留，可通过 `/agents/legacy` 访问

---

*文档最后更新: 2026-06-03 | 项目版本: v2.0*  
*如有问题，请在 GitHub 仓库提交 Issue 或 Discussion* 🚀
