import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

const DEFAULT_CHANNELS = [
  {
    platform: 'telegram',
    name: 'Telegram',
    config: JSON.stringify({ botToken: '', chatId: '' }),
  },
  {
    platform: 'discord',
    name: 'Discord',
    config: JSON.stringify({ botToken: '', guildId: '', channelId: '' }),
  },
  {
    platform: 'slack',
    name: 'Slack',
    config: JSON.stringify({ botToken: '', signingSecret: '', channel: '' }),
  },
  {
    platform: 'whatsapp',
    name: 'WhatsApp',
    config: JSON.stringify({ phoneNumberId: '', accessToken: '', webhookVerifyToken: '' }),
  },
  {
    platform: 'matrix',
    name: 'Matrix',
    config: JSON.stringify({ homeserverUrl: '', accessToken: '', roomId: '' }),
  },
  {
    platform: 'feishu',
    name: 'Feishu (飞书)',
    config: JSON.stringify({ appId: '', appSecret: '', verificationToken: '' }),
  },
  {
    platform: 'wechat',
    name: 'WeChat (微信)',
    config: JSON.stringify({ appId: '', appSecret: '', token: '', encodingAesKey: '' }),
  },
  {
    platform: 'wecom',
    name: 'WeCom (企业微信)',
    config: JSON.stringify({ corpId: '', agentId: '', secret: '', token: '', encodingAesKey: '' }),
  },
];

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    let created = 0;
    let skipped = 0;

    for (const channelData of DEFAULT_CHANNELS) {
      const existing = await db.channel.findUnique({
        where: { platform: channelData.platform },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await db.channel.create({
        data: {
          userId: user.id,
          platform: channelData.platform,
          name: channelData.name,
          config: channelData.config,
          isEnabled: false,
          status: 'disconnected',
        },
      });

      created++;
    }

    return NextResponse.json({
      message: `Channels seeded: ${created} created, ${skipped} already existed`,
      created,
      skipped,
      total: DEFAULT_CHANNELS.length,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Seed channels error:', error);
    return NextResponse.json(
      { error: 'Failed to seed channels', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
