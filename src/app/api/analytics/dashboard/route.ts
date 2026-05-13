import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Get agents stats
    const agents = await db.agent.findMany({
      where: { userId: user.id },
      select: { id: true, mode: true, status: true, wsConnected: true, createdAt: true },
    });

    // Get conversations stats
    const conversations = await db.conversation.findMany({
      where: {
        participants: { some: { userId: user.id } },
      },
      select: { id: true, createdAt: true, updatedAt: true },
      orderBy: { createdAt: 'desc' },
    });

    // Get messages count
    const messageCount = await db.message.count({
      where: {
        conversation: { participants: { some: { userId: user.id } } },
      },
    });

    // Get providers
    const providers = await db.lLMProvider.findMany({
      where: { userId: user.id },
      select: { id: true, isActive: true, provider: true },
    });

    // Get skills
    const skills = await db.skill.findMany({
      where: { isEnabled: true },
      select: { id: true },
    });

    // Get total invocations from AgentSkill bindings
    const agentSkillInvocations = await db.agentSkill.aggregate({
      _sum: { invokeCount: true },
    });

    // Get chat rooms
    const chatRooms = await db.chatRoom.findMany({
      where: {
        OR: [
          { isPublic: true },
          { members: { some: { userId: user.id } } },
        ],
      },
      select: { id: true },
    });

    // Conversations per day (last 7 days)
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentConversations = conversations.filter(c => new Date(c.createdAt) >= sevenDaysAgo);

    const convsPerDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split('T')[0];
      const count = recentConversations.filter(c => {
        const cDate = new Date(c.createdAt).toISOString().split('T')[0];
        return cDate === dayStr;
      }).length;
      convsPerDay.push({ date: dayStr, count });
    }

    // Messages per day (last 7 days)
    const recentMessages = await db.message.findMany({
      where: {
        conversation: { participants: { some: { userId: user.id } } },
        createdAt: { gte: sevenDaysAgo },
      },
      select: { createdAt: true },
    });

    const messagesPerDay: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStr = day.toISOString().split('T')[0];
      const count = recentMessages.filter(m => {
        const mDate = new Date(m.createdAt).toISOString().split('T')[0];
        return mDate === dayStr;
      }).length;
      messagesPerDay.push({ date: dayStr, count });
    }

    // Total invocations
    const totalInvocations = agentSkillInvocations._sum.invokeCount || 0;

    return NextResponse.json({
      agents: {
        total: agents.length,
        online: agents.filter(a => a.status === 'online').length,
        builtin: agents.filter(a => a.mode === 'builtin').length,
        acrp: agents.filter(a => a.mode === 'acrp').length,
        acrpConnected: agents.filter(a => a.wsConnected).length,
      },
      conversations: {
        total: conversations.length,
        convsPerDay,
      },
      messages: {
        total: messageCount,
        messagesPerDay,
      },
      providers: {
        total: providers.length,
        active: providers.filter(p => p.isActive).length,
      },
      skills: {
        total: skills.length,
        totalInvocations,
      },
      chatRooms: {
        total: chatRooms.length,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Dashboard analytics error:', error);
    return NextResponse.json({ error: 'Failed to get analytics' }, { status: 500 });
  }
}
