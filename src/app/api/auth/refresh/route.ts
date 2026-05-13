import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, signAccessToken, signRefreshToken, REFRESH_TOKEN_COOKIE, ACCESS_TOKEN_COOKIE, COOKIE_OPTIONS, REFRESH_COOKIE_OPTIONS } from '@/lib/jwt';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: 'No refresh token' }, { status: 401 });
    }

    const payload = await verifyToken(refreshToken);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid refresh token' }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, avatar: true, role: true, status: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 401 });
    }

    // Issue new tokens
    const newAccessToken = await signAccessToken({ userId: user.id, email: user.email, role: user.role });
    const newRefreshToken = await signRefreshToken({ userId: user.id });

    const response = NextResponse.json({
      user,
      token: newAccessToken,
    });

    response.cookies.set(ACCESS_TOKEN_COOKIE, newAccessToken, COOKIE_OPTIONS);
    response.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, REFRESH_COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 });
  }
}
