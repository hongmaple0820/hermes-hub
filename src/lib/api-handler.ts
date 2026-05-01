import { NextRequest, NextResponse } from 'next/server';

export class UnauthorizedError extends Error {
  constructor() {
    super('Unauthorized');
    this.name = 'UnauthorizedError';
  }
}

type AuthUser = {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  role: string;
  status: string;
};

type HandlerResult = Promise<NextResponse>;

type AuthenticatedHandler = (
  request: NextRequest,
  user: AuthUser,
  context: { params: Promise<Record<string, string>> }
) => HandlerResult;

type RouteHandler = (
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => HandlerResult;

export function withAuth(handler: AuthenticatedHandler): RouteHandler {
  return async (request, context) => {
    try {
      const user = await resolveAuth(request);
      return await handler(request, user, context);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

export function withAuthNoParams(
  handler: (request: NextRequest, user: AuthUser) => HandlerResult
): RouteHandler {
  return async (request, _context) => {
    try {
      const user = await resolveAuth(request);
      return await handler(request, user);
    } catch (error) {
      return handleApiError(error);
    }
  };
}

async function resolveAuth(request: NextRequest): Promise<AuthUser> {
  let userId: string | null = null;

  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    userId = authHeader.substring(7).trim();
  }

  if (!userId) {
    userId = request.headers.get('x-user-id');
  }

  if (!userId) {
    const url = new URL(request.url);
    userId = url.searchParams.get('userId');
  }

  if (!userId) {
    throw new UnauthorizedError();
  }

  const { db } = await import('@/lib/db');
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

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.error('API error:', error);
  const details = error instanceof Error ? error.message : 'Unknown error';
  return NextResponse.json({ error: 'Internal server error', details }, { status: 500 });
}
