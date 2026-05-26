import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    const recursive = url.searchParams.get('recursive') === 'true';

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

    if (file.type === 'directory' && !recursive) {
      // Check if directory has children
      const prefix = normalizedPath + '/';
      const children = await db.fileEntry.findFirst({
        where: {
          userId: user.id,
          path: { startsWith: prefix },
        },
      });

      if (children) {
        return NextResponse.json(
          { error: 'Directory is not empty', details: 'Use recursive=true to delete non-empty directories' },
          { status: 400 }
        );
      }
    }

    // If recursive, delete all children too
    if (file.type === 'directory' && recursive) {
      const prefix = normalizedPath + '/';
      await db.fileEntry.deleteMany({
        where: {
          userId: user.id,
          path: { startsWith: prefix },
        },
      });
    }

    // Delete the entry itself
    await db.fileEntry.delete({
      where: {
        userId_path: { userId: user.id, path: normalizedPath },
      },
    });

    return NextResponse.json({ message: 'File deleted successfully', path: normalizedPath });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete file error:', error);
    return NextResponse.json(
      { error: 'Failed to delete file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
