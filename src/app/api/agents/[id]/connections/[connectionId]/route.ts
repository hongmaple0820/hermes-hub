import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id, connectionId } = await params;
    const body = await request.json();

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const connection = await db.agentConnection.findUnique({ where: { id: connectionId } });
    if (!connection || connection.agentId !== id) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['type', 'name', 'config', 'status', 'lastPing', 'apiKey'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'config') {
          updateData[field] = JSON.stringify(body[field]);
        } else if (field === 'lastPing') {
          updateData[field] = new Date();
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await db.agentConnection.update({
      where: { id: connectionId },
      data: updateData,
    });

    return NextResponse.json({ connection: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update agent connection error:', error);
    return NextResponse.json(
      { error: 'Failed to update agent connection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; connectionId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id, connectionId } = await params;

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const connection = await db.agentConnection.findUnique({ where: { id: connectionId } });
    if (!connection || connection.agentId !== id) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    await db.agentConnection.delete({ where: { id: connectionId } });

    return NextResponse.json({ message: 'Connection deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete agent connection error:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent connection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
