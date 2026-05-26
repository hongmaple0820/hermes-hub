import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateAgentReply } from '@/lib/agent-reply';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const conversation = await db.conversation.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const isParticipant = conversation.participants.some((p) => p.userId === user.id);
    if (!isParticipant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const messages = await db.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { content, type } = body;

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    // Verify conversation and participation
    const conversation = await db.conversation.findUnique({
      where: { id },
      include: { participants: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const isParticipant = conversation.participants.some((p) => p.userId === user.id);
    if (!isParticipant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    // Save user message
    const message = await db.message.create({
      data: {
        conversationId: id,
        content,
        type: type || 'text',
        senderId: user.id,
        senderType: 'user',
        senderName: user.name,
      },
    });

    // Generate agent reply if this is an agent conversation
    let agentReply = null;
    if (conversation.agentId) {
      const result = await generateAgentReply({
        agentId: conversation.agentId,
        conversationId: id,
        userMessage: content,
        userId: user.id,
      });

      if (result.success) {
        agentReply = result.content;
      }
    }

    return NextResponse.json({
      message,
      agentReply: agentReply ? { content: agentReply } : null,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Send message error:', error);
    return NextResponse.json(
      { error: 'Failed to send message', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
