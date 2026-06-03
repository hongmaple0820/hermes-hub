import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await db.agentTemplate.findUnique({ where: { id } });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (error) {
    console.error('Get template error:', error);
    return NextResponse.json({ error: 'Failed to get template' }, { status: 500 });
  }
}