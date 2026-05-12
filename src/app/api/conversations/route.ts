import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const participations = await db.conversationParticipant.findMany({
      where: { userId: user.id },
      include: {
        conversation: {
          include: {
            agent: { select: { id: true, name: true, avatar: true, status: true } },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    const conversations = participations.map((p) => ({
      ...p.conversation,
      lastMessage: p.conversation.messages[0] || null,
      unreadCount: 0,
    }));

    return NextResponse.json({ conversations });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List conversations error:', error);
    return NextResponse.json(
      { error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { agentId, type, name } = body;

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      );
    }

    // Check if agent exists
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Check if conversation already exists
    const existing = await db.conversation.findFirst({
      where: {
        agentId,
        type: 'private',
        participants: { some: { userId: user.id } },
      },
    });

    if (existing) {
      return NextResponse.json({ conversation: existing });
    }

    // Create new conversation
    const conversation = await db.conversation.create({
      data: {
        type: type || 'private',
        name: name || null,
        agentId,
        participants: {
          create: { userId: user.id },
        },
      },
      include: {
        agent: { select: { id: true, name: true, avatar: true, status: true } },
        participants: true,
      },
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create conversation error:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
