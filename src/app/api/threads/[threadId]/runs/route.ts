import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
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

    const run = await db.run.create({
      data: {
        threadId,
        status: 'queued',
      },
    });

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create run error:', error);
    return NextResponse.json({ error: 'Failed to create run' }, { status: 500 });
  }
}

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

    const runs = await db.run.findMany({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
      include: { steps: { orderBy: { createdAt: 'asc' } } },
    });

    return NextResponse.json({ runs });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List runs error:', error);
    return NextResponse.json({ error: 'Failed to list runs' }, { status: 500 });
  }
}
