import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: agentId, toolId } = await params;
    const body = await request.json();

    // Verify agent ownership
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Find the binding
    const existing = await db.agentTool.findUnique({
      where: { agentId_toolId: { agentId, toolId } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Agent-tool binding not found' }, { status: 404 });
    }

    const { isEnabled, config, priority } = body;

    const agentTool = await db.agentTool.update({
      where: { id: existing.id },
      data: {
        ...(isEnabled !== undefined ? { isEnabled } : {}),
        ...(config !== undefined ? { config: JSON.stringify(config) } : {}),
        ...(priority !== undefined ? { priority } : {}),
      },
      include: {
        tool: true,
      },
    });

    return NextResponse.json({ data: agentTool });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update agent tool binding error:', error);
    return NextResponse.json(
      { error: 'Failed to update binding', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; toolId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: agentId, toolId } = await params;

    // Verify agent ownership
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Find the binding
    const existing = await db.agentTool.findUnique({
      where: { agentId_toolId: { agentId, toolId } },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Agent-tool binding not found' }, { status: 404 });
    }

    await db.agentTool.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ data: { agentId, toolId, deleted: true } });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete agent tool binding error:', error);
    return NextResponse.json(
      { error: 'Failed to unbind tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
