import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const existing = await db.job.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check repeat limit
    if (existing.repeatLimit !== null && existing.completedCount >= existing.repeatLimit) {
      return NextResponse.json(
        { error: 'Job has reached its repeat limit', details: `Limit: ${existing.repeatLimit}, Completed: ${existing.completedCount}` },
        { status: 400 }
      );
    }

    const updated = await db.job.update({
      where: { id },
      data: {
        completedCount: existing.completedCount + 1,
        lastRunAt: new Date(),
        lastStatus: 'success',
        lastError: null,
      },
      include: {
        agent: { select: { id: true, name: true, avatar: true } },
        provider: { select: { id: true, name: true, provider: true } },
      },
    });

    return NextResponse.json({ job: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Run job error:', error);
    return NextResponse.json(
      { error: 'Failed to run job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
