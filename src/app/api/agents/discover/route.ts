import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const search = url.searchParams.get('search');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { isPublic: true };

    if (category) {
      where.mode = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [agents, total] = await Promise.all([
      db.agent.findMany({
        where,
        include: {
          provider: { select: { id: true, name: true, provider: true } },
          skills: { include: { skill: { select: { id: true, name: true, displayName: true, icon: true } } } },
          user: { select: { id: true, name: true, avatar: true } },
          _count: { select: { conversations: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.agent.count({ where }),
    ]);

    return NextResponse.json({
      agents,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Discover agents error:', error);
    return NextResponse.json(
      { error: 'Failed to discover agents', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
