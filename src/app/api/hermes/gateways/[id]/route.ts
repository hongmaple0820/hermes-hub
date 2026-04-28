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

    const gateway = await db.hermesGateway.findUnique({ where: { id } });
    if (!gateway) {
      return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });
    }
    if (gateway.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ gateway });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get gateway error:', error);
    return NextResponse.json(
      { error: 'Failed to get gateway', details: error instanceof Error ? error.message : 'Unknown error' },
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

    const existing = await db.hermesGateway.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    const allowedFields = ['name', 'host', 'port', 'profilePath', 'config', 'status', 'pid'];
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'config') {
          updateData[field] = JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await db.hermesGateway.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ gateway: updated });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update gateway error:', error);
    return NextResponse.json(
      { error: 'Failed to update gateway', details: error instanceof Error ? error.message : 'Unknown error' },
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

    const existing = await db.hermesGateway.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Gateway not found' }, { status: 404 });
    }
    if (existing.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (existing.status === 'running') {
      return NextResponse.json(
        { error: 'Cannot delete running gateway', details: 'Stop the gateway before deleting' },
        { status: 400 }
      );
    }

    await db.hermesGateway.delete({ where: { id } });

    return NextResponse.json({ message: 'Gateway deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete gateway error:', error);
    return NextResponse.json(
      { error: 'Failed to delete gateway', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
