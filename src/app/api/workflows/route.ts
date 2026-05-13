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

/**
 * GET /api/workflows
 * List all workflows for the authenticated user.
 * Query params: status (optional filter)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const where: Record<string, unknown> = { userId: user.id };
    if (status) {
      where.status = status;
    }

    const workflows = await db.workflow.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            triggerType: true,
            startedAt: true,
            completedAt: true,
            createdAt: true,
            duration: true,
          },
        },
      },
    });

    // Parse JSON fields and attach latest execution status
    const parsed = workflows.map((w) => {
      const parsedWorkflow = parseWorkflowFields(w as unknown as Record<string, unknown>);
      return {
        ...parsedWorkflow,
        latestExecution: w.executions[0] || null,
        executions: undefined, // Remove the nested array, replace with latestExecution
      };
    });

    return NextResponse.json({ workflows: parsed });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List workflows error:', error);
    return NextResponse.json(
      { error: 'Failed to list workflows', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workflows
 * Create a new workflow.
 * Body: { name, description?, icon?, color?, nodes?, edges?, trigger?, variables?, timeout?, retryPolicy?, errorPolicy? }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const {
      name,
      description,
      icon,
      color,
      nodes,
      edges,
      trigger,
      variables,
      timeout,
      retryPolicy,
      errorPolicy,
    } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required field', details: 'name is required' },
        { status: 400 }
      );
    }

    const workflow = await db.workflow.create({
      data: {
        userId: user.id,
        name: name.trim(),
        description: description || null,
        icon: icon || null,
        color: color || null,
        nodes: nodes ? JSON.stringify(nodes) : '[]',
        edges: edges ? JSON.stringify(edges) : '[]',
        trigger: trigger ? JSON.stringify(trigger) : '{}',
        variables: variables ? JSON.stringify(variables) : '{}',
        timeout: typeof timeout === 'number' ? timeout : 300,
        retryPolicy: retryPolicy ? JSON.stringify(retryPolicy) : '{}',
        errorPolicy: errorPolicy || 'stop',
        status: 'draft',
        version: 1,
      },
    });

    const parsed = parseWorkflowFields(workflow as unknown as Record<string, unknown>);

    return NextResponse.json({ workflow: parsed }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create workflow error:', error);
    return NextResponse.json(
      { error: 'Failed to create workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
