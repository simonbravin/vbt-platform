import { getServerSession } from "next-auth";
import { cookies } from "next/headers";
import { authOptions, type SessionUser } from "./auth";

/** Cookie used by superadmin to "view as" a partner org. */
export const ACTIVE_ORG_COOKIE = "vbt-active-org";

export type TenantContext = {
  userId: string;
  activeOrgId: string | null;
  role: string;
  roles: string[];
  isPlatformSuperadmin: boolean;
};

/**
 * Auth/tenant errors for route handlers to map to HTTP status.
 */
export class TenantError extends Error {
  constructor(
    message: string,
    public readonly code: "UNAUTHORIZED" | "FORBIDDEN" | "NO_ACTIVE_ORG" | "ORG_ACCESS_DENIED"
  ) {
    super(message);
    this.name = "TenantError";
  }
}

/**
 * Get current session. Returns null if not authenticated.
 * Use requireSession() when you need a guaranteed user.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return session.user as SessionUser;
}

/**
 * Require an authenticated session. Throws TenantError UNAUTHORIZED if not signed in.
 * Reusable in API routes (catch and return 401), server actions, and services.
 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  return user;
}

/**
 * Require a session with an active organization context (or platform superadmin).
 * Use when the operation is tenant-scoped and you need activeOrgId for filtering.
 * Superadmins may have null activeOrgId; callers should treat that as "all orgs" when appropriate.
 */
export async function requireActiveOrg(): Promise<SessionUser> {
  const user = await requireSession();
  if (!user.activeOrgId && !user.isPlatformSuperadmin) {
    throw new TenantError("No active organization", "NO_ACTIVE_ORG");
  }
  return user;
}

/**
 * Require platform superadmin. Throws FORBIDDEN if not superadmin.
 */
export async function requirePlatformSuperadmin(): Promise<SessionUser> {
  const user = await requireSession();
  if (!user.isPlatformSuperadmin) {
    throw new TenantError("Platform superadmin required", "FORBIDDEN");
  }
  return user;
}

/**
 * Require that the user has one of the given roles in the active org (or is platform superadmin).
 * Call requireSession() or requireActiveOrg() first if you need an org context.
 */
export async function requireOrgRole(
  allowedRoles: string | string[]
): Promise<SessionUser> {
  const user = await requireSession();
  if (user.isPlatformSuperadmin) return user;
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  const hasRole = roles.some((r) => user.role === r || user.roles?.includes(r));
  if (!hasRole) {
    throw new TenantError("Insufficient role", "FORBIDDEN");
  }
  return user;
}

/**
 * Assert that the user can access the given organization:
 * either their activeOrgId matches, or they are a platform superadmin.
 * Throws ORG_ACCESS_DENIED if access is not allowed.
 */
export async function assertOrgAccess(
  organizationId: string
): Promise<SessionUser> {
  const user = await requireSession();
  if (user.isPlatformSuperadmin) return user;
  if (user.activeOrgId !== organizationId) {
    throw new TenantError("Access denied to this organization", "ORG_ACCESS_DENIED");
  }
  return user;
}

/**
 * Get tenant context for use in services: userId, activeOrgId, role, roles, isPlatformSuperadmin.
 * Returns null if not authenticated. For platform superadmins, activeOrgId is overridden by
 * the vbt-active-org cookie when set (context switcher).
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  const user = await getSessionUser();
  if (!user) return null;
  let activeOrgId = user.activeOrgId ?? null;
  if (user.isPlatformSuperadmin) {
    const store = await cookies();
    const value = store.get(ACTIVE_ORG_COOKIE)?.value;
    activeOrgId = value ?? null;
  }
  return {
    userId: user.userId ?? user.id,
    activeOrgId,
    role: user.role ?? "viewer",
    roles: user.roles ?? [],
    isPlatformSuperadmin: user.isPlatformSuperadmin ?? false,
  };
}

/**
 * Single source of truth for "current organization id" from session user.
 * Returns activeOrgId with legacy fallback to orgId (deprecated). Prefer this instead of
 * repeating "user.activeOrgId ?? user.orgId" across routes and pages.
 */
export function getEffectiveOrganizationId(
  user: { activeOrgId?: string | null; orgId?: string | null } | null
): string | null {
  if (!user) return null;
  return user.activeOrgId ?? user.orgId ?? null;
}

/**
 * Effective activeOrgId for layout/redirect logic: for superadmins, reads vbt-active-org cookie;
 * otherwise returns session activeOrgId (with legacy orgId fallback).
 */
export async function getEffectiveActiveOrgId(
  user: SessionUser | null
): Promise<string | null> {
  if (!user) return null;
  if (user.isPlatformSuperadmin) {
    const store = await cookies();
    return store.get(ACTIVE_ORG_COOKIE)?.value ?? null;
  }
  return getEffectiveOrganizationId(user);
}

/**
 * Map TenantError to HTTP status for API routes.
 */
export function tenantErrorStatus(error: unknown): number {
  if (error instanceof TenantError) {
    switch (error.code) {
      case "UNAUTHORIZED":
        return 401;
      case "FORBIDDEN":
      case "NO_ACTIVE_ORG":
      case "ORG_ACCESS_DENIED":
        return 403;
      default:
        return 403;
    }
  }
  return 500;
}
