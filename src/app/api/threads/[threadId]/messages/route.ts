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

    const thread = await db.thread.findUnique({ where: { id: threadId } });
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    if (thread.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const messages = await db.message.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get thread messages error:', error);
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { threadId } = await params;
    const body = await request.json();
    const { content, type, senderType, senderName, metadata } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const thread = await db.thread.findUnique({ where: { id: threadId } });
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    if (thread.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const message = await db.message.create({
      data: {
        threadId,
        conversationId: thread.id, // Use thread ID as conversation ID
        content,
        type: type || 'text',
        senderId: user.id,
        senderType: senderType || 'user',
        senderName: senderName || user.name,
        metadata: metadata ? JSON.stringify(metadata) : '{}',
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create thread message error:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}
