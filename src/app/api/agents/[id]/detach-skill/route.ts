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
    const { skillId } = body;

    if (!skillId) {
      return NextResponse.json({ error: 'skillId is required' }, { status: 400 });
    }

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const agentSkill = await db.agentSkill.findUnique({ where: { agentId_skillId: { agentId: id, skillId } } });
    if (!agentSkill) {
      return NextResponse.json({ error: 'Skill not attached to this agent' }, { status: 404 });
    }

    await db.agentSkill.delete({ where: { id: agentSkill.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Detach skill error:', error);
    return NextResponse.json({ error: 'Failed to detach skill' }, { status: 500 });
  }
}