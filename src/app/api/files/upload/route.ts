import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const formData = await request.formData();

    const targetPath = (formData.get('path') as string) || '/';
    const normalizedTarget = targetPath.startsWith('/') ? targetPath : '/' + targetPath;

    // Ensure target directory exists
    if (normalizedTarget !== '/') {
      const dir = await db.fileEntry.findUnique({
        where: {
          userId_path: { userId: user.id, path: normalizedTarget },
        },
      });

      if (!dir) {
        // Auto-create the target directory
        const dirName = normalizedTarget.split('/').filter(Boolean).pop() || 'uploads';
        await db.fileEntry.create({
          data: {
            userId: user.id,
            name: dirName,
            path: normalizedTarget,
            type: 'directory',
            size: 0,
          },
        }).catch(() => {
          // Directory might already exist from a concurrent request
        });
      }
    }

    const uploadedFiles: Array<{
      id: string;
      name: string;
      path: string;
      type: string;
      size: number;
      mimeType: string | null;
    }> = [];

    // Process all files in the form data
    const entries = Array.from(formData.entries());
    for (const [key, value] of entries) {
      if (value instanceof File) {
        const file = value;
        const filePath = normalizedTarget === '/'
          ? '/' + file.name
          : normalizedTarget + '/' + file.name;

        const content = await file.text();
        const size = file.size;

        // Upsert the file entry
        const fileEntry = await db.fileEntry.upsert({
          where: {
            userId_path: { userId: user.id, path: filePath },
          },
          update: {
            name: file.name,
            content,
            size,
            mimeType: file.type || 'application/octet-stream',
            backend: 'local',
          },
          create: {
            userId: user.id,
            name: file.name,
            path: filePath,
            type: 'file',
            size,
            mimeType: file.type || 'application/octet-stream',
            content,
            backend: 'local',
          },
        });

        uploadedFiles.push({
          id: fileEntry.id,
          name: fileEntry.name,
          path: fileEntry.path,
          type: fileEntry.type,
          size: fileEntry.size,
          mimeType: fileEntry.mimeType,
        });
      }
    }

    return NextResponse.json({
      message: `Uploaded ${uploadedFiles.length} file(s)`,
      files: uploadedFiles,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Upload files error:', error);
    return NextResponse.json(
      { error: 'Failed to upload files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
