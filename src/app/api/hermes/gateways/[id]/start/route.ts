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

    if (gateway.status === 'running') {
      return NextResponse.json(
        { error: 'Gateway already running', details: 'The gateway is already in running state' },
        { status: 400 }
      );
    }

    // Simulate starting the gateway
    const updated = await db.hermesGateway.update({
      where: { id },
      data: {
        status: 'running',
        pid: Math.floor(Math.random() * 10000) + 1000, // Simulated PID
        lastHealth: new Date(),
      },
    });

    return NextResponse.json({
      gateway: updated,
      message: `Gateway "${gateway.name}" started successfully on ${gateway.host}:${gateway.port}`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Start gateway error:', error);
    return NextResponse.json(
      { error: 'Failed to start gateway', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
