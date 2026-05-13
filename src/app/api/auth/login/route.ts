import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { signAccessToken, signRefreshToken, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS, REFRESH_COOKIE_OPTIONS } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'email and password are required' },
        { status: 400 }
      );
    }

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials', details: 'No account found with this email' },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials', details: 'Incorrect password' },
        { status: 401 }
      );
    }

    // Update user status to online
    await db.user.update({
      where: { id: user.id },
      data: { status: 'online' },
    });

    // Issue JWT tokens
    const accessToken = await signAccessToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = await signRefreshToken({ userId: user.id });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        role: user.role,
        status: 'online',
        createdAt: user.createdAt,
      },
      token: accessToken, // JWT access token for API headers
    });

    // Set httpOnly cookies
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, COOKIE_OPTIONS);
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
