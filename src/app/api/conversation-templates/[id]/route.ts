import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const template = await db.conversationTemplate.findUnique({ where: { id } });

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Allow access if owner or if template is public
    if (template.userId !== user.id && !template.isPublic) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      template: {
        ...template,
        agentIds: template.agentIds ? JSON.parse(template.agentIds) : [],
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get conversation template error:', error);
    return NextResponse.json(
      { error: 'Failed to get template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const existing = await db.conversationTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.icon !== undefined) updateData.icon = body.icon;
    if (body.systemPrompt !== undefined) updateData.systemPrompt = body.systemPrompt;
    if (body.initialMessage !== undefined) updateData.initialMessage = body.initialMessage;
    if (body.agentIds !== undefined) updateData.agentIds = JSON.stringify(body.agentIds);
    if (body.isPublic !== undefined) updateData.isPublic = body.isPublic;

    const updated = await db.conversationTemplate.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      template: {
        ...updated,
        agentIds: updated.agentIds ? JSON.parse(updated.agentIds) : [],
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update conversation template error:', error);
    return NextResponse.json(
      { error: 'Failed to update template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const existing = await db.conversationTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.conversationTemplate.delete({ where: { id } });

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete conversation template error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
