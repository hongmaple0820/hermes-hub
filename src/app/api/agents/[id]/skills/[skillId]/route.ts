import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; skillId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id, skillId } = await params;
    const body = await request.json();

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const agentSkill = await db.agentSkill.findUnique({
      where: { agentId_skillId: { agentId: id, skillId } },
    });
    if (!agentSkill) {
      return NextResponse.json({ error: 'Skill not installed on this agent' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.config !== undefined) updateData.config = JSON.stringify(body.config);
    if (body.isEnabled !== undefined) updateData.isEnabled = body.isEnabled;
    if (body.priority !== undefined) updateData.priority = body.priority;
    if (body.callbackUrl !== undefined) updateData.callbackUrl = body.callbackUrl;
    if (body.callbackSecret !== undefined) updateData.callbackSecret = body.callbackSecret;

    const updated = await db.agentSkill.update({
      where: { agentId_skillId: { agentId: id, skillId } },
      data: updateData,
      include: { skill: true },
    });

    return NextResponse.json({ agentSkill: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update agent skill error:', error);
    return NextResponse.json(
      { error: 'Failed to update agent skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; skillId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id, skillId } = await params;

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const agentSkill = await db.agentSkill.findUnique({
      where: { agentId_skillId: { agentId: id, skillId } },
    });
    if (!agentSkill) {
      return NextResponse.json({ error: 'Skill not installed on this agent' }, { status: 404 });
    }

    await db.agentSkill.delete({
      where: { agentId_skillId: { agentId: id, skillId } },
    });

    return NextResponse.json({ message: 'Skill removed from agent successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Remove agent skill error:', error);
    return NextResponse.json(
      { error: 'Failed to remove agent skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
