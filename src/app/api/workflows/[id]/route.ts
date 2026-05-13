import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

// Helper to parse JSON fields from workflow record
function parseWorkflowFields(workflow: Record<string, unknown>) {
  return {
    ...workflow,
    nodes: typeof workflow.nodes === 'string' ? JSON.parse(workflow.nodes) : workflow.nodes,
    edges: typeof workflow.edges === 'string' ? JSON.parse(workflow.edges) : workflow.edges,
    trigger: typeof workflow.trigger === 'string' ? JSON.parse(workflow.trigger) : workflow.trigger,
    variables: typeof workflow.variables === 'string' ? JSON.parse(workflow.variables) : workflow.variables,
    retryPolicy: typeof workflow.retryPolicy === 'string' ? JSON.parse(workflow.retryPolicy) : workflow.retryPolicy,
  };
}

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
 * GET /api/workflows/[id]
 * Get a single workflow with optional execution history.
 * Query param: includeExecutions=true to include recent executions
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const url = new URL(request.url);
    const includeExecutions = url.searchParams.get('includeExecutions') === 'true';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workflow: any = await db.workflow.findUnique({
      where: { id },
      include: includeExecutions
        ? {
            executions: {
              orderBy: { createdAt: 'desc' },
              take: 20,
            },
          }
        : undefined,
    });

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    if (workflow.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const parsed = parseWorkflowFields(workflow as unknown as Record<string, unknown>) as Record<string, unknown>;

    if (includeExecutions && (workflow as any).executions) {
      parsed.executions = ((workflow as any).executions as Record<string, unknown>[]).map(parseExecutionFields);
    }

    return NextResponse.json({ workflow: parsed });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to get workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/workflows/[id]
 * Update a workflow. When nodes/edges change, increment version.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const existing = await db.workflow.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['name', 'description', 'icon', 'color', 'timeout', 'errorPolicy', 'status'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    // Handle JSON fields — also check if nodes/edges changed for version increment
    let shouldIncrementVersion = false;

    if (body.nodes !== undefined) {
      const newNodesStr = typeof body.nodes === 'string' ? body.nodes : JSON.stringify(body.nodes);
      updateData.nodes = newNodesStr;
      if (newNodesStr !== existing.nodes) {
        shouldIncrementVersion = true;
      }
    }

    if (body.edges !== undefined) {
      const newEdgesStr = typeof body.edges === 'string' ? body.edges : JSON.stringify(body.edges);
      updateData.edges = newEdgesStr;
      if (newEdgesStr !== existing.edges) {
        shouldIncrementVersion = true;
      }
    }

    if (body.trigger !== undefined) {
      updateData.trigger = typeof body.trigger === 'string' ? body.trigger : JSON.stringify(body.trigger);
    }

    if (body.variables !== undefined) {
      updateData.variables = typeof body.variables === 'string' ? body.variables : JSON.stringify(body.variables);
    }

    if (body.retryPolicy !== undefined) {
      updateData.retryPolicy = typeof body.retryPolicy === 'string' ? body.retryPolicy : JSON.stringify(body.retryPolicy);
    }

    if (shouldIncrementVersion) {
      updateData.version = existing.version + 1;
    }

    // Trim name if provided
    if (updateData.name && typeof updateData.name === 'string') {
      updateData.name = updateData.name.trim();
    }

    const updated = await db.workflow.update({
      where: { id },
      data: updateData,
    });

    const parsed = parseWorkflowFields(updated as unknown as Record<string, unknown>);

    return NextResponse.json({ workflow: parsed });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to update workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workflows/[id]
 * Delete a workflow (cascade deletes executions).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const existing = await db.workflow.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Cascade delete is handled by Prisma schema (onDelete: Cascade on WorkflowExecution)
    await db.workflow.delete({ where: { id } });

    return NextResponse.json({ message: 'Workflow deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to delete workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
