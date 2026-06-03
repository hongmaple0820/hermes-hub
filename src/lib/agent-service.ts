import { db } from '@/lib/db';
import crypto from 'crypto';

export class AgentService {
  async createAgent(params: {
    type: 'builtin' | 'external' | 'template';
    userId: string;
    name: string;
    description?: string;
    providerId?: string;
    model?: string;
    systemPrompt?: string;
    agentType?: string;
    templateId?: string;
  }) {
    const agentData: Record<string, any> = {
      userId: params.userId,
      name: params.name,
      description: params.description || null,
      isPublic: false,
      status: 'offline',
    };

    if (params.type === 'builtin') {
      agentData.mode = 'builtin';
      agentData.agentCategory = 'assistant';
      agentData.systemPrompt = params.systemPrompt || null;
      agentData.providerId = params.providerId || null;
      agentData.model = params.model || null;
    } else if (params.type === 'external') {
      agentData.mode = 'acrp';
      agentData.agentCategory = 'worker';
      agentData.agentType = params.agentType || 'custom';
      agentData.agentToken = `acrp_${crypto.randomUUID()}`;
      agentData.registeredAt = new Date();
    }

    const agent = await db.agent.create({
      data: agentData as any,
      include: {
        provider: { select: { id: true, name: true, provider: true, defaultModel: true } },
        skills: { include: { skill: true }, orderBy: { priority: 'asc' } },
      },
    });

    if (params.type === 'external') {
      const wsDirectUrl = 'ws://localhost:3004/';
      const connectGuide = this.generateConnectGuide(agent.agentToken!, wsDirectUrl, params.agentType || 'custom');
      return { agent, agentToken: agent.agentToken!, connectGuide };
    }

    return { agent };
  }

  async setupExternalAgent(agentId: string) {
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new Error('Agent not found');

    let agentToken = agent.agentToken;
    if (!agentToken) {
      agentToken = `acrp_${crypto.randomUUID()}`;
      await db.agent.update({
        where: { id: agentId },
        data: { agentToken, registeredAt: new Date() },
      });
    }

    const wsDirectUrl = 'ws://localhost:3004/';
    const connectGuide = this.generateConnectGuide(agentToken, wsDirectUrl, agent.agentType || 'custom');

    return { agentToken, connectGuide };
  }

  async convertCapabilityToSkill(agentId: string, capability: { capabilityId: string; name: string; description: string; category: string; parameters: string }) {
    const skillName = capability.capabilityId.replace(/[^a-z0-9-]/g, '-').toLowerCase();

    let existingSkill = await db.skill.findFirst({
      where: { sourceCapabilityId: capability.capabilityId, sourceAgentId: agentId },
    });

    if (!existingSkill) {
      existingSkill = await db.skill.create({
        data: {
          name: skillName,
          displayName: capability.name,
          description: capability.description,
          category: capability.category,
          handlerType: 'acrp',
          configSchema: capability.parameters || '{}',
          sourceType: 'acrp-auto',
          sourceCapabilityId: capability.capabilityId,
          sourceAgentId: agentId,
          isEnabled: true,
        },
      });
    }

    const existingBinding = await db.agentSkill.findUnique({
      where: { agentId_skillId: { agentId, skillId: existingSkill.id } },
    });

    if (!existingBinding) {
      await db.agentSkill.create({
        data: {
          agentId,
          skillId: existingSkill.id,
          isEnabled: true,
          priority: 50,
        } as any,
      });
    }

    return existingSkill;
  }

  async autoInstallSkills(agentId: string, skillIds: string[]) {
    const results: any[] = [];
    for (const skillId of skillIds) {
      const skill = await db.skill.findUnique({ where: { id: skillId } });
      if (!skill) continue;

      const existing = await db.agentSkill.findUnique({
        where: { agentId_skillId: { agentId, skillId } },
      });
      if (existing) {
        results.push(existing as any);
        continue;
      }

      const binding = await db.agentSkill.create({
        data: { agentId, skillId, isEnabled: true, priority: 0 } as any,
      });
      results.push(binding as any);
    }
    return results;
  }

  async getAgentUnifiedDetail(agentId: string) {
    const agent = await db.agent.findUnique({
      where: { id: agentId },
      include: {
        provider: true,
        skills: { include: { skill: true }, orderBy: { priority: 'asc' } },
        connections: true,
        plugins: true,
        capabilities: true,
        template: true,
      },
    });

    if (!agent) return null;

    const connectionStatus = agent.mode === 'acrp'
      ? { type: 'websocket', connected: agent.wsConnected, lastActivity: agent.lastHeartbeatAt?.toISOString() }
      : { type: 'llm', connected: agent.provider?.isActive ?? false };

    return { agent, connectionStatus };
  }

  private generateConnectGuide(agentToken: string, wsDirectUrl: string, agentType: string): { python: string; javascript: string; cli: string } {
    return {
      python: `import asyncio\nfrom hermes_agent import HermesAgent\n\nasync def main():\n    agent = HermesAgent(name="my-agent", hub_url="${wsDirectUrl}", agent_token="${agentToken}")\n    await agent.connect()\n\nasyncio.run(main())`,
      javascript: `const { HermesAgent } = require('hermes-agent');\nconst agent = new HermesAgent({ name: 'my-agent', hubUrl: '${wsDirectUrl}', agentToken: '${agentToken}' });\nagent.connect();`,
      cli: `hermes-agent connect --hub-url "${wsDirectUrl}" --agent-token "${agentToken}"`,
    };
  }
}

export const agentService = new AgentService();

export async function invokeCapability(agentId: string, capabilityId: string, params?: any) {
  const wsUrl = process.env.SKILL_WS_INTERNAL_URL || 'http://localhost:3004';

  const response = await fetch(`${wsUrl}/internal/acrp-invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, capabilityId, params }),
  });

  if (!response.ok) {
    throw new Error(`ACRP invoke failed: ${response.status}`);
  }

  return response.json();
}

export async function onCapabilityRegistered(agentId: string, capabilities: Array<{ capabilityId: string; name: string; description: string; category: string; parameters: string }>) {
  for (const cap of capabilities) {
    try {
      await agentService.convertCapabilityToSkill(agentId, cap);
    } catch (error) {
      console.error(`Failed to convert capability ${cap.capabilityId}:`, error);
    }
  }
}