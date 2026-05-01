import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { handleApiError } from '@/lib/api-handler';

// GET /api/auth/codex/poll?deviceCode=xxx - Poll for token
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
      where: { userId_provider: { userId: user.id, provider: 'codex' } },
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

    // Check if expired
    if (token.status === 'expired' || token.status === 'revoked') {
      return NextResponse.json({ status: token.status });
    }

    // Try to poll for token
    const clientId = process.env.OPENAI_CLIENT_ID || 'app_HHVjOYnlOZSxgJLNnJlJgKRR';

    try {
      const response = await fetch('https://auth.openai.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          device_code: deviceCode,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      });

      const data = await response.json();

      if (response.ok && data.access_token) {
        // Success! Store the token
        await db.oAuthToken.update({
          where: { id: token.id },
          data: {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || null,
            tokenType: data.token_type || 'Bearer',
            expiresIn: data.expires_in || null,
            status: 'active',
            polling: false,
            verifiedAt: new Date(),
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
      // Network error - return pending so client can retry
      console.error('Codex token poll fetch error:', fetchError);
      return NextResponse.json({ status: 'pending' });
    }
  } catch (error) {
    return handleApiError(error);
  }
}
