/**
 * Chat Room Messages API
 * GET  /api/chat-rooms/[roomId]/messages - List messages for a room (cursor-based pagination)
 * POST /api/chat-rooms/[roomId]/messages - Send a message to a room
 */

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

    // Verify room exists
    const room = await db.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verify user is a member
    const membership = await db.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
    }

    // Parse pagination params
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 100);
    const before = searchParams.get('before'); // cursor: message ID

    // Build query
    const where: any = { roomId };
    if (before) {
      // Cursor-based: get messages created before the cursor message
      const cursorMessage = await db.chatRoomMessage.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (cursorMessage) {
        where.createdAt = { lt: cursorMessage.createdAt };
      }
    }

    const messages = await db.chatRoomMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // Return in chronological order (oldest first)
    const sortedMessages = messages.reverse();

    return NextResponse.json({ messages: sortedMessages });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get chat room messages error:', error);
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { roomId } = await params;

    // Verify room exists
    const room = await db.chatRoom.findUnique({
      where: { id: roomId },
    });

    if (!room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Verify user is a member
    const membership = await db.chatRoomMember.findUnique({
      where: { roomId_userId: { roomId, userId: user.id } },
    });

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this room' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { content, type } = body;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Create message with sender info
    const message = await db.chatRoomMessage.create({
      data: {
        roomId,
        content: content.trim(),
        type: type || 'text',
        senderInfo: JSON.stringify({
          id: user.id,
          name: user.name,
          type: 'user',
          avatar: user.avatar || null,
        }),
      },
    });

    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Send chat room message error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
