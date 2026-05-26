import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const plugins = await db.agentPlugin.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ plugins });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List agent plugins error:', error);
    return NextResponse.json(
      { error: 'Failed to list agent plugins', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { name, description, type, endpoint, config, authType, authToken, isEnabled } = body;

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'name is required' },
        { status: 400 }
      );
    }

    const plugin = await db.agentPlugin.create({
      data: {
        agentId: id,
        name,
        description: description || null,
        type: type || 'webhook',
        endpoint: endpoint || null,
        config: JSON.stringify(config || {}),
        authType: authType || null,
        authToken: authToken || null,
        isEnabled: isEnabled ?? true,
      },
    });

    return NextResponse.json({ plugin }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Add agent plugin error:', error);
    return NextResponse.json(
      { error: 'Failed to add agent plugin', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
