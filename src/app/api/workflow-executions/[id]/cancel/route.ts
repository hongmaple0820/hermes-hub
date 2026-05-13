import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { WorkflowEngine } from '@/lib/workflow-engine';

/**
 * POST /api/workflow-executions/[id]/cancel
 * Cancel a running execution. Sets status to 'cancelled' and signals the engine to stop.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const execution = await db.workflowExecution.findUnique({
      where: { id },
    });

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }
    if (execution.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only running or pending executions can be cancelled
    if (execution.status !== 'running' && execution.status !== 'pending') {
      return NextResponse.json(
        {
          error: 'Cannot cancel execution',
          details: `Execution is in '${execution.status}' status. Only 'running' or 'pending' executions can be cancelled.`,
        },
        { status: 400 }
      );
    }

    // Signal the engine to cancel the in-process execution
    try {
      const engine = new WorkflowEngine();
      await engine.cancel(id);
    } catch (engineError) {
      console.error('Engine cancel error (execution may have already completed):', engineError);
    }

    const now = new Date();
    const duration = execution.startedAt
      ? now.getTime() - new Date(execution.startedAt).getTime()
      : null;

    // Update DB status (the engine may have already done this, so use upsert-style update)
    const updated = await db.workflowExecution.update({
      where: { id },
      data: {
        status: 'cancelled',
        completedAt: now,
        duration,
      },
    });

    return NextResponse.json({
      execution: {
        id: updated.id,
        status: updated.status,
        completedAt: updated.completedAt,
        duration: updated.duration,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Cancel workflow execution error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel execution', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
