/**
 * Chat Room Join API
 * POST /api/chat-rooms/join - Join a chat room using a join code
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { joinCode } = body;

    if (!joinCode) {
      return NextResponse.json({ error: 'Join code is required' }, { status: 400 });
    }

    // Find room by join code
    const room = await db.chatRoom.findUnique({
      where: { joinCode },
      include: {
        members: true,
        agents: {
          include: {
            agent: { select: { id: true, name: true, avatar: true, status: true } },
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Invalid join code' }, { status: 404 });
    }

    // Check if already a member
    const existingMembership = await db.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId: room.id, userId: user.id } },
    });

    if (existingMembership) {
      return NextResponse.json({ room, alreadyMember: true });
    }

    // Join the room
    await db.chatRoomMember.create({
      data: {
        roomId: room.id,
        userId: user.id,
        userName: user.name,
        role: 'member',
      },
    });

    return NextResponse.json({ room, joined: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Join chat room error:', error);
    return NextResponse.json({ error: 'Failed to join chat room' }, { status: 500 });
  }
}
