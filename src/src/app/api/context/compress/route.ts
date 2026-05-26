/**
 * Context Engine API - Compress Route
 * POST /api/context/compress - Force compress { type, id }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { forceCompress } from '@/lib/context-engine';

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const body = await request.json();
    const { type, id } = body;

    if (!type || !id) {
      return NextResponse.json(
        { error: 'Missing required fields: type and id' },
        { status: 400 }
      );
    }

    if (type !== 'conversation' && type !== 'room') {
      return NextResponse.json(
        { error: 'Invalid type. Must be "conversation" or "room"' },
        { status: 400 }
      );
    }

    const result = await forceCompress(type, id);

    return NextResponse.json({
      snapshotId: result.snapshotId,
      summaryTokenCount: result.summaryTokenCount,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Context API] POST compress error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
