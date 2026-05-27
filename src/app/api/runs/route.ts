import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/runs — Returns all runs for the current user across all threads.
 * Query params:
 *   status   — filter by run status (e.g. "completed", "failed", "in_progress", "cancelled")
 *   agentId  — filter by agent ID
 *   limit    — max number of runs to return (default 50)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const url = new URL(request.url);
    const status = url.searchParams.get('status') || undefined;
    const agentId = url.searchParams.get('agentId') || undefined;
    const rawLimit = parseInt(url.searchParams.get('limit') || '50', 10);
    const limit = Math.min(Math.max(rawLimit, 1), 200); // Clamp between 1 and 200

    // Build where clause: runs belonging to threads owned by this user
    const where: Record<string, unknown> = {
      thread: { userId: user.id },
    };

    if (status) {
      where.status = status;
    }

    if (agentId) {
      where.thread = {
        ...(where.thread as Record<string, unknown>),
        agentId,
      };
    }

    const runs = await db.run.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        thread: {
          select: {
            id: true,
            title: true,
            agentId: true,
            agent: {
              select: { id: true, name: true, avatar: true },
            },
          },
        },
        _count: {
          select: { steps: true },
        },
      },
    });

    // Serialize runs with computed fields
    const serializedRuns = runs.map((run) => {
      const durationMs =
        run.startedAt && run.completedAt
          ? new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()
          : 0;

      return {
        id: run.id,
        threadId: run.threadId,
        status: run.status,
        inputTokens: run.inputTokens,
        outputTokens: run.outputTokens,
        totalSteps: run.totalSteps,
        stepCount: run._count.steps,
        lastError: run.lastError,
        startedAt: run.startedAt?.toISOString() ?? null,
        completedAt: run.completedAt?.toISOString() ?? null,
        createdAt: run.createdAt.toISOString(),
        durationMs,
        thread: {
          id: run.thread.id,
          title: run.thread.title,
          agentId: run.thread.agentId,
          agent: run.thread.agent,
        },
      };
    });

    return NextResponse.json({ runs: serializedRuns });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List all runs error:', error);
    return NextResponse.json({ error: 'Failed to list runs' }, { status: 500 });
  }
}
