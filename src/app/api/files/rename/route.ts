import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { oldPath, newPath } = body;

    if (!oldPath || !newPath) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'oldPath and newPath are required' },
        { status: 400 }
      );
    }

    const normalizedOld = oldPath.startsWith('/') ? oldPath : '/' + oldPath;
    const normalizedNew = newPath.startsWith('/') ? newPath : '/' + newPath;

    if (normalizedOld === normalizedNew) {
      return NextResponse.json(
        { error: 'Same path', details: 'oldPath and newPath are the same' },
        { status: 400 }
      );
    }

    // Check source exists
    const source = await db.fileEntry.findUnique({
      where: {
        userId_path: { userId: user.id, path: normalizedOld },
      },
    });

    if (!source) {
      return NextResponse.json({ error: 'Source file not found' }, { status: 404 });
    }

    // Check target doesn't exist
    const target = await db.fileEntry.findUnique({
      where: {
        userId_path: { userId: user.id, path: normalizedNew },
      },
    });

    if (target) {
      return NextResponse.json(
        { error: 'Target already exists', details: `A file already exists at ${normalizedNew}` },
        { status: 409 }
      );
    }

    const newName = normalizedNew.split('/').pop() || source.name;

    // Rename the entry itself
    await db.fileEntry.update({
      where: {
        userId_path: { userId: user.id, path: normalizedOld },
      },
      data: {
        path: normalizedNew,
        name: newName,
      },
    });

    // If directory, rename all children paths
    if (source.type === 'directory') {
      const prefix = normalizedOld + '/';
      const children = await db.fileEntry.findMany({
        where: {
          userId: user.id,
          path: { startsWith: prefix },
        },
      });

      const newPrefix = normalizedNew + '/';
      for (const child of children) {
        const relativePath = child.path.slice(prefix.length);
        const newChildPath = newPrefix + relativePath;
        const newChildName = newChildPath.split('/').pop() || child.name;

        await db.fileEntry.update({
          where: { id: child.id },
          data: { path: newChildPath, name: newChildName },
        });
      }
    }

    return NextResponse.json({ message: 'File renamed successfully', oldPath: normalizedOld, newPath: normalizedNew });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Rename file error:', error);
    return NextResponse.json(
      { error: 'Failed to rename file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
