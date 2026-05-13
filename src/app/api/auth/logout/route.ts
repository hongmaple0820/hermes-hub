import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/lib/jwt';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (user) {
      // Update user status to offline
      await db.user.update({
        where: { id: user.id },
        data: { status: 'offline' },
      });
    }

    const response = NextResponse.json({ success: true });

    // Clear httpOnly auth cookies
    response.cookies.set(ACCESS_TOKEN_COOKIE, '', { maxAge: 0, path: '/' });
    response.cookies.set(REFRESH_TOKEN_COOKIE, '', { maxAge: 0, path: '/api/auth/refresh' });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
