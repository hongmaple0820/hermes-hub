import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET /api/auth/nous/poll?deviceCode=xxx - Poll for token
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
      where: { userId_provider: { userId: user.id, provider: 'nous' } },
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

    // Simulated polling for Nous Research
    // In a real implementation, this would poll the actual Nous OAuth token endpoint
    // For now, we check if the device code is older than 2 minutes (simulated auto-verify)
    const createdTime = token.createdAt.getTime();
    const elapsed = Date.now() - createdTime;

    // Simulate: after ~30 seconds, mark as active (for demo purposes)
    // In production, replace with actual token endpoint polling
    if (elapsed > 30000 && token.status === 'pending') {
      const simulatedAccessToken = `nous_at_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      await db.oAuthToken.update({
        where: { id: token.id },
        data: {
          accessToken: simulatedAccessToken,
          tokenType: 'Bearer',
          status: 'active',
          polling: false,
          verifiedAt: new Date(),
        },
      });
      return NextResponse.json({ status: 'active' });
    }

    // Check if expired (900 seconds = 15 minutes)
    if (elapsed > (token.expiresIn || 900) * 1000) {
      await db.oAuthToken.update({
        where: { id: token.id },
        data: { status: 'expired', polling: false },
      });
      return NextResponse.json({ status: 'expired' });
    }

    return NextResponse.json({ status: 'pending' });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
