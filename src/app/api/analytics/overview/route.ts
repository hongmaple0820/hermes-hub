import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's agent IDs first for related queries
    const userAgents = await db.agent.findMany({
      where: { userId },
      select: { id: true },
    });
    const agentIds = userAgents.map((a) => a.id);

    // Run queries sequentially to avoid SQLite concurrency issues
    const totalAgents = await db.agent.count({ where: { userId } });
    const onlineAgents = await db.agent.count({ where: { userId, status: 'online' } });
    const totalConversations = agentIds.length > 0
      ? await db.conversation.count({ where: { agentId: { in: agentIds } } })
      : 0;
    const totalSkills = await db.skill.count();
    const activeSkills = await db.skill.count({ where: { isEnabled: true } });
    const totalProviders = await db.lLMProvider.count({ where: { userId } });
    const activeProviders = await db.lLMProvider.count({ where: { userId, isActive: true } });

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentMessages = await db.message.count({ where: { createdAt: { gte: twentyFourHoursAgo } } });
    const recentInvocations = agentIds.length > 0
      ? await db.capabilityInvocation.count({
          where: {
            createdAt: { gte: twentyFourHoursAgo },
            agentId: { in: agentIds },
          },
        })
      : 0;

    return NextResponse.json({
      totalAgents,
      onlineAgents,
      totalConversations,
      totalSkills,
      activeSkills,
      totalProviders,
      activeProviders,
      recentActivityCount: recentMessages + recentInvocations,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('[Analytics/Overview] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
