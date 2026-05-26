import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Delete the user — cascading deletes will handle related records
    await db.user.delete({
      where: { id: user.id },
    });

    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete account error:', error);
    return NextResponse.json(
      { error: 'Failed to delete account', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
