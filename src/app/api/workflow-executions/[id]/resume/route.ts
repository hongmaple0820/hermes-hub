import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { WorkflowEngine } from '@/lib/workflow-engine';

/**
 * POST /api/workflow-executions/[id]/resume
 * Resume a paused execution (e.g., after human input).
 * Body: { nodeId, input }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const { nodeId, input } = body;

    if (!nodeId || typeof nodeId !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field', details: 'nodeId is required' },
        { status: 400 }
      );
    }

    const execution = await db.workflowExecution.findUnique({
      where: { id },
    });

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }
    if (execution.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only paused executions can be resumed
    if (execution.status !== 'paused') {
      return NextResponse.json(
        {
          error: 'Cannot resume execution',
          details: `Execution is in '${execution.status}' status. Only 'paused' executions can be resumed.`,
        },
        { status: 400 }
      );
    }

    // Resume the execution via the workflow engine
    const engine = new WorkflowEngine();

    try {
      // Start the resume asynchronously — the engine will update the DB and continue execution
      engine.resume(id, nodeId, input).then((result) => {
        // Execution completed or paused again — state is already persisted by the engine
        console.log(`[Resume] Execution ${id} resumed, finished with status: ${result.status}`);
      }).catch((error) => {
        console.error(`[Resume] Execution ${id} failed after resume:`, error);
        // Attempt to mark as failed if still running
        db.workflowExecution.update({
          where: { id },
          data: {
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error during resumed execution',
            completedAt: new Date(),
          },
        }).catch(() => {
          // Ignore DB update errors — the engine may have already updated the record
        });
      });
    } catch (engineError) {
      // Engine initialization/resume failed — update status to failed
      const errorMessage = engineError instanceof Error ? engineError.message : 'Unknown engine error';
      console.error(`[Resume] Engine resume failed for execution ${id}:`, engineError);

      await db.workflowExecution.update({
        where: { id },
        data: {
          status: 'failed',
          error: `Resume failed: ${errorMessage}`,
          completedAt: new Date(),
        },
      });

      return NextResponse.json(
        { error: 'Failed to resume execution', details: errorMessage },
        { status: 500 }
      );
    }

    return NextResponse.json({
      execution: {
        id,
        status: 'running',
        nodeId,
        resumedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Resume workflow execution error:', error);
    return NextResponse.json(
      { error: 'Failed to resume execution', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
