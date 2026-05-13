import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

// AgentSkills spec name validation: ^[a-z0-9]+(-[a-z0-9]+)*$
const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const sourceType = url.searchParams.get('sourceType');

    const where: Record<string, unknown> = { isEnabled: true };
    if (category) where.category = category;
    if (sourceType) where.sourceType = sourceType;
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

    // Parse JSON fields for each skill to return structured data
    const parsedSkills = skills.map((skill) => ({
      ...skill,
      metadata: JSON.parse(skill.metadata || '{}'),
      configSchema: JSON.parse(skill.configSchema || '{}'),
      parameters: JSON.parse(skill.parameters || '[]'),
      events: JSON.parse(skill.events || '[]'),
      registrationInfo: JSON.parse(skill.registrationInfo || '{}'),
      allowedTools: skill.allowedTools ? skill.allowedTools.split(' ').filter(Boolean) : [],
    }));

    return NextResponse.json({ skills: parsedSkills });
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
      name, displayName, description, category,
      license, compatibility, metadata, allowedTools, instructions,
      icon, configSchema, handlerType, handlerUrl, parameters, isEnabled,
      sourceType, sourceUrl, sourcePath,
    } = body;

    if (!name || !displayName || !description) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'name, displayName, and description are required' },
        { status: 400 }
      );
    }

    // Validate name matches AgentSkills spec: ^[a-z0-9]+(-[a-z0-9]+)*$
    if (!SKILL_NAME_REGEX.test(name)) {
      return NextResponse.json(
        {
          error: 'Invalid skill name',
          details: 'Name must match ^[a-z0-9]+(-[a-z0-9]+)*$ (lowercase alphanumeric with hyphens, no leading/trailing/consecutive hyphens, 1-64 chars)',
        },
        { status: 400 }
      );
    }

    if (name.length > 64) {
      return NextResponse.json(
        { error: 'Skill name too long', details: 'Name must be 1-64 characters' },
        { status: 400 }
      );
    }

    if (description.length > 1024) {
      return NextResponse.json(
        { error: 'Description too long', details: 'Description must be 1-1024 characters' },
        { status: 400 }
      );
    }

    if (compatibility && compatibility.length > 500) {
      return NextResponse.json(
        { error: 'Compatibility too long', details: 'Compatibility must be max 500 characters' },
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
        category: category || 'general',
        license: license || null,
        compatibility: compatibility || null,
        metadata: JSON.stringify(metadata || { author: user.name, version: '1.0' }),
        allowedTools: allowedTools || null,
        instructions: instructions || '',
        icon: icon || null,
        configSchema: JSON.stringify(configSchema || {}),
        handlerType: handlerType || 'builtin',
        handlerUrl: handlerUrl || null,
        parameters: JSON.stringify(parameters || []),
        isEnabled: isEnabled ?? true,
        sourceType: sourceType || 'custom',
        sourceUrl: sourceUrl || null,
        sourcePath: sourcePath || null,
      },
    });

    return NextResponse.json({
      skill: {
        ...skill,
        metadata: JSON.parse(skill.metadata || '{}'),
        configSchema: JSON.parse(skill.configSchema || '{}'),
        parameters: JSON.parse(skill.parameters || '[]'),
        events: JSON.parse(skill.events || '[]'),
        registrationInfo: JSON.parse(skill.registrationInfo || '{}'),
        allowedTools: skill.allowedTools ? skill.allowedTools.split(' ').filter(Boolean) : [],
      },
    }, { status: 201 });
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
