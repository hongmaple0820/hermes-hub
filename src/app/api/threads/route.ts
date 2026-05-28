import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { agentId, title, metadata, contextWindow, systemPrompt } = body;

    if (!agentId) {
      return NextResponse.json({ error: 'agentId is required' }, { status: 400 });
    }

    // Verify agent ownership
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const thread = await db.thread.create({
      data: {
        agentId,
        userId: user.id,
        title: title || `Thread with ${agent.name}`,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
        contextWindow: contextWindow || 4096,
        systemPrompt: systemPrompt || agent.systemPrompt,
        status: 'active',
      },
    });

    return NextResponse.json({ thread }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create thread error:', error);
    return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { userId: user.id };
    if (agentId) where.agentId = agentId;
    if (status) where.status = status;

    const threads = await db.thread.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true, avatar: true } },
        _count: { select: { messages: true, runs: true } },
      },
    });

    return NextResponse.json({ threads });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List threads error:', error);
    return NextResponse.json({ error: 'Failed to list threads' }, { status: 500 });
  }
}
