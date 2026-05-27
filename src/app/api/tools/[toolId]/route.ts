import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { toolId } = await params;

    const tool = await db.tool.findUnique({ where: { id: toolId } });

    if (!tool) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    // Must be owner, public, or system tool
    if (tool.userId !== user.id && !tool.isPublic && tool.userId !== null) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    return NextResponse.json({ tool });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get tool error:', error);
    return NextResponse.json(
      { error: 'Failed to get tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { toolId } = await params;
    const body = await request.json();

    const existing = await db.tool.findUnique({ where: { id: toolId } });
    if (!existing) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    // Ownership check: only the creator can update
    if (existing.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'You can only update tools you created' },
        { status: 403 }
      );
    }

    const { displayName, description, category, parameters, handlerType, handlerConfig, icon, isPublic } = body;

    const tool = await db.tool.update({
      where: { id: toolId },
      data: {
        ...(displayName !== undefined ? { displayName } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(parameters !== undefined ? { parameters: JSON.stringify(parameters) } : {}),
        ...(handlerType !== undefined ? { handlerType } : {}),
        ...(handlerConfig !== undefined ? { handlerConfig: JSON.stringify(handlerConfig) } : {}),
        ...(icon !== undefined ? { icon } : {}),
        ...(isPublic !== undefined ? { isPublic } : {}),
      },
    });

    return NextResponse.json({ tool });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update tool error:', error);
    return NextResponse.json(
      { error: 'Failed to update tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ toolId: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { toolId } = await params;

    const existing = await db.tool.findUnique({ where: { id: toolId } });
    if (!existing) {
      return NextResponse.json({ error: 'Tool not found' }, { status: 404 });
    }

    // Cannot delete system tools
    if (existing.userId === null) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'Cannot delete system tools' },
        { status: 403 }
      );
    }

    // Ownership check
    if (existing.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden', details: 'You can only delete tools you created' },
        { status: 403 }
      );
    }

    await db.tool.delete({ where: { id: toolId } });

    return NextResponse.json({ data: { id: toolId, deleted: true } });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete tool error:', error);
    return NextResponse.json(
      { error: 'Failed to delete tool', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
