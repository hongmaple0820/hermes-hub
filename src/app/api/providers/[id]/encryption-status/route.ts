import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { maskApiKey } from '@/lib/crypto';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const provider = await db.lLMProvider.findUnique({
      where: { id },
      select: { id: true, userId: true, apiKey: true },
    });

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    if (provider.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Encrypted format: `iv:tag:encrypted` — contains colons
    const encrypted = provider.apiKey ? provider.apiKey.includes(':') : false;
    const maskedKey = maskApiKey(provider.apiKey);

    return NextResponse.json({ encrypted, maskedKey });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Encryption status error:', error);
    return NextResponse.json(
      { error: 'Failed to check encryption status', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
