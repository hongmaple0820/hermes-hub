import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

function safeJsonParse(str: string | null): any {
  if (!str) return {};
  try { return JSON.parse(str); } catch { return str; }
}

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

    const parsed = agents.map(a => ({
      ...a,
      agentMetadata: safeJsonParse(a.agentMetadata),
    }));

    return NextResponse.json({ agents: parsed });
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
      agentType, agentVersion,
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
        agentType: agentType || null,
        agentVersion: agentVersion || null,
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
      await Promise.all(skillIds.map((skillId: string, index: number) =>
        db.agentSkill.create({
          data: {
            agentId: agent.id,
            skillId,
            priority: index,
            endpointToken: `sk_ep_${randomUUID()}`,
            callbackSecret: `cs_${randomUUID()}`,
          },
        })
      ));
    }

    if (skillIds && Array.isArray(skillIds) && skillIds.length > 0) {
      const refreshedAgent = await db.agent.findUnique({
        where: { id: agent.id },
        include: {
          provider: { select: { id: true, name: true, provider: true, defaultModel: true } },
          skills: { include: { skill: true }, orderBy: { priority: 'asc' } },
          connections: true,
          plugins: true,
        },
      });
      return NextResponse.json({ agent: refreshedAgent }, { status: 201 });
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
