import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, password } = body;

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: 'MISSING_FIELDS', details: 'email, name, and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: 'INVALID_EMAIL', details: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Validate name length
    if (name.trim().length < 2) {
      return NextResponse.json(
        { error: 'NAME_TOO_SHORT', details: 'Name must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'PASSWORD_TOO_SHORT', details: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'EMAIL_EXISTS', details: 'An account with this email already exists' },
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

    return NextResponse.json({ user, token: user.id }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'REGISTRATION_FAILED', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
