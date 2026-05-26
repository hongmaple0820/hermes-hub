import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const url = new URL(request.url);
    const search = url.searchParams.get('search');

    const where: Record<string, unknown> = {
      OR: [
        { userId: user.id },
        { isPublic: true },
      ],
    };

    // Apply search filter if provided
    if (search) {
      where.OR = [
        { userId: user.id, name: { contains: search } },
        { userId: user.id, description: { contains: search } },
        { isPublic: true, name: { contains: search } },
        { isPublic: true, description: { contains: search } },
      ];
    }

    // Get user's own templates + public templates
    const templates = await db.conversationTemplate.findMany({
      where,
      orderBy: [
        { isPublic: 'asc' },  // User's own templates first
        { createdAt: 'desc' },
      ],
    });

    // Parse JSON fields
    const parsedTemplates = templates.map((t) => ({
      ...t,
      agentIds: t.agentIds ? JSON.parse(t.agentIds) : [],
    }));

    return NextResponse.json({ templates: parsedTemplates });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List conversation templates error:', error);
    return NextResponse.json(
      { error: 'Failed to list templates', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, description, icon, systemPrompt, initialMessage, agentIds, isPublic } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'name is required' },
        { status: 400 }
      );
    }

    const template = await db.conversationTemplate.create({
      data: {
        userId: user.id,
        name,
        description: description || null,
        icon: icon || null,
        systemPrompt: systemPrompt || null,
        initialMessage: initialMessage || null,
        agentIds: agentIds ? JSON.stringify(agentIds) : null,
        isPublic: isPublic ?? false,
      },
    });

    return NextResponse.json({
      template: {
        ...template,
        agentIds: template.agentIds ? JSON.parse(template.agentIds) : [],
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create conversation template error:', error);
    return NextResponse.json(
      { error: 'Failed to create template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
