import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: agentId } = await params;

    // Verify agent ownership
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const agentTools = await db.agentTool.findMany({
      where: { agentId },
      include: {
        tool: true,
      },
      orderBy: { priority: 'asc' },
    });

    return NextResponse.json({ data: agentTools });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List agent tools error:', error);
    return NextResponse.json(
      { error: 'Failed to list agent tools', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id: agentId } = await params;
    const body = await request.json();

    const { toolId, config, priority } = body;

    if (!toolId) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'toolId is required' },
        { status: 400 }
      );
    }

    // Verify agent ownership
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Verify tool accessibility: must be user's own, public, or system tool
    const tool = await db.tool.findUnique({ where: { id: toolId } });
    if (!tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }
    if (tool.userId !== user.id && !tool.isPublic && tool.userId !== null) {
      return NextResponse.json(
        { error: 'Tool not accessible', details: 'You do not have access to this tool' },
        { status: 403 }
      );
    }

    // Check if already bound
    const existing = await db.agentTool.findUnique({
      where: { agentId_toolId: { agentId, toolId } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Tool already bound', details: 'This tool is already bound to this agent' },
        { status: 409 }
      );
    }

    const agentTool = await db.agentTool.create({
      data: {
        agentId,
        toolId,
        config: config ? JSON.stringify(config) : '{}',
        priority: priority ?? 0,
      },
      include: {
        tool: true,
      },
    });

    return NextResponse.json({ data: agentTool }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Bind tool to agent error:', error);
    return NextResponse.json(
      { error: 'Failed to bind tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
