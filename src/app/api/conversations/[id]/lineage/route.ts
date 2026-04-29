/**
 * Conversation Lineage API
 * GET /api/conversations/[id]/lineage - Get the full conversation lineage
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getConversationLineage } from '@/lib/conversation-lineage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);

    const { id } = await params;

    const lineage = await getConversationLineage(id);

    return NextResponse.json({
      current: lineage.current,
      ancestors: lineage.ancestors,
      totalMessages: lineage.totalMessages,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Lineage API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
