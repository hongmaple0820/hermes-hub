/**
 * Chat Room Compress API
 * POST /api/chat-rooms/[roomId]/compress - Force compress a chat room's context
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { forceCompress } from '@/lib/context-engine';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    await requireAuth(request);

    const { roomId } = await params;

    const result = await forceCompress('room', roomId);

    return NextResponse.json({
      snapshotId: result.snapshotId,
      summaryTokenCount: result.summaryTokenCount,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Chat Room Compress API] POST error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
