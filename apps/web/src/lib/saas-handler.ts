import { NextResponse } from "next/server";
import { getTenantContext } from "./tenant";
import { normalizeApiError } from "./api-error";
import { checkRateLimit, getRateLimitTier, getRateLimitIdentifier } from "./rate-limit";
import { getDefaultCacheStore, buildCacheKey } from "./cache";
import { logApiRequest } from "./api-logger";

export type SaaSHandlerOptions = {
  /** Rate limit tier; if not set, rate limit is applied from path + method */
  rateLimitTier?: "analytics" | "create_update" | "auth" | "read";
  /** TTL in ms for GET response cache (analytics/dashboard only). Omit to skip cache. */
  cacheTtl?: number;
  /** Skip rate limiting (e.g. internal health) */
  skipRateLimit?: boolean;
};

type Handler = (req: Request, routeContext?: unknown) => Promise<NextResponse>;

/**
 * Wraps an API handler with rate limiting, optional caching, error handling, and structured logging.
 * Use for all /api/saas/* routes.
 * Passes the App Router second argument (e.g. `{ params }`) through as `routeContext` when present.
 */
export function withSaaSHandler(
  options: SaaSHandlerOptions,
  handler: Handler
): (req: Request, routeContext?: unknown) => Promise<NextResponse> {
  return async (req: Request, routeContext?: unknown): Promise<NextResponse> => {
    const start = Date.now();
    const url = new URL(req.url);
    const pathname = url.pathname;
    const method = req.method;
    let ctx: Awaited<ReturnType<typeof getTenantContext>> = null;
    let status = 500;

    try {
      if (!options.skipRateLimit) {
        const tier = options.rateLimitTier ?? getRateLimitTier(pathname, method);
        await checkRateLimit(getRateLimitIdentifier(req), tier);
      }

      ctx = await getTenantContext();

      if (options.cacheTtl && method === "GET") {
        const cache = getDefaultCacheStore();
        const key = buildCacheKey(pathname, url.searchParams.toString(), ctx?.activeOrgId ?? null);
        const cached = await cache.get<unknown>(key);
        if (cached != null) {
          status = 200;
          logApiRequest({
            level: "info",
            endpoint: pathname,
            method,
            userId: ctx?.userId,
            organizationId: ctx?.activeOrgId,
            durationMs: Date.now() - start,
            status,
          });
          return NextResponse.json(cached);
        }
      }

      const res = await handler(req, routeContext);
      status = res.status;

      if (options.cacheTtl && method === "GET" && res.ok && res.status === 200) {
        try {
          const body = await res.clone().json();
          const cache = getDefaultCacheStore();
          const key = buildCacheKey(pathname, url.searchParams.toString(), ctx?.activeOrgId ?? null);
          await cache.set(key, body, options.cacheTtl);
        } catch {
          // ignore cache write errors
        }
      }

      logApiRequest({
        level: status >= 500 ? "error" : status >= 400 ? "warn" : "info",
        endpoint: pathname,
        method,
        userId: ctx?.userId,
        organizationId: ctx?.activeOrgId,
        durationMs: Date.now() - start,
        status,
      });

      return res;
    } catch (e) {
      const { status: errStatus, payload } = normalizeApiError(e);
      status = errStatus;
      logApiRequest({
        level: status >= 500 ? "error" : "warn",
        endpoint: pathname,
        method,
        userId: ctx?.userId,
        organizationId: ctx?.activeOrgId,
        durationMs: Date.now() - start,
        status,
        error: e instanceof Error ? e.message : String(e),
      });
      return NextResponse.json(payload, { status: errStatus });
    }
  };
}
