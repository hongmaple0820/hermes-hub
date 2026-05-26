import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { path, content, mimeType, backend, backendConfig } = body;

    if (!path || content === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'path and content are required' },
        { status: 400 }
      );
    }

    const normalizedPath = path.startsWith('/') ? path : '/' + path;
    const name = normalizedPath.split('/').pop() || 'untitled';
    const size = typeof content === 'string' ? Buffer.byteLength(content, 'utf-8') : 0;

    // Ensure parent directory exists
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

    // Upsert the file
    const file = await db.fileEntry.upsert({
      where: {
        userId_path: { userId: user.id, path: normalizedPath },
      },
      update: {
        name,
        content,
        size,
        mimeType: mimeType || 'text/plain',
        backend: backend || 'local',
        backendConfig: backendConfig ? JSON.stringify(backendConfig) : '{}',
      },
      create: {
        userId: user.id,
        name,
        path: normalizedPath,
        type: 'file',
        size,
        mimeType: mimeType || 'text/plain',
        content,
        backend: backend || 'local',
        backendConfig: backendConfig ? JSON.stringify(backendConfig) : '{}',
      },
    });

    return NextResponse.json({ file });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Write file error:', error);
    return NextResponse.json(
      { error: 'Failed to write file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
