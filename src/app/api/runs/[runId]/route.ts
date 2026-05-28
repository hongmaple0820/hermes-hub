import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Internal API - no auth required (called by agent-runtime service)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    const run = await db.run.findUnique({
      where: { id: runId },
      include: { steps: { orderBy: { createdAt: 'asc' } }, thread: true },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    return NextResponse.json({ run });
  } catch (error) {
    console.error('Get run error:', error);
    return NextResponse.json({ error: 'Failed to get run' }, { status: 500 });
  }
}

// Internal API - update run status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['status', 'inputTokens', 'outputTokens', 'totalSteps', 'requiredAction', 'lastError', 'startedAt', 'completedAt'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    const run = await db.run.update({
      where: { id: runId },
      data: updateData,
      include: { steps: true },
    });

    return NextResponse.json({ run });
  } catch (error) {
    console.error('Update run error:', error);
    return NextResponse.json({ error: 'Failed to update run' }, { status: 500 });
  }
}
