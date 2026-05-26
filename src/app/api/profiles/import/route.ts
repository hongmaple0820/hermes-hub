import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { name, description, path, model, providerId, gatewayUrl, skillCount, envStatus } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'name is required' },
        { status: 400 }
      );
    }

    // Check unique name per user
    const existing = await db.profile.findUnique({
      where: { userId_name: { userId: user.id, name } },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Profile already exists', details: `Profile with name '${name}' already exists` },
        { status: 409 }
      );
    }

    // Validate providerId if provided
    if (providerId) {
      const provider = await db.lLMProvider.findUnique({ where: { id: providerId } });
      if (!provider || provider.userId !== user.id) {
        return NextResponse.json(
          { error: 'Invalid provider', details: 'Provider not found or does not belong to you' },
          { status: 400 }
        );
      }
    }

    const profile = await db.profile.create({
      data: {
        userId: user.id,
        name,
        description: description || null,
        path: path || null,
        model: model || null,
        providerId: providerId || null,
        gatewayUrl: gatewayUrl || null,
        skillCount: skillCount ?? 0,
        envStatus: envStatus ? (typeof envStatus === 'string' ? envStatus : JSON.stringify(envStatus)) : '{}',
        isActive: false,
      },
      include: {
        provider: { select: { id: true, name: true, provider: true } },
      },
    });

    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Import profile error:', error);
    return NextResponse.json(
      { error: 'Failed to import profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
