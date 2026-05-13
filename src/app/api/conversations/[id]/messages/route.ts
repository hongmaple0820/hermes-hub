import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateAgentReply, streamAgentReply } from '@/lib/agent-reply';

function safeJsonParse(str: string | null): any {
  if (!str) return {};
  try { return JSON.parse(str); } catch { return str; }
}

// Helper: push notification for agent reply
async function pushAgentReplyNotification(userId: string, agentName: string, conversationId: string) {
  try {
    const dbNotif = await db.notification.create({
      data: {
        userId,
        type: 'new_message',
        title: 'Agent replied',
        message: `${agentName} sent a reply in your conversation.`,
        actionUrl: `/chat`,
      },
    });
    await fetch('http://localhost:3003/internal/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        notification: {
          id: dbNotif.id,
          type: 'new_message',
          title: 'Agent replied',
          message: `${agentName} sent a reply in your conversation.`,
          actionUrl: `/chat`,
          timestamp: dbNotif.createdAt.toISOString(),
        },
      }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    // Silently fail — notifications are non-critical
  }
}

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

    const parsed = messages.map(m => ({
      ...m,
      metadata: safeJsonParse(m.metadata),
    }));

    return NextResponse.json({ messages: parsed });
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

    // Check if the client wants SSE streaming
    const acceptHeader = request.headers.get('accept') || '';
    const wantsSSE = acceptHeader.includes('text/event-stream');

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

    // If this is an agent conversation and the client wants SSE streaming
    if (conversation.agentId && wantsSSE) {
      // Return SSE stream
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const sseGenerator = streamAgentReply({
              agentId: conversation.agentId!,
              conversationId: id,
              userMessage: content,
              userId: user.id,
            });

            for await (const sseEvent of sseGenerator) {
              controller.enqueue(encoder.encode(sseEvent));
            }

            controller.close();
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Default: synchronous response (backward compatibility)
    let agentReply = null;
    if (conversation.agentId) {
      const agent = await db.agent.findUnique({
        where: { id: conversation.agentId },
        select: { name: true },
      });
      const result = await generateAgentReply({
        agentId: conversation.agentId,
        conversationId: id,
        userMessage: content,
        userId: user.id,
      });

      if (result.success) {
        agentReply = result.content;
        // Push notification for agent reply
        if (agent) {
          pushAgentReplyNotification(user.id, agent.name, id);
        }
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
