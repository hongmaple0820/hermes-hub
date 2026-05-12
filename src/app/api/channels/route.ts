import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const channels = await db.channel.findMany({
      where: { userId: user.id },
      orderBy: { platform: 'asc' },
    });

    return NextResponse.json({ channels });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List channels error:', error);
    return NextResponse.json(
      { error: 'Failed to list channels', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { platform, name, config, isEnabled, status } = body;

    if (!platform || !name) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'platform and name are required' },
        { status: 400 }
      );
    }

    const validPlatforms = ['telegram', 'discord', 'slack', 'whatsapp', 'matrix', 'feishu', 'wechat', 'wecom'];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { error: 'Invalid platform', details: `Platform must be one of: ${validPlatforms.join(', ')}` },
        { status: 400 }
      );
    }

    const existing = await db.channel.findUnique({ where: { platform } });
    if (existing) {
      return NextResponse.json(
        { error: 'Channel already exists', details: `Channel for platform '${platform}' already exists` },
        { status: 409 }
      );
    }

    const channel = await db.channel.create({
      data: {
        userId: user.id,
        platform,
        name,
        config: config ? JSON.stringify(config) : '{}',
        isEnabled: isEnabled ?? false,
        status: status || 'disconnected',
      },
    });

    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create channel error:', error);
    return NextResponse.json(
      { error: 'Failed to create channel', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
