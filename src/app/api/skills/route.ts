import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');

    const where: Record<string, unknown> = { isEnabled: true };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { displayName: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const skills = await db.skill.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ skills });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List skills error:', error);
    return NextResponse.json(
      { error: 'Failed to list skills', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const {
      name, displayName, description, category, version, author,
      icon, configSchema, handlerType, handlerUrl, parameters, isEnabled,
    } = body;

    if (!name || !displayName || !description || !category) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'name, displayName, description, and category are required' },
        { status: 400 }
      );
    }

    // Check if skill name already exists
    const existing = await db.skill.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: 'Skill already exists', details: `A skill with name "${name}" already exists` },
        { status: 409 }
      );
    }

    const skill = await db.skill.create({
      data: {
        name,
        displayName,
        description,
        category,
        version: version || '1.0.0',
        author: author || user.name,
        icon: icon || null,
        configSchema: JSON.stringify(configSchema || {}),
        handlerType: handlerType || 'builtin',
        handlerUrl: handlerUrl || null,
        parameters: JSON.stringify(parameters || []),
        isEnabled: isEnabled ?? true,
      },
    });

    return NextResponse.json({ skill }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create skill error:', error);
    return NextResponse.json(
      { error: 'Failed to create skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
