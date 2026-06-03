import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agentService } from '@/lib/agent-service';

const VALID_AGENT_TYPES = ['hermes-agent', 'openclaw', 'claude-code', 'codex', 'trae', 'custom'];

function generateConnectGuide(agentToken: string, wsConnectUrl: string, wsDirectUrl: string, agentType: string) {
  const python = `import asyncio
from hermes_agent import HermesAgent

async def main():
    agent = HermesAgent(
        name="my-agent",
        hub_url="${wsDirectUrl}",
        agent_token="${agentToken}"
    )
    await agent.connect()

asyncio.run(main())`;

  const javascript = `const { HermesAgent } = require('hermes-agent');

const agent = new HermesAgent({
  name: 'my-agent',
  hubUrl: '${wsDirectUrl}',
  agentToken: '${agentToken}',
});

agent.connect();`;

  const cli = `hermes-agent connect --hub-url "${wsDirectUrl}" --agent-token "${agentToken}"`;

  return { python, javascript, cli };
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { name, description, agentType } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!agentType || !VALID_AGENT_TYPES.includes(agentType)) {
      return NextResponse.json({ error: 'Invalid agentType', details: `Must be one of: ${VALID_AGENT_TYPES.join(', ')}` }, { status: 400 });
    }

    const agentToken = `acrp_${crypto.randomUUID()}`;
    const wsConnectUrl = '/?XTransformPort=3004';
    const wsDirectUrl = 'ws://localhost:3004/';

    const agent = await db.agent.create({
      data: {
        userId: user.id,
        name,
        description: description || null,
        mode: 'acrp',
        isPublic: false,
        status: 'offline',
        agentCategory: 'worker',
        agentType,
        agentToken,
        registeredAt: new Date(),
        wsConnected: false,
      },
      include: {
        skills: { include: { skill: true }, orderBy: { priority: 'asc' } },
        capabilities: true,
      },
    });

    const connectGuide = generateConnectGuide(agentToken, wsConnectUrl, wsDirectUrl, agentType);

    return NextResponse.json({ agent, agentToken, connectGuide });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create external agent error:', error);
    return NextResponse.json({ error: 'Failed to create external agent' }, { status: 500 });
  }
}