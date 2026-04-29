import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

const DEFAULT_SECTIONS = ['memory', 'user', 'soul'] as const;

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'agentId query parameter is required' },
        { status: 400 }
      );
    }

    // Verify agent belongs to user
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all sections for this agent
    const memories = await db.agentMemory.findMany({
      where: { agentId },
    });

    // Create default sections if they don't exist
    const existingSections = new Set(memories.map((m) => m.section));
    const missingSections = DEFAULT_SECTIONS.filter((s) => !existingSections.has(s));

    if (missingSections.length > 0) {
      await db.agentMemory.createMany({
        data: missingSections.map((section) => ({
          agentId,
          section,
          content: '',
          modifiedAt: new Date(),
        })),
        skipDuplicates: true,
      });
    }

    // Fetch again if we created new sections
    const allMemories = missingSections.length > 0
      ? await db.agentMemory.findMany({ where: { agentId } })
      : memories;

    // Organize by section
    const sections: Record<string, { id: string; content: string; modifiedAt: string }> = {};
    for (const m of allMemories) {
      sections[m.section] = {
        id: m.id,
        content: m.content,
        modifiedAt: m.modifiedAt.toISOString(),
      };
    }

    return NextResponse.json({ agentId, sections });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get memory error:', error);
    return NextResponse.json(
      { error: 'Failed to get memory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { agentId, section, content } = body;

    if (!agentId || !section || content === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'agentId, section, and content are required' },
        { status: 400 }
      );
    }

    const validSections = ['memory', 'user', 'soul'];
    if (!validSections.includes(section)) {
      return NextResponse.json(
        { error: 'Invalid section', details: `Section must be one of: ${validSections.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify agent belongs to user
    const agent = await db.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Upsert the memory section
    const memory = await db.agentMemory.upsert({
      where: {
        agentId_section: { agentId, section },
      },
      update: {
        content,
        modifiedAt: new Date(),
      },
      create: {
        agentId,
        section,
        content,
        modifiedAt: new Date(),
      },
    });

    return NextResponse.json({ memory });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update memory error:', error);
    return NextResponse.json(
      { error: 'Failed to update memory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
