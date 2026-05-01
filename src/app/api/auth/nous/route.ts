import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/api-handler';

// GET /api/auth/nous/status - Check Nous Research OAuth status
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const token = await db.oAuthToken.findUnique({
      where: { userId_provider: { userId: user.id, provider: 'nous' } },
    });

    return NextResponse.json({
      status: token?.status || 'disconnected',
      hasToken: !!token?.accessToken,
      verifiedAt: token?.verifiedAt?.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// POST /api/auth/nous/start - Start device code flow (simulated)
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Nous Research doesn't have public OAuth docs, so we simulate the device code flow
    // In production, this would be replaced with the actual Nous OAuth endpoint
    const deviceCode = `nous_dc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const userCode = `${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const verificationUri = 'https://nousresearch.com/device';
    const expiresIn = 900;
    const scope = 'model:read model:write';

    await db.oAuthToken.upsert({
      where: { userId_provider: { userId: user.id, provider: 'nous' } },
      update: {
        deviceCode,
        status: 'pending',
        polling: false,
        accessToken: null,
        refreshToken: null,
        expiresIn,
        scope,
      },
      create: {
        userId: user.id,
        provider: 'nous',
        deviceCode,
        status: 'pending',
        polling: false,
        expiresIn,
        scope,
      },
    });

    return NextResponse.json({
      deviceCode,
      userCode,
      verificationUri,
      expiresIn,
      interval: 5,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/auth/nous/revoke - Revoke token
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const token = await db.oAuthToken.findUnique({
      where: { userId_provider: { userId: user.id, provider: 'nous' } },
    });

    if (token) {
      await db.oAuthToken.delete({
        where: { id: token.id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
