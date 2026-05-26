import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'agentId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify agent belongs to user
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: 'Agent not found or not owned by you' }, { status: 403 });
    }

    const agentSkill = await db.agentSkill.findUnique({
      where: { agentId_skillId: { agentId, skillId: id } },
    });

    if (!agentSkill) {
      return NextResponse.json({ error: 'Skill not installed on this agent' }, { status: 404 });
    }

    await db.agentSkill.delete({
      where: { agentId_skillId: { agentId, skillId: id } },
    });

    return NextResponse.json({ message: 'Skill uninstalled successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Uninstall skill error:', error);
    return NextResponse.json(
      { error: 'Failed to uninstall skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
