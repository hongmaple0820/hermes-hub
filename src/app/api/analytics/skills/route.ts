import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all invocations for user's agents
    const agents = await db.agent.findMany({
      where: { userId },
      select: { id: true },
    });
    const agentIds = agents.map((a) => a.id);

    if (agentIds.length === 0) {
      return NextResponse.json({
        totalInvocations: 0,
        invocationsBySkill: [],
        invocationsByStatus: { success: 0, failed: 0, timeout: 0, pending: 0, sent: 0, executing: 0 },
        recentInvocations: [],
        topSkills: [],
      });
    }

    // Total invocations count
    const totalInvocations = await db.capabilityInvocation.count({
      where: { agentId: { in: agentIds } },
    });

    // Invocations by capability (grouped)
    const invocationsByCapabilityRaw = await db.capabilityInvocation.groupBy({
      by: ['capabilityId'],
      where: { agentId: { in: agentIds } },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    });

    // Get capability names
    const capabilityIds = invocationsByCapabilityRaw.map((r) => r.capabilityId);
    const capabilities = await db.agentCapability.findMany({
      where: { capabilityId: { in: capabilityIds } },
      select: { capabilityId: true, name: true },
    });
    const capNameMap = new Map(capabilities.map((c) => [c.capabilityId, c.name]));

    const invocationsBySkill = invocationsByCapabilityRaw.map((r) => ({
      capabilityId: r.capabilityId,
      name: capNameMap.get(r.capabilityId) || r.capabilityId,
      count: r._count.id,
    }));

    // Invocations by status
    const statusGroups = await db.capabilityInvocation.groupBy({
      by: ['status'],
      where: { agentId: { in: agentIds } },
      _count: { id: true },
    });

    const invocationsByStatus: Record<string, number> = {
      success: 0,
      failed: 0,
      timeout: 0,
      pending: 0,
      sent: 0,
      executing: 0,
    };
    for (const g of statusGroups) {
      invocationsByStatus[g.status] = g._count.id;
    }

    // Recent invocations (last 10)
    const recentInvocations = await db.capabilityInvocation.findMany({
      where: { agentId: { in: agentIds } },
      include: {
        capability: {
          select: { name: true, capabilityId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Top performing skills (by success rate, minimum 1 invocation)
    const topSkillsRaw = await db.capabilityInvocation.groupBy({
      by: ['capabilityId'],
      where: { agentId: { in: agentIds } },
      _count: { id: true },
    });

    const successCounts = await db.capabilityInvocation.groupBy({
      by: ['capabilityId'],
      where: { agentId: { in: agentIds }, status: 'success' },
      _count: { id: true },
    });

    const successMap = new Map(successCounts.map((s) => [s.capabilityId, s._count.id]));

    const topSkills = topSkillsRaw
      .map((r) => ({
        capabilityId: r.capabilityId,
        name: capNameMap.get(r.capabilityId) || r.capabilityId,
        total: r._count.id,
        successCount: successMap.get(r.capabilityId) || 0,
        successRate: r._count.id > 0 ? ((successMap.get(r.capabilityId) || 0) / r._count.id) * 100 : 0,
      }))
      .filter((s) => s.total > 0)
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    return NextResponse.json({
      totalInvocations,
      invocationsBySkill,
      invocationsByStatus,
      recentInvocations: recentInvocations.map((inv) => ({
        id: inv.id,
        capabilityId: inv.capabilityId,
        capabilityName: inv.capability?.name || inv.capabilityId,
        status: inv.status,
        duration: inv.duration,
        error: inv.error,
        createdAt: inv.createdAt,
        completedAt: inv.completedAt,
      })),
      topSkills,
    });
  } catch (error: any) {
    console.error('[Analytics/Skills] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
