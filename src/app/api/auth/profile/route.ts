import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const { name, email, avatar } = body;

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (name !== undefined && name.trim()) updateData.name = name.trim();
    if (email !== undefined && email.trim()) updateData.email = email.trim();
    if (avatar !== undefined) updateData.avatar = avatar;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update', details: 'Provide at least one field: name, email, or avatar' },
        { status: 400 }
      );
    }

    // Check email uniqueness if email is being updated
    if (updateData.email) {
      const existingUser = await db.user.findUnique({
        where: { email: updateData.email as string },
      });
      if (existingUser && existingUser.id !== user.id) {
        return NextResponse.json(
          { error: 'Email already in use', details: 'Another account is using this email address' },
          { status: 409 }
        );
      }
    }

    const updatedUser = await db.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized', details: 'Valid authentication required' },
        { status: 401 }
      );
    }
    console.error('Update profile error:', error);
    return NextResponse.json(
      { error: 'Failed to update profile', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
