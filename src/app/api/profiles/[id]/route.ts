import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const profile = await db.profile.findUnique({
      where: { id },
      include: {
        provider: { select: { id: true, name: true, provider: true, defaultModel: true, isActive: true } },
      },
    });

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (profile.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ profile });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get profile error:', error);
    return NextResponse.json(
      { error: 'Failed to get profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const existing = await db.profile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'description', 'path', 'model', 'providerId',
      'gatewayUrl', 'skillCount', 'isActive',
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }

    // Handle JSON field
    if (body.envStatus !== undefined) {
      updateData.envStatus = typeof body.envStatus === 'string' ? body.envStatus : JSON.stringify(body.envStatus);
    }

    // Validate providerId if provided
    if (body.providerId) {
      const provider = await db.lLMProvider.findUnique({ where: { id: body.providerId } });
      if (!provider || provider.userId !== user.id) {
        return NextResponse.json(
          { error: 'Invalid provider', details: 'Provider not found or does not belong to you' },
          { status: 400 }
        );
      }
    }

    const updated = await db.profile.update({
      where: { id },
      data: updateData,
      include: {
        provider: { select: { id: true, name: true, provider: true, defaultModel: true } },
      },
    });

    return NextResponse.json({ profile: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const existing = await db.profile.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.profile.delete({ where: { id } });

    return NextResponse.json({ message: 'Profile deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete profile error:', error);
    return NextResponse.json(
      { error: 'Failed to delete profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
