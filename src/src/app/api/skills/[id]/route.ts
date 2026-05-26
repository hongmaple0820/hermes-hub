import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

// AgentSkills spec name validation: ^[a-z0-9]+(-[a-z0-9]+)*$
const SKILL_NAME_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function parseSkillJsonFields(skill: Record<string, unknown>) {
  return {
    ...skill,
    metadata: JSON.parse((skill.metadata as string) || '{}'),
    configSchema: JSON.parse((skill.configSchema as string) || '{}'),
    parameters: JSON.parse((skill.parameters as string) || '[]'),
    events: JSON.parse((skill.events as string) || '[]'),
    registrationInfo: JSON.parse((skill.registrationInfo as string) || '{}'),
    allowedTools: skill.allowedTools ? (skill.allowedTools as string).split(' ').filter(Boolean) : [],
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const skill = await db.skill.findUnique({
      where: { id },
      include: {
        agents: {
          include: {
            agent: { select: { id: true, name: true, avatar: true, status: true } },
          },
        },
      },
    });

    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Enhance each agent binding with endpoint URL and registration status
    const agentsWithEndpoints = skill.agents.map((binding) => {
      const registrationInfo = JSON.parse(binding.registrationInfo || '{}');
      return {
        ...binding,
        endpointUrl: binding.endpointToken
          ? `/api/skill-protocol/events?token=${binding.endpointToken}`
          : null,
        registrationStatus: binding.callbackUrl ? 'registered' : 'pending',
        registrationInfo,
        invokeCount: binding.invokeCount,
        lastInvokedAt: binding.lastInvokedAt,
      };
    });

    // Also include the skill-level endpoint and registration info
    const skillEndpointUrl = skill.endpointToken
      ? `/api/skill-protocol/events?token=${skill.endpointToken}`
      : null;

    const parsedSkill = parseSkillJsonFields(skill as unknown as Record<string, unknown>);

    return NextResponse.json({
      skill: {
        ...parsedSkill,
        agents: agentsWithEndpoints,
        endpointUrl: skillEndpointUrl,
        registrationStatus: skill.callbackUrl ? 'registered' : 'pending',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get skill error:', error);
    return NextResponse.json(
      { error: 'Failed to get skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const existing = await db.skill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // If name is being updated, validate it matches AgentSkills spec
    if (body.name !== undefined && !SKILL_NAME_REGEX.test(body.name)) {
      return NextResponse.json(
        {
          error: 'Invalid skill name',
          details: 'Name must match ^[a-z0-9]+(-[a-z0-9]+)*$ (lowercase alphanumeric with hyphens, no leading/trailing/consecutive hyphens)',
        },
        { status: 400 }
      );
    }

    if (body.description !== undefined && body.description.length > 1024) {
      return NextResponse.json(
        { error: 'Description too long', details: 'Description must be 1-1024 characters' },
        { status: 400 }
      );
    }

    if (body.compatibility !== undefined && body.compatibility.length > 500) {
      return NextResponse.json(
        { error: 'Compatibility too long', details: 'Compatibility must be max 500 characters' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'name', 'displayName', 'description', 'category',
      'license', 'compatibility', 'instructions',
      'icon', 'handlerType', 'handlerUrl', 'isEnabled',
      'callbackUrl', 'allowedTools', 'sourceType', 'sourceUrl', 'sourcePath',
    ];
    const jsonFields = ['metadata', 'configSchema', 'parameters', 'events', 'registrationInfo'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // allowedTools can be a string or an array
        if (field === 'allowedTools' && Array.isArray(body[field])) {
          updateData[field] = body[field].join(' ');
        } else {
          updateData[field] = body[field];
        }
      }
    }

    for (const field of jsonFields) {
      if (body[field] !== undefined) {
        updateData[field] = JSON.stringify(body[field]);
      }
    }

    const updated = await db.skill.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      skill: parseSkillJsonFields(updated as unknown as Record<string, unknown>),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update skill error:', error);
    return NextResponse.json(
      { error: 'Failed to update skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;

    const existing = await db.skill.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    await db.skill.delete({ where: { id } });

    return NextResponse.json({ message: 'Skill deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete skill error:', error);
    return NextResponse.json(
      { error: 'Failed to delete skill', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
