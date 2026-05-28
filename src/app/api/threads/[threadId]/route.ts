import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { threadId } = await params;

    const thread = await db.thread.findUnique({
      where: { id: threadId },
      include: {
        agent: {
          select: {
            id: true, name: true, avatar: true, mode: true, runtime: true,
            systemPrompt: true, model: true, temperature: true, maxTokens: true,
            providerId: true, callbackUrl: true,
            provider: { select: { id: true, name: true, provider: true, apiKey: true, baseUrl: true, defaultModel: true, isActive: true } },
          },
        },
        messages: { orderBy: { createdAt: 'asc' } },
        runs: { orderBy: { createdAt: 'desc' }, include: { steps: { orderBy: { createdAt: 'asc' } } } },
      },
    });

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    if (thread.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ thread });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get thread error:', error);
    return NextResponse.json({ error: 'Failed to get thread' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { threadId } = await params;
    const body = await request.json();

    const existing = await db.thread.findUnique({ where: { id: threadId } });
    if (!existing) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['title', 'metadata', 'contextWindow', 'systemPrompt', 'status'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'metadata') {
          updateData[field] = JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await db.thread.update({
      where: { id: threadId },
      data: updateData,
    });

    return NextResponse.json({ thread: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update thread error:', error);
    return NextResponse.json({ error: 'Failed to update thread' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { threadId } = await params;

    const existing = await db.thread.findUnique({ where: { id: threadId } });
    if (!existing) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.thread.update({ where: { id: threadId }, data: { status: 'deleted' } });

    return NextResponse.json({ message: 'Thread deleted' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete thread error:', error);
    return NextResponse.json({ error: 'Failed to delete thread' }, { status: 500 });
  }
}
