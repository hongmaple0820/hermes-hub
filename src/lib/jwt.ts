import { SignJWT, jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'hermes-hub-jwt-secret-change-in-production-2024'
);

const JWT_ISSUER = 'hermes-hub';
const JWT_AUDIENCE = 'hermes-hub-api';
const TOKEN_EXPIRY = '7d'; // 7 days
const REFRESH_TOKEN_EXPIRY = '30d'; // 30 days

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// Sign a new JWT access token
export async function signAccessToken(payload: { userId: string; email: string; role: string }): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

// Sign a refresh token
export async function signRefreshToken(payload: { userId: string }): Promise<string> {
  return new SignJWT({ userId: payload.userId, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

// Verify a JWT token
export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

// Cookie names
export const ACCESS_TOKEN_COOKIE = 'hermes_access_token';
export const REFRESH_TOKEN_COOKIE = 'hermes_refresh_token';

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
};

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/api/auth/refresh',
  maxAge: 30 * 24 * 60 * 60, // 30 days
};
