import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const path = url.searchParams.get('path') || '/';

    if (path === '/') {
      // List root-level files
      const files = await db.fileEntry.findMany({
        where: {
          userId: user.id,
          path: { not: { contains: '/' } },
        },
        orderBy: [{ type: 'asc' }, { name: 'asc' }],
      });
      return NextResponse.json({ path: '/', files });
    }

    // Normalize path - ensure starts with /
    const normalizedPath = path.startsWith('/') ? path : '/' + path;

    // Find the directory entry itself
    const dir = await db.fileEntry.findUnique({
      where: {
        userId_path: { userId: user.id, path: normalizedPath },
      },
    });

    if (!dir) {
      return NextResponse.json({ error: 'Directory not found' }, { status: 404 });
    }

    if (dir.type !== 'directory') {
      return NextResponse.json({ error: 'Path is not a directory' }, { status: 400 });
    }

    // List children: paths that start with normalizedPath + '/'
    const prefix = normalizedPath + '/';
    const allFiles = await db.fileEntry.findMany({
      where: {
        userId: user.id,
        path: { startsWith: prefix },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    // Only return direct children (not nested deeper)
    const files = allFiles.filter((f) => {
      const relativePath = f.path.slice(prefix.length);
      return !relativePath.includes('/');
    });

    return NextResponse.json({ path: normalizedPath, files });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List files error:', error);
    return NextResponse.json(
      { error: 'Failed to list files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
