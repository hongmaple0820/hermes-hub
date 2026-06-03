import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const templates = await db.agentTemplate.findMany({
      where: { isPublic: true },
      orderBy: { category: 'asc' },
    });
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json({ error: 'Failed to get templates' }, { status: 500 });
  }
}