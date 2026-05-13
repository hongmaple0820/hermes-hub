import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

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

    // Parse existing node results and update the specific node with the input
    const nodeResults = typeof execution.nodeResults === 'string'
      ? JSON.parse(execution.nodeResults)
      : execution.nodeResults || {};

    // Update the node result with the provided input
    nodeResults[nodeId] = {
      ...(nodeResults[nodeId] || {}),
      status: 'completed',
      output: input,
      resumedAt: new Date().toISOString(),
    };

    // Update execution status back to running
    const updated = await db.workflowExecution.update({
      where: { id },
      data: {
        status: 'running',
        nodeResults: JSON.stringify(nodeResults),
      },
    });

    // TODO: Trigger async execution engine to continue from the resumed node
    // The engine will process remaining nodes and update the execution record

    return NextResponse.json({
      execution: {
        id: updated.id,
        status: updated.status,
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
