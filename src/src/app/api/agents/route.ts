import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const agents = await db.agent.findMany({
      where: { userId: user.id },
      include: {
        provider: {
          select: { id: true, name: true, provider: true, defaultModel: true, isActive: true },
        },
        skills: {
          include: { skill: true },
          orderBy: { priority: 'asc' },
        },
        connections: true,
        plugins: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ agents });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List agents error:', error);
    return NextResponse.json(
      { error: 'Failed to list agents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const {
      name, description, avatar, systemPrompt, mode, isPublic,
      providerId, model, temperature, maxTokens,
      callbackUrl, apiKey,
      skillIds,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'name is required' },
        { status: 400 }
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

    const agent = await db.agent.create({
      data: {
        userId: user.id,
        name,
        description: description || null,
        avatar: avatar || null,
        systemPrompt: systemPrompt || null,
        mode: mode || 'builtin',
        isPublic: isPublic ?? false,
        status: 'offline',
        providerId: providerId || null,
        model: model || null,
        temperature: temperature ?? null,
        maxTokens: maxTokens ?? null,
        callbackUrl: callbackUrl || null,
        apiKey: apiKey || null,
      },
      include: {
        provider: { select: { id: true, name: true, provider: true, defaultModel: true } },
        skills: { include: { skill: true } },
        connections: true,
        plugins: true,
      },
    });

    // Install skills if provided
    if (skillIds && Array.isArray(skillIds) && skillIds.length > 0) {
      await db.agentSkill.createMany({
        data: skillIds.map((skillId: string, index: number) => ({
          agentId: agent.id,
          skillId,
          priority: index,
        })),
        skipDuplicates: true,
      });
    }

    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create agent error:', error);
    return NextResponse.json(
      { error: 'Failed to create agent', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
