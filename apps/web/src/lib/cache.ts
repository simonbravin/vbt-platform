/**
 * Simple TTL cache for GET responses (analytics, dashboard).
 * Framework-agnostic; default in-memory. For production multi-instance use Redis/Vercel KV.
 */

export type CacheStore = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
};

type Entry = { value: unknown; expiresAt: number };

const memoryCache = new Map<string, Entry>();

function prune(): void {
  const now = Date.now();
  for (const [k, v] of memoryCache.entries()) {
    if (v.expiresAt <= now) memoryCache.delete(k);
  }
}

export const memoryCacheStore: CacheStore = {
  async get<T>(key: string): Promise<T | null> {
    if (memoryCache.size > 1000) prune();
    const entry = memoryCache.get(key);
    if (!entry || entry.expiresAt <= Date.now()) return null;
    return entry.value as T;
  },
  async set(key: string, value: unknown, ttlMs: number): Promise<void> {
    memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  },
};

let defaultCacheStore: CacheStore = memoryCacheStore;

export function setDefaultCacheStore(store: CacheStore): void {
  defaultCacheStore = store;
}

export function getDefaultCacheStore(): CacheStore {
  return defaultCacheStore;
}

/** TTL in ms */
export const CACHE_TTL = {
  analytics: 60_000,      // 60s
  dashboard: 30_000,      // 30s
  leaderboard: 120_000,   // 120s
} as const;

/**
 * Build cache key for analytics/dashboard GET requests.
 */
export function buildCacheKey(
  pathname: string,
  searchParams: string,
  organizationId: string | null
): string {
  return `cache:${pathname}:${searchParams}:${organizationId ?? "platform"}`;
}
