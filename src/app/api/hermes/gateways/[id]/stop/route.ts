import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(
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

    if (gateway.status === 'stopped') {
      return NextResponse.json(
        { error: 'Gateway already stopped', details: 'The gateway is already in stopped state' },
        { status: 400 }
      );
    }

    // Simulate stopping the gateway
    const updated = await db.hermesGateway.update({
      where: { id },
      data: {
        status: 'stopped',
        pid: null,
      },
    });

    return NextResponse.json({
      gateway: updated,
      message: `Gateway "${gateway.name}" stopped successfully`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Stop gateway error:', error);
    return NextResponse.json(
      { error: 'Failed to stop gateway', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
