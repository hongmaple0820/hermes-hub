import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getMemoryManager } from '@/lib/agent-memory';

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

    // Organize by section — return both `sections` (detailed) and `memory` (simple content map) for compatibility
    const sections: Record<string, { id: string; content: string; modifiedAt: string }> = {};
    const memory: Record<string, string> = {};
    let totalEntries = 0;

    for (const m of allMemories) {
      sections[m.section] = {
        id: m.id,
        content: m.content,
        modifiedAt: m.modifiedAt.toISOString(),
      };
      memory[m.section] = m.content;
      if (m.content.trim()) {
        totalEntries += m.content.split('\n').filter((l: string) => l.trim()).length;
      }
    }

    return NextResponse.json({ agentId, sections, memory, totalEntries });
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

export async function PUT(request: NextRequest) {
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

    // Use MemoryManager for proper cache invalidation
    const memoryManager = getMemoryManager(agentId);
    const result = await memoryManager.updateMemory(section as 'memory' | 'user' | 'soul', content);

    return NextResponse.json({ memory: result });
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

    // Use MemoryManager for proper cache handling
    const memoryManager = getMemoryManager(agentId);
    const result = await memoryManager.updateMemory(section as 'memory' | 'user' | 'soul', content);

    return NextResponse.json({ memory: result });
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

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const agentId = url.searchParams.get('agentId');
    const section = url.searchParams.get('section');

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

    const memoryManager = getMemoryManager(agentId);

    if (section) {
      // Clear specific section
      const validSections = ['memory', 'user', 'soul'];
      if (!validSections.includes(section)) {
        return NextResponse.json(
          { error: 'Invalid section', details: `Section must be one of: ${validSections.join(', ')}` },
          { status: 400 }
        );
      }
      await memoryManager.clearMemory(section as 'memory' | 'user' | 'soul');
    } else {
      // Clear all sections
      await memoryManager.clearAllMemory();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Clear memory error:', error);
    return NextResponse.json(
      { error: 'Failed to clear memory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
