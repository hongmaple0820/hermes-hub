import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword');

    if (!keyword || keyword.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'keyword query parameter is required' },
        { status: 400 }
      );
    }

    const trimmedKeyword = keyword.trim();

    // Search conversations by keyword in messages
    const messages = await db.message.findMany({
      where: {
        content: { contains: trimmedKeyword },
        conversation: {
          participants: {
            some: { userId: user.id },
          },
        },
      },
      include: {
        conversation: {
          select: {
            id: true,
            type: true,
            name: true,
            createdAt: true,
            updatedAt: true,
            agent: { select: { id: true, name: true, avatar: true } },
            participants: {
              include: {
                user: { select: { id: true, name: true, avatar: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Group by conversation
    const conversationMap = new Map<string, {
      conversation: NonNullable<typeof messages[0]['conversation']>;
      matches: Array<{ messageId: string; content: string; createdAt: Date; senderType: string; senderName: string | null }>;
    }>();

    for (const msg of messages) {
      if (!msg.conversation) continue;
      const convId = msg.conversation.id;
      if (!conversationMap.has(convId)) {
        conversationMap.set(convId, {
          conversation: msg.conversation,
          matches: [],
        });
      }
      conversationMap.get(convId)!.matches.push({
        messageId: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
        senderType: msg.senderType,
        senderName: msg.senderName,
      });
    }

    const results = Array.from(conversationMap.values());

    return NextResponse.json({
      keyword: trimmedKeyword,
      results,
      totalConversations: results.length,
      totalMatches: messages.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Search sessions error:', error);
    return NextResponse.json(
      { error: 'Failed to search sessions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
