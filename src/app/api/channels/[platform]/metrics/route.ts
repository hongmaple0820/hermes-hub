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

    // Verify the channel belongs to the user
    const channel = await db.channel.findUnique({
      where: { platform },
    });

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    if (channel.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Compute real metrics from the database
    // Count total ChatRoomMessages as "messages" metric
    const messageCount = await db.chatRoomMessage.count();

    // Count distinct ChatRoomMembers as "active users" metric
    const activeUsersResult = await db.chatRoomMember.findMany({
      where: { userId: { not: '' } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const activeUsers = activeUsersResult.length;

    // Compute uptime from lastSync if channel is connected
    let uptime = 0;
    if (channel.status === 'connected' && channel.lastSync) {
      uptime = Math.floor((Date.now() - channel.lastSync.getTime()) / 1000);
    }

    // Latency is not measurable from the database, so we return null
    // to indicate it's unavailable
    const metrics = {
      messagesSent: channel.status === 'connected' ? messageCount : 0,
      messagesReceived: channel.status === 'connected' ? messageCount : 0,
      activeUsers: channel.status === 'connected' ? activeUsers : 0,
      latency: null as number | null,
      lastMessageAt: channel.lastSync?.toISOString() || null,
      uptime,
    };

    return NextResponse.json({ metrics });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get channel metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to get channel metrics', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
