import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const status = url.searchParams.get('status');

    const where: Record<string, unknown> = { userId: user.id };
    if (status) {
      where.status = status;
    }

    const jobs = await db.job.findMany({
      where,
      include: {
        agent: { select: { id: true, name: true, avatar: true } },
        provider: { select: { id: true, name: true, provider: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ jobs });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List jobs error:', error);
    return NextResponse.json(
      { error: 'Failed to list jobs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const {
      name, description, prompt, schedule, agentId, skills,
      model, providerId, deliveryTarget, repeatLimit, status,
    } = body;

    if (!name || !prompt || !schedule) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'name, prompt, and schedule are required' },
        { status: 400 }
      );
    }

    // Validate agentId if provided
    if (agentId) {
      const agent = await db.agent.findUnique({ where: { id: agentId } });
      if (!agent || agent.userId !== user.id) {
        return NextResponse.json(
          { error: 'Invalid agent', details: 'Agent not found or does not belong to you' },
          { status: 400 }
        );
      }
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

    const job = await db.job.create({
      data: {
        userId: user.id,
        name,
        description: description || null,
        prompt,
        schedule,
        agentId: agentId || null,
        skills: skills ? JSON.stringify(skills) : '[]',
        model: model || null,
        providerId: providerId || null,
        deliveryTarget: deliveryTarget ? JSON.stringify(deliveryTarget) : '{}',
        repeatLimit: repeatLimit ?? null,
        status: status || 'enabled',
      },
      include: {
        agent: { select: { id: true, name: true, avatar: true } },
        provider: { select: { id: true, name: true, provider: true } },
      },
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create job error:', error);
    return NextResponse.json(
      { error: 'Failed to create job', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
