# Hermes Hub PRD 补充文档

> 补充关键缺失内容：异常处理、LLM Provider配置、ChatRoom、Agent删除等
> 日期: 2026-06-03

---

## 补充 1: 异常处理状态机设计 (P0)

### 1.1 错误分类体系

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

### 1.2 外部 Agent 断线处理

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

### 1.3 LLM 接口错误处理

| HTTP状态 | 错误码 | 自动重试 | 用户提示 | 降级策略 |
|---------|--------|---------|---------|---------|
| 429 | RATE_LIMIT | 3次 | "请求繁忙" | 延迟执行 |
| 504 | TIMEOUT | 1次 | "响应较慢" | 缩短输出 |
| 401 | INVALID_KEY | 否 | "API Key无效" | 无 |
| 403 | QUOTA_EXCEEDED | 否 | "用量已用完" | 提示升级 |
| 500 | SERVER_ERROR | 1次 | "服务暂时不可用" | 切换备用Provider |
| 404 | MODEL_NOT_FOUND | 否 | "模型不可用" | 自动降级 |

### 1.4 Skill 调用失败处理

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

## 补充 2: LLM Provider 配置流程 (P0)

### 2.1 Provider 管理入口

**位置**: Settings → LLM Providers

### 2.2 配置流程

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

### 2.3 配置校验规则
- API Key 格式校验
- 至少选择一个可用模型
- 必须设置默认模型
- 测试连接成功后才能保存

---

## 补充 3: ChatRoom 功能设计 (P1)

### 3.1 功能概述

支持多 Agent 群聊，用户和多个 Agent 在同一对话中协作。

### 3.2 创建流程

1. 侧边栏 → Chat Rooms → [创建聊天室]
2. 填写名称、描述、选择参与 Agent
3. 开始群聊

### 3.3 数据模型

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

## 补充 4: Agent 删除流程 (P1)

### 4.1 删除入口

Agent Detail → [删除] 按钮 (红色危险操作)

### 4.2 确认对话框

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

### 4.3 级联删除规则

**必须删除**:
- Agent 记录
- AgentSkill 关联
- AgentConnection 记录

**可选保留**:
- Conversation 记录
- Message 记录

### 4.4 删除后跳转

跳转回 Agent Portal，显示 Toast: "Agent 已删除"

---

## 补充 5: 上下文压缩策略 (P1)

### 5.1 触发条件

Token 数超过阈值时触发:
- 内置助手: 4000 tokens
- 外部 Agent: 8000 tokens

### 5.2 压缩策略

**策略 1: 截断 (默认)**
- 保留最近 N 条消息
- 丢弃早期消息

**策略 2: 摘要**
- 生成早期消息摘要
- 保留摘要 + 最近消息

### 5.3 用户感知

```
💡 上下文已压缩
   当前对话较长，已自动压缩早期内容。
   [查看详情] [不再提示]
```

---

## 补充 6: 交互逻辑修正

### 修正 1: 步骤数矛盾

**原问题**: 流程 B 标注"总步骤 4 步"，正文列了 10 步

**修正**: 标注为"核心步骤 3 步"

### 修正 2: 新建 Agent 跳转 Tab

**原问题**: 创建后直接跳转到对话 Tab

**修正**: 统一跳转到配置 Tab

### 修正 3: Skill 弹窗关闭逻辑

**原问题**: 添加后立即关闭弹窗

**修正**: 保持弹窗打开，已添加 Skill 显示禁用状态

### 修正 4: 历史 Tab 粒度

**原问题**: 对话历史与 Skill 调用统计混放

**修正**: 
- 历史 Tab: 仅对话会话列表
- 配置 Tab: Skill 条目下显示调用统计

---

## 补充 7: 团队协作数据模型 (P1)

### 7.1 Team 模型

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

### 7.2 Agent 可见性

- **private**: 仅创建者可见
- **team**: 团队成员可见
- **public**: 所有人可见

---

## 补充 8: 账单与用量限额 (P1)

### 8.1 用量统计

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

### 8.2 限额机制

**限额层级**:
- 用户级: 总用量限额
- Agent 级: 单个 Agent 限额
- 月度限额: 每月重置

**超额处理**:
1. 达到 80%: 邮件警告
2. 达到 100%: 提示升级，允许超额 10%
3. 超过 110%: 暂停服务

---

## 补充 9: Skill Protocol 连接流程

### 9.1 WebSocket 连接时序

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

### 9.2 错误处理

- 认证失败: 关闭连接，提示重新配置
- 心跳超时: 标记离线，尝试重连
- 消息格式错误: 返回错误，不关闭连接

---

## 补充 10: 注册登录流程

### 10.1 注册流程

1. 填写邮箱、用户名、密码
2. 邮箱验证 (发送验证码)
3. 验证成功后进入 Dashboard

### 10.2 OAuth 登录

支持的 Provider:
- GitHub
- Google
- 企业 SSO

### 10.3 安全机制

- 密码强度要求: 8位以上，包含大小写+数字
- 登录失败锁定: 5次失败锁定15分钟
- Session 过期: 7天

---

**文档结束**
