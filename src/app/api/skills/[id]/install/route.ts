import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { agentId, config, priority } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'agentId is required' },
        { status: 400 }
      );
    }

    // Verify skill exists and is enabled
    const skill = await db.skill.findUnique({ where: { id } });
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }
    if (!skill.isEnabled) {
      return NextResponse.json({ error: 'Skill is not enabled' }, { status: 400 });
    }

    // Verify agent belongs to user
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: 'Agent not found or not owned by you' }, { status: 403 });
    }

    // Check if already installed
    const existing = await db.agentSkill.findUnique({
      where: { agentId_skillId: { agentId, skillId: id } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Skill already installed', details: 'This skill is already installed on the agent' },
        { status: 409 }
      );
    }

    const agentSkill = await db.agentSkill.create({
      data: {
        agentId,
        skillId: id,
        config: JSON.stringify(config || {}),
        isEnabled: true,
        priority: priority ?? 0,
      },
      include: { skill: true },
    });

    return NextResponse.json({ agentSkill }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Install skill error:', error);
    return NextResponse.json(
      { error: 'Failed to install skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
