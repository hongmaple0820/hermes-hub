import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { templateId, name, description } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'templateId is required' }, { status: 400 });
    }

    const template = await db.agentTemplate.findUnique({ where: { id: templateId } });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const skillIds: string[] = JSON.parse(template.skillIds || '[]');
    const config: Record<string, any> = JSON.parse(template.config || '{}');

    let agentToken: string | null = null;
    let connectGuide: any = null;

    if (template.agentType) {
      agentToken = `acrp_${crypto.randomUUID()}`;
      const wsDirectUrl = 'ws://localhost:3004/';
      connectGuide = {
        python: `import asyncio\nfrom hermes_agent import HermesAgent\n\nasync def main():\n    agent = HermesAgent(name="${name || template.displayName}", hub_url="${wsDirectUrl}", agent_token="${agentToken}")\n    await agent.connect()\n\nasyncio.run(main())`,
        javascript: `const { HermesAgent } = require('hermes-agent');\nconst agent = new HermesAgent({ name: '${name || template.displayName}', hubUrl: '${wsDirectUrl}', agentToken: '${agentToken}' });\nagent.connect();`,
        cli: `hermes-agent connect --hub-url "${wsDirectUrl}" --agent-token "${agentToken}"`,
      };
    }

    const agentData: any = {
      userId: user.id,
      name: name || template.displayName,
      description: description || template.description,
      systemPrompt: template.systemPrompt,
      mode: template.agentType ? 'acrp' : 'builtin',
      isPublic: false,
      status: 'offline',
      agentCategory: template.category,
      templateId: template.id,
      providerId: config.providerId || null,
      model: config.model || null,
      temperature: config.temperature ?? null,
      maxTokens: config.maxTokens ?? null,
    };

    if (template.agentType) {
      agentData.agentType = template.agentType;
      agentData.agentToken = agentToken;
      agentData.registeredAt = new Date();
    }

    const agent = await db.agent.create({
      data: agentData,
      include: {
        provider: { select: { id: true, name: true, provider: true, defaultModel: true } },
        skills: { include: { skill: true }, orderBy: { priority: 'asc' } },
      },
    });

    if (skillIds.length > 0) {
      const validSkills = await db.skill.findMany({ where: { id: { in: skillIds } } });
      if (validSkills.length > 0) {
        const skillBindings: any[] = validSkills.map((skill, index) => ({
            agentId: agent.id,
            skillId: skill.id,
            priority: index,
          }));
        for (const skill of validSkills) {
          try {
            await db.agentSkill.create({
              data: { agentId: agent.id, skillId: skill.id, isEnabled: true, priority: 0 } as any,
            });
          } catch { }
        }
      }
    }

    const refreshedAgent = await db.agent.findUnique({
      where: { id: agent.id },
      include: {
        provider: { select: { id: true, name: true, provider: true, defaultModel: true } },
        skills: { include: { skill: true }, orderBy: { priority: 'asc' } },
      },
    });

    return NextResponse.json({ agent: refreshedAgent, agentToken, connectGuide });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create from template error:', error);
    return NextResponse.json({ error: 'Failed to create from template' }, { status: 500 });
  }
}