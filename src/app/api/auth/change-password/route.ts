import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'Current password and new password are required' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password too short', details: 'New password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Fetch the full user with password
    const fullUser = await db.user.findUnique({
      where: { id: user.id },
    });

    if (!fullUser) {
      return NextResponse.json(
        { error: 'User not found', details: 'User account not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, fullUser.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Wrong password', details: 'Current password is incorrect' },
        { status: 401 }
      );
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Valid authentication required' },
        { status: 401 }
      );
    }
    console.error('Change password error:', error);
    return NextResponse.json(
      { error: 'Failed to change password', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
