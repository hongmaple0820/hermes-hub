import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/api-handler';

// GET /api/auth/copilot/poll?deviceCode=xxx - Poll for token
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const deviceCode = request.nextUrl.searchParams.get('deviceCode');

    if (!deviceCode) {
      return NextResponse.json(
        { error: 'deviceCode parameter is required' },
        { status: 400 }
      );
    }

    const token = await db.oAuthToken.findUnique({
      where: { userId_provider: { userId: user.id, provider: 'copilot' } },
    });

    if (!token || token.deviceCode !== deviceCode) {
      return NextResponse.json(
        { error: 'Invalid device code' },
        { status: 404 }
      );
    }

    // Check if already active
    if (token.status === 'active') {
      return NextResponse.json({ status: 'active' });
    }

    // Check if expired or revoked
    if (token.status === 'expired' || token.status === 'revoked') {
      return NextResponse.json({ status: token.status });
    }

    // Poll GitHub for token
    const clientId = 'Iv1.b507a08c87ecfe98';

    try {
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        // Success! Store the token
        await db.oAuthToken.update({
          where: { id: token.id },
          data: {
            accessToken: data.access_token,
            tokenType: data.token_type || 'Bearer',
            status: 'active',
            polling: false,
            verifiedAt: new Date(),
            scope: data.scope || token.scope,
          },
        });

        return NextResponse.json({ status: 'active' });
      }

      if (data.error === 'authorization_pending') {
        return NextResponse.json({ status: 'pending' });
      }

      if (data.error === 'slow_down') {
        return NextResponse.json({ status: 'pending', interval: 10 });
      }

      if (data.error === 'expired_token') {
        await db.oAuthToken.update({
          where: { id: token.id },
          data: { status: 'expired', polling: false },
        });
        return NextResponse.json({ status: 'expired' });
      }

      if (data.error === 'access_denied') {
        await db.oAuthToken.update({
          where: { id: token.id },
          data: { status: 'revoked', polling: false },
        });
        return NextResponse.json({ status: 'revoked' });
      }

      // Other error - still pending
      return NextResponse.json({ status: 'pending' });
    } catch (fetchError) {
      console.error('Copilot token poll fetch error:', fetchError);
      return NextResponse.json({ status: 'pending' });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
