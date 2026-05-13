import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { path } = body;

    if (!path) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'path is required' },
        { status: 400 }
      );
    }

    const normalizedPath = path.startsWith('/') ? path : '/' + path;
    const name = normalizedPath.split('/').filter(Boolean).pop() || 'unnamed';

    // Check if already exists
    const existing = await db.fileEntry.findUnique({
      where: {
        userId_path: { userId: user.id, path: normalizedPath },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Directory already exists', details: `A file or directory already exists at ${normalizedPath}` },
        { status: 409 }
      );
    }

    // Ensure parent directories exist
    const pathParts = normalizedPath.split('/').filter(Boolean);
    if (pathParts.length > 1) {
      for (let i = 1; i < pathParts.length; i++) {
        const dirPath = '/' + pathParts.slice(0, i).join('/');
        await db.fileEntry.upsert({
          where: {
            userId_path: { userId: user.id, path: dirPath },
          },
          update: {},
          create: {
            userId: user.id,
            name: pathParts[i - 1],
            path: dirPath,
            type: 'directory',
            size: 0,
          },
        });
      }
    }

    // Create the directory
    const directory = await db.fileEntry.create({
      data: {
        userId: user.id,
        name,
        path: normalizedPath,
        type: 'directory',
        size: 0,
        content: null,
      },
    });

    return NextResponse.json({ directory }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Create directory error:', error);
    return NextResponse.json(
      { error: 'Failed to create directory', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
