import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateAgentReply } from '@/lib/agent-reply';

function safeJsonParse(str: string | null): any {
  if (!str) return {};
  try { return JSON.parse(str); } catch { return str; }
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
      include: {
        agent: { select: { id: true, name: true, avatar: true, status: true, mode: true } },
        participants: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some((p) => p.userId === user.id);
    if (!isParticipant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    return NextResponse.json({ conversation: { ...conversation, lineage: safeJsonParse(conversation.lineage) } });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get conversation error:', error);
    return NextResponse.json({ error: 'Failed to get conversation' }, { status: 500 });
  }
}
