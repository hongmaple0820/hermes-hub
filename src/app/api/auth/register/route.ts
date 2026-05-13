import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { signAccessToken, signRefreshToken, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, COOKIE_OPTIONS, REFRESH_COOKIE_OPTIONS } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, password } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'email, name, and password are required' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password too short', details: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists', details: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.user.create({
      data: { email, name, password: hashedPassword },
      select: {
        id: true, email: true, name: true, avatar: true, bio: true, role: true, status: true, createdAt: true,
      },
    });

    // Issue JWT tokens
    const accessToken = await signAccessToken({ userId: user.id, email: user.email, role: user.role });
    const refreshToken = await signRefreshToken({ userId: user.id });

    const response = NextResponse.json({ user, token: accessToken }, { status: 201 });

    // Set httpOnly cookies
    response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, COOKIE_OPTIONS);
    response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
