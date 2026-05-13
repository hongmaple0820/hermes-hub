import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * POST /api/workflows/[id]/execute
 * Execute a workflow. Creates a WorkflowExecution record and returns the execution ID immediately.
 * The actual execution happens asynchronously (engine to be connected later).
 * Body: { variables?: Record<string, any>, triggerType?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const workflow = await db.workflow.findUnique({ where: { id } });
    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }
    if (workflow.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Only active workflows can be executed
    if (workflow.status === 'archived') {
      return NextResponse.json(
        { error: 'Cannot execute archived workflow', details: 'Workflow must be in draft or active status' },
        { status: 400 }
      );
    }

    const { variables, triggerType } = body;
    const now = new Date();

    // Merge workflow default variables with runtime variables
    const defaultVars = typeof workflow.variables === 'string' ? JSON.parse(workflow.variables) : workflow.variables;
    const runtimeVars = variables || {};
    const mergedVariables = { ...defaultVars, ...runtimeVars };

    // Determine trigger type
    const effectiveTriggerType = triggerType || 'manual';

    // Create the execution record with status 'running'
    const execution = await db.workflowExecution.create({
      data: {
        workflowId: id,
        userId: user.id,
        status: 'running',
        triggerType: effectiveTriggerType,
        triggerData: JSON.stringify({ triggeredAt: now.toISOString(), userId: user.id }),
        nodeResults: '{}',
        variables: JSON.stringify(mergedVariables),
        startedAt: now,
      },
    });

    // TODO: Trigger async execution engine here
    // The engine will update the execution record as nodes complete
    // For now, we just create the record and return the ID

    // Optionally auto-activate the workflow if it was in draft
    if (workflow.status === 'draft') {
      await db.workflow.update({
        where: { id },
        data: { status: 'active' },
      });
    }

    return NextResponse.json(
      {
        executionId: execution.id,
        status: execution.status,
        startedAt: execution.startedAt,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Execute workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to execute workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
