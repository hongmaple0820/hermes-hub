import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateEndpointToken, generateCallbackSecret } from '@/lib/skill-protocol';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { skillId, config } = body;

    if (!skillId) {
      return NextResponse.json({ error: 'skillId is required' }, { status: 400 });
    }

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const skill = await db.skill.findUnique({ where: { id: skillId } });
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const existing = await db.agentSkill.findUnique({ where: { agentId_skillId: { agentId: id, skillId } } });
    if (existing) {
      return NextResponse.json({ error: 'Skill already attached', agentSkill: existing }, { status: 409 });
    }

    const endpointToken = (skill.handlerType === 'webhook' || skill.handlerType === 'protocol')
      ? generateEndpointToken()
      : null;
    const callbackSecret = endpointToken ? generateCallbackSecret() : null;
    const callbackUrl = endpointToken ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/skill-protocol/events` : null;

    const agentSkill = await db.agentSkill.create({
      data: {
        agentId: id,
        skillId,
        config: config ? JSON.stringify(config) : '{}',
        isEnabled: true,
        priority: 0,
        endpointToken,
        callbackUrl,
        callbackSecret,
      },
      include: { skill: true },
    });

    const endpoint = endpointToken ? { endpointToken, callbackUrl } : undefined;

    return NextResponse.json({ agentSkill, endpoint });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Attach skill error:', error);
    return NextResponse.json({ error: 'Failed to attach skill' }, { status: 500 });
  }
}