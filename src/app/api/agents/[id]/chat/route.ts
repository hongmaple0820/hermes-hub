import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content) {
      return NextResponse.json({ error: 'content is required' }, { status: 400 });
    }

    const agent = await db.agent.findUnique({
      where: { id },
      include: {
        provider: true,
        skills: { include: { skill: true }, where: { isEnabled: true }, orderBy: { priority: 'asc' } },
      },
    });

    if (!agent || agent.userId !== user.id) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    let conversation = await db.conversation.findFirst({
      where: { agentId: agent.id, type: 'private' },
      include: { participants: true },
    });

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          type: 'private',
          name: `Chat with ${agent.name}`,
          agentId: agent.id,
        },
        include: { participants: true },
      });
    }

    const userParticipant = await db.conversationParticipant.upsert({
      where: { conversationId_userId: { conversationId: conversation.id, userId: user.id } },
      create: { conversationId: conversation.id, userId: user.id },
      update: { lastReadAt: new Date() },
    });

    const userMessage = await db.message.create({
      data: {
        conversationId: conversation.id,
        content,
        type: 'text',
        senderId: user.id,
        senderType: 'user',
        senderName: user.name,
      },
    });

    let reply: string | null = null;

    if (agent.mode === 'builtin' && agent.provider) {
      try {
        const { generateAgentReply } = await import('@/lib/agent-reply');
        const replyResult = await generateAgentReply({
          agentId: agent.id,
          conversationId: conversation.id,
          userMessage: content,
          userId: user.id,
        });
        reply = replyResult.success ? replyResult.content : 'Sorry, I encountered an error processing your request.';
      } catch (replyError) {
        console.error('Agent reply error:', replyError);
        reply = 'Sorry, I encountered an error processing your request. Please check the LLM provider configuration.';
      }
    } else if (agent.mode === 'acrp' && agent.wsConnected) {
      try {
        const { invokeCapability } = await import('@/lib/agent-service');
        const chatCap = await db.agentCapability.findFirst({
          where: { agentId: agent.id, category: 'chat' },
        });
        if (chatCap) {
          const invocationResult = await invokeCapability(agent.id, chatCap.capabilityId, { message: content });
          reply = invocationResult?.result || 'Processing your message via external agent...';
        } else {
          reply = 'External agent is connected but has no chat capability registered.';
        }
      } catch (capError) {
        console.error('ACRP chat error:', capError);
        reply = 'Failed to communicate with the external agent.';
      }
    } else {
      reply = 'Agent is offline or not properly configured.';
    }

    if (reply) {
      await db.message.create({
        data: {
          conversationId: conversation.id,
          content: reply,
          type: 'text',
          senderType: 'agent',
          senderName: agent.name,
        },
      });
    }

    return NextResponse.json({ reply, conversationId: conversation.id });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Agent chat error:', error);
    return NextResponse.json({ error: 'Failed to send chat message' }, { status: 500 });
  }
}