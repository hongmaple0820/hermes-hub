/**
 * Conversation Continue API
 * POST /api/conversations/[id]/continue - Create a new conversation that continues from a previous one
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/api-handler';
import { continueConversation } from '@/lib/conversation-lineage';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const agentId = body.agentId as string | undefined;

    const result = await continueConversation(id, user.id, agentId);

    return NextResponse.json({
      conversationId: result.newConversationId,
      carriedContext: result.carriedContext,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
