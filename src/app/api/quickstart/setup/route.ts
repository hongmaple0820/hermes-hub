import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * Bilingual system prompt for the default Hermes Assistant agent.
 * Friendly Chinese + English prompt that makes the agent approachable
 * and guides new users.
 */
const DEFAULT_SYSTEM_PROMPT = `你是一个友好、智能的助手 —— Hermes Assistant 🤖
Hello! I'm Hermes Assistant, your friendly AI companion! 🤖

## 关于我 / About Me
我是 Hermes Hub 平台的内置助手，可以帮助你完成各种任务。
I'm the built-in assistant on the Hermes Hub platform, ready to help you with a variety of tasks.

## 我的能力 / My Capabilities
- 💬 自然语言对话 / Natural language conversation
- 🔍 网络搜索 / Web search — find the latest information for you
- 🌐 翻译 / Translation — translate between languages
- 💡 创意写作 / Creative writing — brainstorm and compose content
- 📊 数据分析 / Data analysis — help interpret and organize information

## 交互风格 / Interaction Style
- 用中文或英文回复，根据用户语言自动切换 / Reply in Chinese or English, auto-switching based on user language
- 回答简洁明了，必要时提供详细解释 / Keep answers clear and concise, with detailed explanations when needed
- 主动提供帮助建议 / Proactively offer helpful suggestions
- 遇到不确定的问题会诚实说明 / Be honest when uncertain

Let's get started! Feel free to ask me anything! 有什么问题尽管问我吧！`;

/**
 * Shared quickstart setup logic.
 * Creates a Z-AI built-in provider, a default agent, and installs basic skills.
 * Used by both the setup endpoint and the register route.
 */
export async function performQuickstartSetup(userId: string) {
  // 1. Create Z-AI built-in LLM Provider
  const provider = await db.lLMProvider.create({
    data: {
      userId,
      name: 'Z-AI (Built-in)',
      provider: 'z-ai',
      apiKey: 'z-ai-sdk',
      baseUrl: 'z-ai-sdk',
      defaultModel: 'default',
      isActive: true,
      models: '["default"]',
      config: '{}',
    },
  });

  // 2. Create default Agent using the Z-AI provider
  const agent = await db.agent.create({
    data: {
      userId,
      name: 'Hermes Assistant',
      description: 'Your default AI assistant powered by Z-AI',
      mode: 'builtin',
      providerId: provider.id,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      temperature: 0.7,
      maxTokens: 4096,
      isPublic: false,
      status: 'online',
    },
  });

  // 3. Install basic skills (web-search, translation) to the agent
  const basicSkillNames = ['web-search', 'translation'];
  const skills = await db.skill.findMany({
    where: { name: { in: basicSkillNames } },
    select: { id: true, name: true, displayName: true },
  });

  const agentSkills = [];
  for (let i = 0; i < skills.length; i++) {
    const skill = skills[i];
    const agentSkill = await db.agentSkill.create({
      data: {
        agentId: agent.id,
        skillId: skill.id,
        isEnabled: true,
        priority: i,
        config: '{}',
      },
    });
    agentSkills.push({
      id: agentSkill.id,
      skillId: skill.id,
      skillName: skill.name,
      displayName: skill.displayName,
    });
  }

  return { provider, agent, skills: agentSkills };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Check if user already has a provider and agent (idempotent check)
    const existingProvider = await db.lLMProvider.findFirst({
      where: { userId: user.id, provider: 'z-ai' },
    });
    const existingAgent = await db.agent.findFirst({
      where: { userId: user.id, name: 'Hermes Assistant' },
    });

    if (existingProvider && existingAgent) {
      // Already set up — return existing resources
      return NextResponse.json({
        provider: existingProvider,
        agent: existingAgent,
        skills: [],
        message: 'Quickstart already configured',
      });
    }

    // Perform the setup
    const result = await performQuickstartSetup(user.id);

    return NextResponse.json({
      ...result,
      message: 'Quickstart setup completed successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Quickstart setup error:', error);
    return NextResponse.json(
      { error: 'Quickstart setup failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
