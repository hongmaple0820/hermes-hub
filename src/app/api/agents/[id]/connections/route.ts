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

    const connections = await db.agentConnection.findMany({
      where: { agentId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ connections });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List agent connections error:', error);
    return NextResponse.json(
      { error: 'Failed to list agent connections', details: error instanceof Error ? error.message : 'Unknown error' },
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
    const { type, name, config, apiKey } = body;

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!type) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'type is required' },
        { status: 400 }
      );
    }

    const validTypes = ['http', 'hermes', 'websocket', 'cli', 'acp'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid connection type', details: `Type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const connection = await db.agentConnection.create({
      data: {
        agentId: id,
        type,
        name: name || null,
        config: JSON.stringify(config || {}),
        status: 'disconnected',
        apiKey: apiKey || null,
      },
    });

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create agent connection error:', error);
    return NextResponse.json(
      { error: 'Failed to create agent connection', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
