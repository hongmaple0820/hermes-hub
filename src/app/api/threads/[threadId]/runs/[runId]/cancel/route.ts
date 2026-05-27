import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string; runId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { threadId, runId } = await params;

    // Verify thread ownership
    const thread = await db.thread.findUnique({ where: { id: threadId } });
    if (!thread || thread.userId !== user.id) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    const run = await db.run.findUnique({ where: { id: runId } });
    if (!run || run.threadId !== threadId) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Only queued or in_progress runs can be cancelled
    if (run.status !== 'queued' && run.status !== 'in_progress') {
      return NextResponse.json(
        { error: 'Cannot cancel run', details: `Run status is '${run.status}', can only cancel 'queued' or 'in_progress' runs` },
        { status: 400 }
      );
    }

    const updated = await db.run.update({
      where: { id: runId },
      data: { status: 'cancelled' },
      include: {
        steps: { orderBy: { createdAt: 'asc' } },
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Cancel run error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel run', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
