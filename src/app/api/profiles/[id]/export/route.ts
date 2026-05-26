import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const profile = await db.profile.findUnique({ where: { id } });
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (profile.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Export: return profile data as JSON for download
    const exportData = {
      name: profile.name,
      description: profile.description,
      path: profile.path,
      model: profile.model,
      providerId: profile.providerId,
      gatewayUrl: profile.gatewayUrl,
      skillCount: profile.skillCount,
      envStatus: JSON.parse(profile.envStatus),
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };

    return NextResponse.json({ export: exportData });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Export profile error:', error);
    return NextResponse.json(
      { error: 'Failed to export profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
