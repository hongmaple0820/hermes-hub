import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const [providerCount, agentCount, conversationCount] = await Promise.all([
      db.lLMProvider.count({ where: { userId: user.id, isActive: true } }),
      db.agent.count({ where: { userId: user.id } }),
      db.conversation.count({
        where: {
          participants: { some: { userId: user.id } },
        },
      }),
    ]);

    // Find the first agent as default agent
    const defaultAgent = await db.agent.findFirst({
      where: { userId: user.id },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    const hasProvider = providerCount > 0;
    const hasAgent = agentCount > 0;
    const hasConversation = conversationCount > 0;
    const isReady = hasProvider && hasAgent;

    return NextResponse.json({
      hasProvider,
      hasAgent,
      hasConversation,
      isReady,
      defaultAgentId: defaultAgent?.id ?? null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Quickstart status error:', error);
    return NextResponse.json(
      { error: 'Failed to get setup status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
