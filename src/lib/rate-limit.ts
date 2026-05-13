/**
 * In-memory rate limiter for Hermes Hub
 * Tracks requests by IP + userId, with configurable limits per route type.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum requests allowed per window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

// Default: 60 requests per minute for general API routes
const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 60,
  windowMs: 60_000, // 1 minute
};

// Stricter: 10 requests per minute for auth routes (login, register)
const AUTH_CONFIG: RateLimitConfig = {
  limit: 10,
  windowMs: 60_000,
};

// Auth routes that get stricter limits
const AUTH_ROUTES = ['/api/auth/login', '/api/auth/register'];

// In-memory store: key -> RateLimitEntry
const store = new Map<string, RateLimitEntry>();

// Cleanup interval: remove expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60_000; // 5 minutes

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Clean up expired entries from the rate limit store
 */
function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now >= entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Start the cleanup timer (idempotent)
 */
function ensureCleanupStarted() {
  if (!cleanupTimer) {
    cleanupTimer = setInterval(cleanup, CLEANUP_INTERVAL);
    // Prevent the timer from keeping the process alive
    if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
      cleanupTimer.unref();
    }
  }
}

// Auto-start cleanup
ensureCleanupStarted();

/**
 * Check if a request should be rate limited.
 * @returns `{ allowed: boolean, remaining: number, resetAt: number }`
 */
export function checkRateLimit(
  ip: string,
  userId: string | undefined,
  pathname: string
): { allowed: boolean; remaining: number; resetAt: number } {
  const config = AUTH_ROUTES.some((route) => pathname.startsWith(route))
    ? AUTH_CONFIG
    : DEFAULT_CONFIG;

  // Build key from IP + userId (or just IP if no userId)
  const key = userId ? `${ip}:${userId}` : `${ip}:anonymous`;

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now >= entry.resetAt) {
    // No entry or window expired — start fresh
    const resetAt = now + config.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: config.limit - 1, resetAt };
  }

  // Within current window
  if (entry.count >= config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}

/**
 * Get rate limit headers for the response
 */
export function getRateLimitHeaders(
  config: RateLimitConfig,
  remaining: number,
  resetAt: number
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(config.limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  };
}

/**
 * Get the config that would be used for a given pathname
 */
export function getConfigForPath(pathname: string): RateLimitConfig {
  return AUTH_ROUTES.some((route) => pathname.startsWith(route))
    ? AUTH_CONFIG
    : DEFAULT_CONFIG;
}
