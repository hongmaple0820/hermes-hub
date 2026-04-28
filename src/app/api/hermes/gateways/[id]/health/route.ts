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

    const isRunning = gateway.status === 'running';
    const uptime = isRunning && gateway.lastHealth
      ? Date.now() - new Date(gateway.lastHealth).getTime()
      : null;

    // Update last health check time
    if (isRunning) {
      await db.hermesGateway.update({
        where: { id },
        data: { lastHealth: new Date() },
      });
    }

    return NextResponse.json({
      status: gateway.status,
      healthy: isRunning,
      host: gateway.host,
      port: gateway.port,
      pid: gateway.pid,
      uptime,
      lastHealth: gateway.lastHealth,
      config: JSON.parse(gateway.config || '{}'),
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Gateway health error:', error);
    return NextResponse.json(
      { error: 'Failed to check gateway health', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
