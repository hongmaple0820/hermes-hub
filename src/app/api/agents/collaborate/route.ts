/**
 * Agent Collaboration API
 *
 * POST /api/agents/collaborate — Execute a collaboration request
 * GET  /api/agents/collaborate — Get collaboration history for an agent
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  executeCollaboration,
  getCollaborationHistory,
  type CollaborationType,
  type CollaborationRequest,
} from '@/lib/agent-collaboration';

const VALID_COLLABORATION_TYPES: CollaborationType[] = [
  'delegation',
  'handoff',
  'broadcast',
  'pipeline',
  'round-robin',
  'consensus',
];

/**
 * POST /api/agents/collaborate
 *
 * Execute a collaboration request between agents.
 *
 * Body: {
 *   type: 'delegation' | 'handoff' | 'broadcast' | 'pipeline' | 'round-robin' | 'consensus',
 *   fromAgentId: string,
 *   toAgentIds: string[],
 *   task: string,
 *   context?: Record<string, any>,
 *   options?: CollaborationOptions
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { type, fromAgentId, toAgentIds, task, context, options } = body as {
      type: CollaborationType;
      fromAgentId?: string;
      toAgentIds?: string[];
      task?: string;
      context?: Record<string, unknown>;
      options?: Record<string, unknown>;
    };

    // Validate required fields
    if (!type) {
      return NextResponse.json(
        { error: 'Missing required field: type' },
        { status: 400 }
      );
    }

    if (!VALID_COLLABORATION_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Invalid collaboration type. Must be one of: ${VALID_COLLABORATION_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!fromAgentId) {
      return NextResponse.json(
        { error: 'Missing required field: fromAgentId' },
        { status: 400 }
      );
    }

    if (!toAgentIds || !Array.isArray(toAgentIds) || toAgentIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: toAgentIds (must be a non-empty array)' },
        { status: 400 }
      );
    }

    if (!task || typeof task !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: task (must be a string)' },
        { status: 400 }
      );
    }

    // Validate that the fromAgent belongs to the user
    const fromAgent = await db.agent.findUnique({
      where: { id: fromAgentId },
      select: { id: true, userId: true, name: true },
    });

    if (!fromAgent) {
      return NextResponse.json(
        { error: 'Source agent not found' },
        { status: 404 }
      );
    }

    if (fromAgent.userId !== user.id) {
      return NextResponse.json(
        { error: 'You do not have access to the source agent' },
        { status: 403 }
      );
    }

    // Validate that all target agents exist and the user has access
    const targetAgents = await db.agent.findMany({
      where: { id: { in: toAgentIds } },
      select: { id: true, userId: true, name: true, isPublic: true },
    });

    const foundIds = new Set(targetAgents.map((a) => a.id));
    const missingIds = toAgentIds.filter((id: string) => !foundIds.has(id));
    if (missingIds.length > 0) {
      return NextResponse.json(
        { error: `Target agents not found: ${missingIds.join(', ')}` },
        { status: 404 }
      );
    }

    // Check access: user must own the agent OR the agent must be public
    const inaccessible = targetAgents.filter(
      (a) => a.userId !== user.id && !a.isPublic
    );
    if (inaccessible.length > 0) {
      return NextResponse.json(
        { error: `Access denied for agents: ${inaccessible.map((a) => a.name).join(', ')}` },
        { status: 403 }
      );
    }

    // Type-specific validation
    if (type === 'delegation' && toAgentIds.length !== 1) {
      return NextResponse.json(
        { error: 'Delegation requires exactly one target agent' },
        { status: 400 }
      );
    }

    if (type === 'handoff') {
      if (toAgentIds.length !== 1) {
        return NextResponse.json(
          { error: 'Handoff requires exactly one target agent' },
          { status: 400 }
        );
      }
      const convId = options?.conversationId || context?.conversationId;
      if (!convId || typeof convId !== 'string') {
        return NextResponse.json(
          { error: 'Handoff requires conversationId in options or context' },
          { status: 400 }
        );
      }
    }

    if (type === 'pipeline' && toAgentIds.length < 1) {
      return NextResponse.json(
        { error: 'Pipeline requires at least one target agent (in addition to the source agent)' },
        { status: 400 }
      );
    }

    // Build and execute the collaboration request
    const collaborationRequest: CollaborationRequest = {
      type,
      fromAgentId,
      toAgentIds,
      task,
      context,
      options: options as CollaborationRequest['options'],
    };

    const result = await executeCollaboration(collaborationRequest);

    return NextResponse.json({
      collaboration: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Collaboration execution error:', error);
    return NextResponse.json(
      {
        error: 'Failed to execute collaboration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/collaborate
 *
 * Get collaboration history for a specific agent.
 *
 * Query params:
 *   agentId (required) — The agent to get history for
 *   type (optional)    — Filter by collaboration type
 *   limit (optional)   — Max results (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);

    const agentId = url.searchParams.get('agentId');
    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify the agent belongs to the user
    const agent = await db.agent.findUnique({
      where: { id: agentId },
      select: { id: true, userId: true },
    });

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      );
    }

    if (agent.userId !== user.id) {
      return NextResponse.json(
        { error: 'You do not have access to this agent' },
        { status: 403 }
      );
    }

    const typeParam = url.searchParams.get('type') as CollaborationType | null;
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') || '20'),
      100
    );

    if (typeParam && !VALID_COLLABORATION_TYPES.includes(typeParam)) {
      return NextResponse.json(
        { error: `Invalid type filter. Must be one of: ${VALID_COLLABORATION_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const history = getCollaborationHistory(
      agentId,
      typeParam || undefined,
      limit
    );

    return NextResponse.json({
      history: history.map((record) => ({
        id: record.id,
        type: record.type,
        fromAgentId: record.fromAgentId,
        toAgentIds: record.toAgentIds,
        task: record.task,
        success: record.result.success,
        resultSummary: record.result.aggregatedResult?.slice(0, 500) || null,
        duration: record.result.duration,
        errorCount: record.result.errors.length,
        createdAt: record.createdAt.toISOString(),
      })),
      total: history.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get collaboration history error:', error);
    return NextResponse.json(
      { error: 'Failed to get collaboration history' },
      { status: 500 }
    );
  }
}
