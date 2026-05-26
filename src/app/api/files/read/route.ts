import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const path = url.searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'path query parameter is required' },
        { status: 400 }
      );
    }

    const normalizedPath = path.startsWith('/') ? path : '/' + path;

    const file = await db.fileEntry.findUnique({
      where: {
        userId_path: { userId: user.id, path: normalizedPath },
      },
    });

    if (!file) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    if (file.type === 'directory') {
      return NextResponse.json({ error: 'Cannot read a directory' }, { status: 400 });
    }

    return NextResponse.json({
      file: {
        id: file.id,
        name: file.name,
        path: file.path,
        type: file.type,
        size: file.size,
        mimeType: file.mimeType,
        content: file.content,
        backend: file.backend,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Read file error:', error);
    return NextResponse.json(
      { error: 'Failed to read file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
