import type { SessionUser } from "./auth";

type RoleUser = Pick<SessionUser, "role" | "isPlatformSuperadmin"> | null | undefined;

export function isPlatformSuperadmin(user: { isPlatformSuperadmin?: boolean } | null | undefined): boolean {
  return user?.isPlatformSuperadmin === true;
}

function roleLower(user: RoleUser): string {
  const r = user?.role;
  return typeof r === "string" ? r.toLowerCase() : "viewer";
}

/** Active org admin role (not implied by platform superadmin — use `canDeleteQuote` for combined checks). */
export function isOrgAdmin(user: RoleUser): boolean {
  const r = roleLower(user);
  return r === "org_admin" || r === "admin" || r === "owner";
}

export function isQuoteViewerOnly(user: RoleUser): boolean {
  return roleLower(user) === "viewer";
}

/**
 * Who may PATCH quotes / send email / non-delete writes on legacy quote API.
 * Mirrors prior behavior: everyone except viewer (case-insensitive).
 */
export function canManageQuotes(user: RoleUser): boolean {
  if (isPlatformSuperadmin(user)) return true;
  return !isQuoteViewerOnly(user);
}

/**
 * Delete quote: org admins and platform staff. Legacy route checked SUPERADMIN/ADMIN
 * (never matched JWT); this aligns with partner org_admin + platform superadmin.
 */
export function canDeleteQuote(user: RoleUser): boolean {
  return isPlatformSuperadmin(user) || isOrgAdmin(user);
}
