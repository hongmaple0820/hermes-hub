import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { sessionId } = await params;

    // Get usage records for a specific conversation/session
    const records = await db.usageRecord.findMany({
      where: {
        userId: user.id,
        conversationId: sessionId,
      },
      include: {
        agent: { select: { id: true, name: true, avatar: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (records.length === 0) {
      return NextResponse.json(
        { error: 'No usage records found for this session' },
        { status: 404 }
      );
    }

    // Calculate session totals
    const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalCacheReadTokens = records.reduce((sum, r) => sum + r.cacheReadTokens, 0);
    const totalCacheWriteTokens = records.reduce((sum, r) => sum + r.cacheWriteTokens, 0);
    const totalReasoningTokens = records.reduce((sum, r) => sum + r.reasoningTokens, 0);
    const totalCost = records.reduce((sum, r) => sum + r.estimatedCost, 0);

    return NextResponse.json({
      sessionId,
      summary: {
        totalInputTokens,
        totalOutputTokens,
        totalCacheReadTokens,
        totalCacheWriteTokens,
        totalReasoningTokens,
        totalCost,
        recordCount: records.length,
      },
      records,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get session usage error:', error);
    return NextResponse.json(
      { error: 'Failed to get session usage', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
