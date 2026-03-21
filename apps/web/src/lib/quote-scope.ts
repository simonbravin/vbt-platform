import type { SessionUser } from "./auth";
import { getEffectiveOrganizationId } from "./tenant";
import { isPlatformSuperadmin } from "./permissions";

/**
 * Prisma `where` for loading a quote by id with correct org scoping.
 * Superadmin without active org: match by id only. Partner without org: invalid (use error).
 */
export function quoteByIdWhere(user: SessionUser, quoteId: string): { ok: true; where: { id: string; organizationId?: string } } | { ok: false; reason: "no_org" } {
  const orgId = getEffectiveOrganizationId(user);
  const superadmin = isPlatformSuperadmin(user);
  if (!superadmin && !orgId) {
    return { ok: false, reason: "no_org" };
  }
  if (superadmin && !orgId) {
    return { ok: true, where: { id: quoteId } };
  }
  return { ok: true, where: { id: quoteId, organizationId: orgId! } };
}
