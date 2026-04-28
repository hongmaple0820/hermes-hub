import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const gateways = await db.hermesGateway.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ gateways });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List gateways error:', error);
    return NextResponse.json(
      { error: 'Failed to list gateways', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();
    const { name, host, port, profilePath, config } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'name is required' },
        { status: 400 }
      );
    }

    const gateway = await db.hermesGateway.create({
      data: {
        userId: user.id,
        name,
        host: host || '127.0.0.1',
        port: port || 8642,
        status: 'stopped',
        profilePath: profilePath || null,
        config: JSON.stringify(config || {}),
      },
    });

    return NextResponse.json({ gateway }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create gateway error:', error);
    return NextResponse.json(
      { error: 'Failed to create gateway', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
