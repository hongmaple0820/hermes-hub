import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category') || undefined;
    const handlerType = searchParams.get('handlerType') || undefined;
    const search = searchParams.get('search') || undefined;

    // User's own tools + public tools + system tools (userId=null)
    const where: Record<string, unknown> = {
      OR: [
        { userId: user.id },
        { isPublic: true },
        { userId: null },
      ],
    };

    if (category) {
      where.category = category;
    }
    if (handlerType) {
      where.handlerType = handlerType;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { displayName: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const tools = await db.tool.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ tools });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List tools error:', error);
    return NextResponse.json(
      { error: 'Failed to list tools', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { name, displayName, description, category, parameters, handlerType, handlerConfig, icon, isPublic } = body;

    if (!name || !displayName || !description) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'name, displayName, and description are required' },
        { status: 400 }
      );
    }

    // Validate name format: kebab-case
    const kebabRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
    if (!kebabRegex.test(name)) {
      return NextResponse.json(
        { error: 'Invalid name format', details: 'name must be kebab-case (lowercase letters, numbers, hyphens)' },
        { status: 400 }
      );
    }

    // Check uniqueness
    const existing = await db.tool.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: 'Name already exists', details: `Tool with name '${name}' already exists` },
        { status: 409 }
      );
    }

    const tool = await db.tool.create({
      data: {
        userId: user.id,
        name,
        displayName,
        description,
        category: category || 'general',
        parameters: parameters ? JSON.stringify(parameters) : '{}',
        handlerType: handlerType || 'builtin',
        handlerConfig: handlerConfig ? JSON.stringify(handlerConfig) : '{}',
        icon: icon || null,
        isPublic: isPublic ?? false,
      },
    });

    return NextResponse.json({ tool }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create tool error:', error);
    return NextResponse.json(
      { error: 'Failed to create tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
