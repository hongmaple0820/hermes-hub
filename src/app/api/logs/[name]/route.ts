import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { name } = await params;
    const url = new URL(request.url);
    const level = url.searchParams.get('level');
    const limit = parseInt(url.searchParams.get('limit') || '100', 10);
    const since = url.searchParams.get('since');

    const where: Record<string, unknown> = {
      userId: user.id,
      type: name,
    };

    if (level) {
      where.level = level;
    }

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        where.createdAt = { gte: sinceDate };
      }
    }

    const logs = await db.logEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 1000),
    });

    return NextResponse.json({ type: name, logs, count: logs.length });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get log entries error:', error);
    return NextResponse.json(
      { error: 'Failed to get log entries', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
