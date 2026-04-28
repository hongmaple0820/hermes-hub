import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

/**
 * Simple auth helper for development.
 * Extracts userId from Authorization: Bearer {userId} header or x-user-id header.
 * Returns null if no valid user found.
 */
export async function getAuthUser(request: NextRequest): Promise<{
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  status: string;
} | null> {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  let userId: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    userId = authHeader.substring(7).trim();
  }

  // Fall back to x-user-id header
  if (!userId) {
    userId = request.headers.get('x-user-id');
  }

  // Fall back to query parameter
  if (!userId) {
    const url = new URL(request.url);
    userId = url.searchParams.get('userId');
  }

  if (!userId) {
    return null;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatar: true,
      role: true,
      status: true,
    },
  });

  return user;
}

/**
 * Require authentication - throws if not authenticated
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
