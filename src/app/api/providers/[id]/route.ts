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

    const provider = await db.lLMProvider.findUnique({
      where: { id },
      include: { agents: true },
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    if (provider.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Mask API key
    const masked = {
      ...provider,
      apiKey: provider.apiKey ? `${provider.apiKey.slice(0, 8)}...${provider.apiKey.slice(-4)}` : null,
    };

    return NextResponse.json({ provider: masked });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get provider error:', error);
    return NextResponse.json(
      { error: 'Failed to get provider', details: error instanceof Error ? error.message : 'Unknown error' },
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

    const existing = await db.lLMProvider.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.provider !== undefined) updateData.provider = body.provider;
    if (body.apiKey !== undefined) updateData.apiKey = body.apiKey;
    if (body.baseUrl !== undefined) updateData.baseUrl = body.baseUrl;
    if (body.models !== undefined) updateData.models = JSON.stringify(body.models);
    if (body.defaultModel !== undefined) updateData.defaultModel = body.defaultModel;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.config !== undefined) updateData.config = JSON.stringify(body.config);

    const updated = await db.lLMProvider.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ provider: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update provider error:', error);
    return NextResponse.json(
      { error: 'Failed to update provider', details: error instanceof Error ? error.message : 'Unknown error' },
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

    const existing = await db.lLMProvider.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.lLMProvider.delete({ where: { id } });

    return NextResponse.json({ message: 'Provider deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete provider error:', error);
    return NextResponse.json(
      { error: 'Failed to delete provider', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
