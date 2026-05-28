import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

// GET /api/notification-preferences — list all preferences for current user
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const preferences = await db.notificationPreference.findMany({
      where: { userId: user.id },
      orderBy: { type: 'asc' },
    });

    return NextResponse.json({ preferences });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get notification preferences error:', error);
    return NextResponse.json(
      { error: 'Failed to get notification preferences' },
      { status: 500 }
    );
  }
}

// POST /api/notification-preferences — create or update a preference (upsert)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { type, enabled } = body;

    if (!type || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'type and enabled (boolean) are required' },
        { status: 400 }
      );
    }

    const validTypes = ['agent_status', 'run_complete', 'skill_update', 'acrp_event'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const preference = await db.notificationPreference.upsert({
      where: {
        userId_type: { userId: user.id, type },
      },
      update: { enabled },
      create: { userId: user.id, type, enabled },
    });

    return NextResponse.json({ preference });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update notification preference error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preference' },
      { status: 500 }
    );
  }
}
