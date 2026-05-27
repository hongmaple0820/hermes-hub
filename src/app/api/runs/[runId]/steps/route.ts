import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Internal API - create a step
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;
    const body = await request.json();
    const { type, status, detail } = body;

    // Verify run exists
    const run = await db.run.findUnique({ where: { id: runId } });
    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    const step = await db.step.create({
      data: {
        runId,
        type: type || 'message_creation',
        status: status || 'in_progress',
        detail: detail ? JSON.stringify(detail) : '{}',
        startedAt: new Date(),
      },
    });

    // Update run's totalSteps count
    await db.run.update({
      where: { id: runId },
      data: { totalSteps: { increment: 1 } },
    });

    return NextResponse.json({ step }, { status: 201 });
  } catch (error) {
    console.error('Create step error:', error);
    return NextResponse.json({ error: 'Failed to create step' }, { status: 500 });
  }
}

// Internal API - list steps for a run
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params;

    const steps = await db.step.findMany({
      where: { runId },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ steps });
  } catch (error) {
    console.error('List steps error:', error);
    return NextResponse.json({ error: 'Failed to list steps' }, { status: 500 });
  }
}
