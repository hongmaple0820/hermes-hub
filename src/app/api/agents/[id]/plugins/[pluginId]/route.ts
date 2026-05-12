import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pluginId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id, pluginId } = await params;
    const body = await request.json();

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const plugin = await db.agentPlugin.findUnique({ where: { id: pluginId } });
    if (!plugin || plugin.agentId !== id) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['name', 'description', 'type', 'endpoint', 'config', 'authType', 'authToken', 'isEnabled'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'config') {
          updateData[field] = JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await db.agentPlugin.update({
      where: { id: pluginId },
      data: updateData,
    });

    return NextResponse.json({ plugin: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update agent plugin error:', error);
    return NextResponse.json(
      { error: 'Failed to update agent plugin', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pluginId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id, pluginId } = await params;

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const plugin = await db.agentPlugin.findUnique({ where: { id: pluginId } });
    if (!plugin || plugin.agentId !== id) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    await db.agentPlugin.delete({ where: { id: pluginId } });

    return NextResponse.json({ message: 'Plugin removed successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete agent plugin error:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent plugin', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
