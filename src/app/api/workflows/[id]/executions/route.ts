import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

// Helper to parse execution JSON fields
function parseExecutionFields(execution: Record<string, unknown>) {
  return {
    ...execution,
    triggerData: typeof execution.triggerData === 'string' ? JSON.parse(execution.triggerData) : execution.triggerData,
    nodeResults: typeof execution.nodeResults === 'string' ? JSON.parse(execution.nodeResults) : execution.nodeResults,
    variables: typeof execution.variables === 'string' ? JSON.parse(execution.variables) : execution.variables,
  };
}

/**
 * GET /api/workflows/[id]/executions
 * List executions for a workflow.
 * Query params: status, limit (default 20), offset
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const url = new URL(request.url);

    const status = url.searchParams.get('status');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10), 1), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    // Verify workflow exists and belongs to user
    const workflow = await db.workflow.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    if (workflow.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: Record<string, unknown> = { workflowId: id };
    if (status) {
      where.status = status;
    }

    const [executions, total] = await Promise.all([
      db.workflowExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.workflowExecution.count({ where }),
    ]);

    const parsed = executions.map((e) =>
      parseExecutionFields(e as unknown as Record<string, unknown>)
    );

    return NextResponse.json({
      executions: parsed,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List workflow executions error:', error);
    return NextResponse.json(
      { error: 'Failed to list executions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
