import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { agentService } from '@/lib/agent-service';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { name, description, systemPrompt, providerId, model, temperature, maxTokens } = body;

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (providerId) {
      const provider = await db.lLMProvider.findUnique({ where: { id: providerId } });
      if (!provider || provider.userId !== user.id) {
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
      }
    }

    const agent = await db.agent.create({
      data: {
        userId: user.id,
        name,
        description: description || null,
        systemPrompt: systemPrompt || null,
        mode: 'builtin',
        isPublic: false,
        status: 'offline',
        agentCategory: 'assistant',
        providerId: providerId || null,
        model: model || null,
        temperature: temperature ?? null,
        maxTokens: maxTokens ?? null,
      },
      include: {
        provider: { select: { id: true, name: true, provider: true, defaultModel: true } },
        skills: { include: { skill: true }, orderBy: { priority: 'asc' } },
      },
    });

    return NextResponse.json({ agent });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create builtin assistant error:', error);
    return NextResponse.json({ error: 'Failed to create assistant' }, { status: 500 });
  }
}