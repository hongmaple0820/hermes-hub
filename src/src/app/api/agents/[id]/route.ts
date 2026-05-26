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

    const agent = await db.agent.findUnique({
      where: { id },
      include: {
        provider: { select: { id: true, name: true, provider: true, defaultModel: true, isActive: true } },
        skills: { include: { skill: true }, orderBy: { priority: 'asc' } },
        connections: true,
        plugins: true,
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Allow access if owner or if agent is public
    if (agent.userId !== user.id && !agent.isPublic) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get agent error:', error);
    return NextResponse.json(
      { error: 'Failed to get agent', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const existing = await db.agent.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'description', 'avatar', 'systemPrompt', 'mode', 'isPublic', 'status',
      'providerId', 'model', 'temperature', 'maxTokens', 'callbackUrl', 'apiKey',
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const updated = await db.agent.update({
      where: { id },
      data: updateData,
      include: {
        provider: { select: { id: true, name: true, provider: true, defaultModel: true } },
        skills: { include: { skill: true } },
        connections: true,
        plugins: true,
      },
    });

    return NextResponse.json({ agent: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update agent error:', error);
    return NextResponse.json(
      { error: 'Failed to update agent', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const existing = await db.agent.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.agent.delete({ where: { id } });

    return NextResponse.json({ message: 'Agent deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete agent error:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
