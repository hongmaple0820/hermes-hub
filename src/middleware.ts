import { NextRequest, NextResponse } from 'next/server';
import {
  verifyToken,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  signAccessToken,
  COOKIE_OPTIONS,
} from '@/lib/jwt';
import { checkRateLimit, getConfigForPath, getRateLimitHeaders } from '@/lib/rate-limit';

/**
 * Routes that don't require authentication.
 * - Auth endpoints have their own auth logic
 * - Health/seed endpoints are public
 * - ACRP endpoints are called by skill-ws service (internal)
 * - Skill-protocol validate/ws-status are called by skill-ws (internal)
 */
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/health',
  '/api/seed/',
  '/api/acrp/validate-token',
  '/api/acrp/register',
  '/api/acrp/heartbeat',
  '/api/acrp/status',
  '/api/acrp/disconnect',
  '/api/acrp/invocation-result',
  '/api/skill-protocol/validate',
  '/api/skill-protocol/ws-status',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Rate Limiting (runs BEFORE auth check) ──
  if (pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const userId = request.headers.get('x-user-id') ?? undefined;

    const { allowed, remaining, resetAt } = checkRateLimit(ip, userId, pathname);
    const config = getConfigForPath(pathname);
    const rateLimitHeaders = getRateLimitHeaders(config, remaining, resetAt);

    if (!allowed) {
      const response = NextResponse.json(
        { error: 'Too Many Requests', retryAfter: Math.ceil((resetAt - Date.now()) / 1000) },
        { status: 429 }
      );
      Object.entries(rateLimitHeaders).forEach(([k, v]) => response.headers.set(k, v));
      response.headers.set('Retry-After', String(Math.ceil((resetAt - Date.now()) / 1000)));
      return response;
    }
  }

  // Skip public routes
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Only protect /api/ routes
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Try to get token from httpOnly cookie
  let token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  let payload = token ? await verifyToken(token) : null;

  // Try Authorization header if no valid cookie token
  if (!payload) {
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
      payload = await verifyToken(token);
    }
  }

  // If access token is expired/invalid, try refresh token
  if (!payload) {
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    if (refreshToken) {
      const refreshPayload = await verifyToken(refreshToken);
      if (refreshPayload?.userId) {
        // Issue new access token from the refresh token's userId
        const newAccessToken = await signAccessToken({
          userId: refreshPayload.userId,
          email: (refreshPayload as Record<string, unknown>).email as string || '',
          role: (refreshPayload as Record<string, unknown>).role as string || 'user',
        });

        const response = NextResponse.next();
        // Set the new access token cookie
        response.cookies.set(ACCESS_TOKEN_COOKIE, newAccessToken, COOKIE_OPTIONS);
        // Set x-user-id header for backward compatibility with downstream handlers
        response.headers.set('x-user-id', refreshPayload.userId);
        return response;
      }
    }

    // No valid token found — return 401 Unauthorized
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Valid token — set x-user-id header and continue
  const response = NextResponse.next();
  response.headers.set('x-user-id', payload.userId);
  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
