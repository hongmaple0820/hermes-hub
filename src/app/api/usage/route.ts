import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const period = url.searchParams.get('period') || '30d';

    // Calculate date range
    const now = new Date();
    let since: Date;
    switch (period) {
      case '7d':
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
      default:
        since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
    }

    // Get all usage records for the period
    const records = await db.usageRecord.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Calculate totals
    const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalCost = records.reduce((sum, r) => sum + r.estimatedCost, 0);
    const sessionCount = new Set(records.map((r) => r.conversationId).filter(Boolean)).size;

    // Calculate daily average
    const days = Math.max(1, Math.ceil((now.getTime() - since.getTime()) / (24 * 60 * 60 * 1000)));
    const dailyAverage = {
      inputTokens: Math.round(totalInputTokens / days),
      outputTokens: Math.round(totalOutputTokens / days),
      cost: Math.round(totalCost / days * 10000) / 10000,
    };

    // Model breakdown
    const modelMap = new Map<string, { inputTokens: number; outputTokens: number; cost: number; count: number }>();
    for (const r of records) {
      const model = r.model || 'unknown';
      const existing = modelMap.get(model) || { inputTokens: 0, outputTokens: 0, cost: 0, count: 0 };
      existing.inputTokens += r.inputTokens;
      existing.outputTokens += r.outputTokens;
      existing.cost += r.estimatedCost;
      existing.count += 1;
      modelMap.set(model, existing);
    }
    const modelBreakdown = Array.from(modelMap.entries()).map(([model, data]) => ({
      model,
      ...data,
    }));

    // Daily trend
    const dayMap = new Map<string, { date: string; inputTokens: number; outputTokens: number; cost: number; count: number }>();
    for (const r of records) {
      const date = r.createdAt.toISOString().split('T')[0];
      const existing = dayMap.get(date) || { date, inputTokens: 0, outputTokens: 0, cost: 0, count: 0 };
      existing.inputTokens += r.inputTokens;
      existing.outputTokens += r.outputTokens;
      existing.cost += r.estimatedCost;
      existing.count += 1;
      dayMap.set(date, existing);
    }
    const dailyTrend = Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      period,
      since: since.toISOString(),
      until: now.toISOString(),
      totalInputTokens,
      totalOutputTokens,
      totalCost,
      sessionCount,
      dailyAverage,
      modelBreakdown,
      dailyTrend,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get usage error:', error);
    return NextResponse.json(
      { error: 'Failed to get usage', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
