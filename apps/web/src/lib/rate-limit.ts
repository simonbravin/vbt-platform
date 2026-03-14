/**
 * Framework-agnostic rate limiting for /api/saas/* routes.
 * Uses an abstract store so you can plug in memory (dev) or Redis/KV (production).
 */

export type RateLimitStore = {
  increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }>;
};

const WINDOW_MS = 60_000; // 1 minute

/** In-memory store. Works per-instance; for serverless use Redis or Vercel KV. */
const memoryStore = new Map<
  string,
  { count: number; resetAt: number }
>();

export const memoryRateLimitStore: RateLimitStore = {
  async increment(key: string, windowMs: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    const entry = memoryStore.get(key);
    if (!entry) {
      const resetAt = now + windowMs;
      memoryStore.set(key, { count: 1, resetAt });
      return { count: 1, resetAt };
    }
    if (now >= entry.resetAt) {
      const resetAt = now + windowMs;
      memoryStore.set(key, { count: 1, resetAt });
      return { count: 1, resetAt };
    }
    entry.count += 1;
    return { count: entry.count, resetAt: entry.resetAt };
  },
};

export type RateLimitTier = "analytics" | "create_update" | "auth" | "read";

const LIMITS: Record<RateLimitTier, number> = {
  analytics: 60,
  create_update: 20,
  auth: 10,
  read: 60,
};

export class RateLimitExceededError extends Error {
  constructor(
    public readonly limit: number,
    public readonly resetAt: number
  ) {
    super(`Rate limit exceeded. Try again after ${new Date(resetAt).toISOString()}`);
    this.name = "RateLimitExceededError";
  }
}

let defaultStore: RateLimitStore = memoryRateLimitStore;

export function setDefaultRateLimitStore(store: RateLimitStore): void {
  defaultStore = store;
}

/**
 * Check rate limit for the given identifier and tier.
 * @param identifier - e.g. IP or userId
 * @param tier - analytics (60/min), create_update (20/min), auth (10/min)
 * @param store - optional store; uses default (memory) if not provided
 * @throws RateLimitExceededError when over limit
 */
export async function checkRateLimit(
  identifier: string,
  tier: RateLimitTier,
  store: RateLimitStore = defaultStore
): Promise<void> {
  const limit = LIMITS[tier];
  const key = `rl:${tier}:${identifier}`;
  const { count, resetAt } = await store.increment(key, WINDOW_MS);
  if (count > limit) {
    throw new RateLimitExceededError(limit, resetAt);
  }
}

/**
 * Derive rate limit tier from request path and method.
 * analytics/dashboard GET → 60/min; auth → 10/min; mutations → 20/min; other GET → 60/min.
 */
export function getRateLimitTier(pathname: string, method: string): RateLimitTier {
  if (/\/api\/saas\/auth/.test(pathname)) return "auth";
  if (/\/api\/saas\/analytics/.test(pathname) || /\/api\/saas\/dashboard/.test(pathname))
    return "analytics";
  const isMutation = /^(POST|PATCH|PUT|DELETE)$/.test(method);
  if (
    isMutation &&
    /\/api\/saas\/(projects|quotes|engineering|documents|partners|org-members|territories|training\/enrollments)/.test(
      pathname
    )
  )
    return "create_update";
  return "read";
}

/**
 * Get client identifier from request (IP). Works behind Vercel or Node.
 */
export function getRateLimitIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
