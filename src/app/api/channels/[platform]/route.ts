import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { platform } = await params;

    const channel = await db.channel.findUnique({
      where: { platform },
    });

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    if (channel.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ channel });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get channel error:', error);
    return NextResponse.json(
      { error: 'Failed to get channel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { platform } = await params;
    const body = await request.json();

    const existing = await db.channel.findUnique({ where: { platform } });
    if (!existing) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['name', 'isEnabled', 'status'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    // Handle config as JSON string
    if (body.config !== undefined) {
      updateData.config = typeof body.config === 'string' ? body.config : JSON.stringify(body.config);
    }

    // Update lastSync when status changes to connected
    if (body.status === 'connected') {
      updateData.lastSync = new Date();
    }

    const updated = await db.channel.update({
      where: { platform },
      data: updateData,
    });

    return NextResponse.json({ channel: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update channel error:', error);
    return NextResponse.json(
      { error: 'Failed to update channel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
