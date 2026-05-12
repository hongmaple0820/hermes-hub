import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { roomId } = await params;

    const room = await db.chatRoom.findUnique({
      where: { id: roomId },
      include: {
        members: true,
        agents: {
          include: {
            agent: { select: { id: true, name: true, avatar: true, status: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    return NextResponse.json({ room });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get chat room error:', error);
    return NextResponse.json({ error: 'Failed to get chat room' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { roomId } = await params;

    const membership = await db.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
    });

    if (!membership || membership.role !== 'admin') {
      return NextResponse.json({ error: 'Only admin can delete room' }, { status: 403 });
    }

    await db.chatRoom.delete({ where: { id: roomId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete chat room error:', error);
    return NextResponse.json({ error: 'Failed to delete chat room' }, { status: 500 });
  }
}
