import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');

    const agent = await db.agent.findUnique({ where: { id } });
    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const recentMessages = await db.message.findMany({
      where: { conversation: { agentId: agent.id } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, content: true, type: true, senderType: true, senderName: true, createdAt: true, metadata: true },
    });

    const recentInvocations = await db.capabilityInvocation.findMany({
      where: { agentId: agent.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const activities = [
      ...recentMessages.map(m => ({
        id: m.id,
        type: 'message',
        content: m.content.substring(0, 200),
        senderType: m.senderType,
        senderName: m.senderName,
        messageType: m.type,
        createdAt: m.createdAt.toISOString(),
      })),
      ...recentInvocations.map(i => ({
        id: i.id,
        type: 'capability_invocation',
        capabilityId: i.capabilityId,
        status: i.status,
        duration: i.duration,
        error: i.error,
        createdAt: i.createdAt.toISOString(),
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit);

    return NextResponse.json({ activities });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get activities error:', error);
    return NextResponse.json({ error: 'Failed to get activities' }, { status: 500 });
  }
}