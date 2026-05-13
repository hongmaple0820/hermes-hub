import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken, ACCESS_TOKEN_COOKIE } from '@/lib/jwt';

/**
 * Get authenticated user from request.
 * Supports JWT via:
 * 1. httpOnly cookie (hermes_access_token)
 * 2. Authorization: Bearer <jwt> header
 * 3. x-user-id header (legacy, deprecated - will be removed)
 * 4. ?userId= query param (legacy, deprecated)
 */
export async function getAuthUser(request: NextRequest): Promise<{
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  status: string;
} | null> {
  // 1. Try JWT from httpOnly cookie
  const cookieToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (cookieToken) {
    const payload = await verifyToken(cookieToken);
    if (payload?.userId) {
      const user = await db.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true, avatar: true, role: true, status: true },
      });
      if (user) return user;
    }
  }

  // 2. Try JWT from Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = await verifyToken(token);
    if (payload?.userId) {
      const user = await db.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, name: true, avatar: true, role: true, status: true },
      });
      if (user) return user;
    }
  }

  // 3. Legacy: x-user-id header (deprecated, for backward compat during migration)
  const legacyUserId = request.headers.get('x-user-id');
  if (legacyUserId) {
    const user = await db.user.findUnique({
      where: { id: legacyUserId },
      select: { id: true, email: true, name: true, avatar: true, role: true, status: true },
    });
    if (user) return user;
  }

  // 4. Legacy: query parameter (deprecated)
  const url = new URL(request.url);
  const queryUserId = url.searchParams.get('userId');
  if (queryUserId) {
    const user = await db.user.findUnique({
      where: { id: queryUserId },
      select: { id: true, email: true, name: true, avatar: true, role: true, status: true },
    });
    if (user) return user;
  }

  return null;
}

/**
 * Extract userId from request - tries JWT first, then legacy methods.
 * Returns null if no valid userId found.
 */
export async function extractUserId(request: NextRequest): Promise<string | null> {
  // 1. Try JWT from httpOnly cookie
  const cookieToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  if (cookieToken) {
    const payload = await verifyToken(cookieToken);
    if (payload?.userId) return payload.userId;
  }

  // 2. Try JWT from Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const payload = await verifyToken(token);
    if (payload?.userId) return payload.userId;
  }

  // 3. Legacy: x-user-id header
  const legacyUserId = request.headers.get('x-user-id');
  if (legacyUserId) return legacyUserId;

  // 4. Legacy: query parameter
  const url = new URL(request.url);
  const queryUserId = url.searchParams.get('userId');
  if (queryUserId) return queryUserId;

  return null;
}

/**
 * Require authentication - throws if not authenticated.
 * Validates JWT token and ensures user exists in database.
 */
export async function requireAuth(request: NextRequest): Promise<{
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  status: string;
}> {
  const user = await getAuthUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}
