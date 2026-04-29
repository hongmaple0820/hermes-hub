import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

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
      // Note: registrationInfo is on AgentSkill, not Skill — but we may not have it yet
      // Actually, the binding IS the AgentSkill record
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

    const skillRegistrationInfo = JSON.parse(skill.registrationInfo || '{}');
    const skillEvents = JSON.parse(skill.events || '[]');

    return NextResponse.json({
      skill: {
        ...skill,
        agents: agentsWithEndpoints,
        endpointUrl: skillEndpointUrl,
        registrationStatus: skill.callbackUrl ? 'registered' : 'pending',
        registrationInfo: skillRegistrationInfo,
        events: skillEvents,
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

    const updateData: Record<string, unknown> = {};
    const allowedFields = [
      'displayName', 'description', 'category', 'version', 'author',
      'icon', 'configSchema', 'handlerType', 'handlerUrl', 'parameters', 'isEnabled',
      'callbackUrl', 'events',
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (['configSchema', 'parameters', 'events'].includes(field)) {
          updateData[field] = JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await db.skill.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ skill: updated });
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
