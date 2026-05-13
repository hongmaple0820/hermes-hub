import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Get usage data for the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const records = await db.usageRecord.findMany({
      where: {
        userId: user.id,
        createdAt: { gte: sevenDaysAgo },
      },
      include: {
        agent: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate totals
    const totalInputTokens = records.reduce((sum, r) => sum + r.inputTokens, 0);
    const totalOutputTokens = records.reduce((sum, r) => sum + r.outputTokens, 0);
    const totalTokens = totalInputTokens + totalOutputTokens;
    const estimatedCost = records.reduce((sum, r) => sum + r.estimatedCost, 0);

    // Daily breakdown
    const dailyMap = new Map<string, { inputTokens: number; outputTokens: number; cost: number }>();
    for (const r of records) {
      const date = r.createdAt.toISOString().slice(0, 10);
      const existing = dailyMap.get(date) || { inputTokens: 0, outputTokens: 0, cost: 0 };
      existing.inputTokens += r.inputTokens;
      existing.outputTokens += r.outputTokens;
      existing.cost += r.estimatedCost;
      dailyMap.set(date, existing);
    }

    // Fill in missing days with zeros
    const dailyUsage: { date: string; inputTokens: number; outputTokens: number; cost: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const data = dailyMap.get(dateStr) || { inputTokens: 0, outputTokens: 0, cost: 0 };
      dailyUsage.push({ date: dateStr, ...data });
    }

    // Breakdown by agent
    const agentMap = new Map<string, { agentId: string; agentName: string; tokens: number; cost: number }>();
    for (const r of records) {
      const key = r.agentId || 'unknown';
      const existing = agentMap.get(key) || {
        agentId: key,
        agentName: r.agent?.name || 'Unknown Agent',
        tokens: 0,
        cost: 0,
      };
      existing.tokens += r.inputTokens + r.outputTokens;
      existing.cost += r.estimatedCost;
      agentMap.set(key, existing);
    }
    const byAgent = Array.from(agentMap.values()).sort((a, b) => b.tokens - a.tokens);

    // Breakdown by model
    const modelMap = new Map<string, { model: string; tokens: number; cost: number }>();
    for (const r of records) {
      const key = r.model || 'unknown';
      const existing = modelMap.get(key) || { model: key, tokens: 0, cost: 0 };
      existing.tokens += r.inputTokens + r.outputTokens;
      existing.cost += r.estimatedCost;
      modelMap.set(key, existing);
    }
    const byModel = Array.from(modelMap.values()).sort((a, b) => b.tokens - a.tokens);

    return NextResponse.json({
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      estimatedCost,
      dailyUsage,
      byAgent,
      byModel,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
