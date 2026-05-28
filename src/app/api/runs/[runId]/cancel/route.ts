import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * POST /api/runs/[runId]/cancel — Cancel a run by its ID.
 * Verifies ownership via the run → thread → user relationship.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { runId } = await params;

    // Find the run and include its thread for ownership check
    const run = await db.run.findUnique({
      where: { id: runId },
      include: { thread: true },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Verify thread ownership
    if (run.thread.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
        thread: {
          select: {
            id: true,
            title: true,
            agentId: true,
            agent: { select: { id: true, name: true, avatar: true } },
          },
        },
        _count: { select: { steps: true } },
      },
    });

    // Serialize with computed fields
    const durationMs =
      updated.startedAt && updated.completedAt
        ? new Date(updated.completedAt).getTime() - new Date(updated.startedAt).getTime()
        : 0;

    const serializedRun = {
      id: updated.id,
      threadId: updated.threadId,
      status: updated.status,
      inputTokens: updated.inputTokens,
      outputTokens: updated.outputTokens,
      totalSteps: updated.totalSteps,
      stepCount: updated._count.steps,
      lastError: updated.lastError,
      startedAt: updated.startedAt?.toISOString() ?? null,
      completedAt: updated.completedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      durationMs,
      thread: {
        id: updated.thread.id,
        title: updated.thread.title,
        agentId: updated.thread.agentId,
        agent: updated.thread.agent,
      },
    };

    return NextResponse.json({ run: serializedRun });
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
