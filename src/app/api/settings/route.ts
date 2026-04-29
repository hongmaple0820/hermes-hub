import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const settings = await db.appSettings.findMany({
      where: { userId: user.id },
      orderBy: [{ section: 'asc' }, { key: 'asc' }],
    });

    // Group by section
    const grouped: Record<string, Record<string, unknown>> = {};
    for (const s of settings) {
      if (!grouped[s.section]) {
        grouped[s.section] = {};
      }
      try {
        grouped[s.section][s.key] = JSON.parse(s.value);
      } catch {
        grouped[s.section][s.key] = s.value;
      }
    }

    return NextResponse.json({ settings: grouped });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get settings error:', error);
    return NextResponse.json(
      { error: 'Failed to get settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { section, key, value } = body;

    if (!section || !key || value === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'section, key, and value are required' },
        { status: 400 }
      );
    }

    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

    const setting = await db.appSettings.upsert({
      where: {
        userId_section_key: { userId: user.id, section, key },
      },
      update: {
        value: valueStr,
      },
      create: {
        userId: user.id,
        section,
        key,
        value: valueStr,
      },
    });

    return NextResponse.json({ setting });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update settings error:', error);
    return NextResponse.json(
      { error: 'Failed to update settings', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
