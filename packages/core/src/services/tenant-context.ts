/**
 * Minimal tenant context for use in @vbt/core services.
 * Passed from the app layer (derived from session); never trust client input for organizationId.
 */
export type TenantContext = {
  userId: string;
  /** Active organization for scoping. Null for superadmin when doing cross-tenant ops. */
  organizationId: string | null;
  isPlatformSuperadmin: boolean;
};

/**
 * Return Prisma where clause for organization scoping.
 * - Non-superadmin: always filter by ctx.organizationId.
 * - Superadmin with organizationId: filter by that org.
 * - Superadmin with null organizationId: no org filter (cross-tenant).
 */
export function orgScopeWhere(ctx: TenantContext): { organizationId: string } | Record<string, never> {
  if (ctx.organizationId) return { organizationId: ctx.organizationId };
  if (ctx.isPlatformSuperadmin) return {};
  return { organizationId: "" }; // exclude all for safety
}
