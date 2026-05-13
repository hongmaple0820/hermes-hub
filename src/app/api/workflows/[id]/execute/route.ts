import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { WorkflowEngine } from '@/lib/workflow-engine';

/**
 * POST /api/workflows/[id]/execute
 * Execute a workflow. Creates a WorkflowExecution record, starts the engine
 * asynchronously, and returns the execution ID immediately.
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

    // Only active or draft workflows can be executed
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

    // Auto-activate the workflow if it was in draft
    if (workflow.status === 'draft') {
      await db.workflow.update({
        where: { id },
        data: { status: 'active' },
      });
    }

    // Start the workflow engine asynchronously (fire-and-forget)
    const engine = new WorkflowEngine();
    engine.execute(id, {
      userId: user.id,
      variables: mergedVariables,
      triggerType: effectiveTriggerType as 'manual' | 'webhook' | 'schedule' | 'event' | 'api',
      triggerData: { triggeredAt: now.toISOString(), userId: user.id },
      executionId: execution.id,
      onProgress: (event) => {
        // Progress events are logged; state is persisted by the engine
        console.log(`[Workflow ${id}] ${event.type}${event.nodeId ? ` node=${event.nodeId}` : ''}`);
      },
    }).then((result) => {
      // Execution completed — state is already persisted by the engine
      console.log(`[Workflow ${id}] Execution ${result.executionId} finished with status: ${result.status}`);
    }).catch((error) => {
      // Execution failed unexpectedly — update the record if not already done
      console.error(`[Workflow ${id}] Execution ${execution.id} failed:`, error);
      // Attempt to mark as failed if still running
      db.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error during workflow execution',
          completedAt: new Date(),
        },
      }).catch(() => {
        // Ignore DB update errors — the engine may have already updated the record
      });
    });

    // Return execution ID immediately
    return NextResponse.json(
      {
        executionId: execution.id,
        status: 'running',
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
