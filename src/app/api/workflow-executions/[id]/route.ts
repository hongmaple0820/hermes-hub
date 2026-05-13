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
 * GET /api/workflow-executions/[id]
 * Get execution detail with parsed nodeResults and variables.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const execution = await db.workflowExecution.findUnique({
      where: { id },
      include: {
        workflow: {
          select: {
            id: true,
            name: true,
            description: true,
            icon: true,
            color: true,
            status: true,
            version: true,
          },
        },
      },
    });

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 });
    }
    if (execution.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = parseExecutionFields(execution as unknown as Record<string, unknown>);

    return NextResponse.json({ execution: parsed });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get workflow execution error:', error);
    return NextResponse.json(
      { error: 'Failed to get execution', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
