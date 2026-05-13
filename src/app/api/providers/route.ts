import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { encrypt, maskApiKey } from '@/lib/crypto';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const providers = await db.lLMProvider.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    // Mask API keys for security
    const masked = providers.map((p) => ({
      ...p,
      apiKey: maskApiKey(p.apiKey),
    }));

    return NextResponse.json({ providers: masked });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List providers error:', error);
    return NextResponse.json(
      { error: 'Failed to list providers', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, provider, apiKey, baseUrl, models, defaultModel, config } = body;

    if (!name || !provider) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'name and provider are required' },
        { status: 400 }
      );
    }

    const validProviders = ['openai', 'anthropic', 'google', 'ollama', 'custom', 'z-ai'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: 'Invalid provider', details: `Provider must be one of: ${validProviders.join(', ')}` },
        { status: 400 }
      );
    }

    const newProvider = await db.lLMProvider.create({
      data: {
        userId: user.id,
        name,
        provider,
        apiKey: apiKey ? encrypt(apiKey) : null,
        baseUrl: baseUrl || null,
        models: JSON.stringify(models || []),
        defaultModel: defaultModel || null,
        config: JSON.stringify(config || {}),
      },
    });

    // Mask API key in response
    const maskedProvider = {
      ...newProvider,
      apiKey: maskApiKey(newProvider.apiKey),
    };

    return NextResponse.json({ provider: maskedProvider }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create provider error:', error);
    return NextResponse.json(
      { error: 'Failed to create provider', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
