/**
 * Context Engine API - Type/ID Specific Route
 * GET /api/context/[type]/[id] - Get context details for a specific conversation/room
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getContextStats } from '@/lib/context-engine';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  try {
    await requireAuth(request);

    const { type, id } = await params;

    if (type !== 'conversation' && type !== 'room') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "conversation" or "room"' },
        { status: 400 }
      );
    }

    const stats = await getContextStats(type as 'conversation' | 'room', id);

    // Get room config if it's a room
    let compressionConfig = null;
    if (type === 'room') {
      const { db } = await import('@/lib/db');
      const room = await db.chatRoom.findUnique({
        where: { id },
        select: { triggerTokens: true, maxHistoryTokens: true },
      });
      if (room) {
        compressionConfig = {
          triggerTokens: room.triggerTokens,
          maxHistoryTokens: room.maxHistoryTokens,
          tailMessageCount: 20,
        };
      }
    }

    return NextResponse.json({
      type,
      id,
      ...stats,
      compressionConfig: compressionConfig || {
        triggerTokens: 100000,
        maxHistoryTokens: 32000,
        tailMessageCount: 20,
      },
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Context API] GET type/id error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
