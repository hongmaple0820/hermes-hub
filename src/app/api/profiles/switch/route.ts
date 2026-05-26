import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { profileId } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'profileId is required' },
        { status: 400 }
      );
    }

    const targetProfile = await db.profile.findUnique({ where: { id: profileId } });
    if (!targetProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (targetProfile.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Set all profiles to isActive=false
    await db.profile.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });

    // Set target profile to isActive=true
    const updated = await db.profile.update({
      where: { id: profileId },
      data: { isActive: true },
      include: {
        provider: { select: { id: true, name: true, provider: true } },
      },
    });

    return NextResponse.json({ profile: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Switch profile error:', error);
    return NextResponse.json(
      { error: 'Failed to switch profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
