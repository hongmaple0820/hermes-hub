import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
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

    const run = await db.run.findUnique({
      where: { id: runId },
      include: {
        steps: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!run || run.threadId !== threadId) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ data: run });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get run error:', error);
    return NextResponse.json(
      { error: 'Failed to get run', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
