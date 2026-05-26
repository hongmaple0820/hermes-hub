/**
 * Context Engine API - Main Route
 * GET /api/context?type=conversation|room&id=xxx - Get current context with compression info
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  getConversationContext,
  getRoomContext,
  getContextStats,
} from '@/lib/context-engine';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const url = new URL(request.url);
    const type = url.searchParams.get('type') as 'conversation' | 'room' | null;
    const id = url.searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Missing required parameters: type and id' },
        { status: 400 }
      );
    }

    if (type !== 'conversation' && type !== 'room') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "conversation" or "room"' },
        { status: 400 }
      );
    }

    // Get context stats and compressed context
    const [stats, contextResult] = await Promise.all([
      getContextStats(type, id),
      type === 'conversation'
        ? getConversationContext(id)
        : getRoomContext(id),
    ]);

    return NextResponse.json({
      context: contextResult.context,
      wasCompressed: contextResult.wasCompressed,
      snapshotId: contextResult.snapshotId,
      tokenCount: contextResult.tokenCount,
      stats,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Context API] GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
