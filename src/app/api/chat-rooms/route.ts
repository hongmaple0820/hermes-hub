import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const rooms = await db.chatRoom.findMany({
      where: {
        OR: [
          { isPublic: true },
          { members: { some: { userId: user.id } } },
        ],
      },
      include: {
        members: true,
        agents: {
          include: {
            agent: { select: { id: true, name: true, avatar: true, status: true } },
          },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ rooms });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List chat rooms error:', error);
    return NextResponse.json({ error: 'Failed to list chat rooms' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, description, isPublic, triggerTokens, maxHistoryTokens, agentIds } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const joinCode = Math.random().toString(36).substring(2, 8).toUpperCase();

    const room = await db.chatRoom.create({
      data: {
        name,
        description: description || null,
        isPublic: isPublic ?? true,
        triggerTokens: triggerTokens || 4000,
        maxHistoryTokens: maxHistoryTokens || 8000,
        joinCode,
        members: {
          create: { userId: user.id, userName: user.name, role: 'admin' },
        },
      },
      include: {
        members: true,
        agents: true,
      },
    });

    // Add agents if specified
    if (agentIds && Array.isArray(agentIds) && agentIds.length > 0) {
      await db.chatRoomAgent.createMany({
        data: agentIds.map((agentId: string) => ({
          roomId: room.id,
          agentId,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ room }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create chat room error:', error);
    return NextResponse.json({ error: 'Failed to create chat room' }, { status: 500 });
  }
}
