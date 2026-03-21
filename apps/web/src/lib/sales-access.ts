import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@vbt/db";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import { salesRoleCanWrite } from "@/lib/partner-sales";

export function salesUserCanMutate(user: SessionUser): boolean {
  if (user.isPlatformSuperadmin) return true;
  return salesRoleCanWrite(user.role);
}

/** List / CSV export: partner = single org; superadmin = optional filter via ?organizationId= or vbt-active-org cookie, else all tenants. */
export async function salesListWhere(user: SessionUser, url: URL): Promise<Prisma.SaleWhereInput> {
  if (!user.isPlatformSuperadmin) {
    const org = getEffectiveOrganizationId(user);
    if (!org) return { id: { in: [] } };
    return { organizationId: org };
  }
  const q = url.searchParams.get("organizationId")?.trim();
  if (q) return { organizationId: q };
  const cookieOrg = await getEffectiveActiveOrgId(user);
  if (cookieOrg) return { organizationId: cookieOrg };
  return {};
}

export type SalesScopedOrgResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: string; status: number };

/** Statements, entities (superadmin), reports/summary, notifications/due: exactly one org. */
export async function requireSalesScopedOrganizationId(user: SessionUser, url: URL): Promise<SalesScopedOrgResult> {
  if (!user.isPlatformSuperadmin) {
    const org = getEffectiveOrganizationId(user);
    if (!org) return { ok: false, error: "No organization", status: 403 };
    return { ok: true, organizationId: org };
  }
  const q = url.searchParams.get("organizationId")?.trim();
  const cookieOrg = await getEffectiveActiveOrgId(user);
  const organizationId = q || cookieOrg || "";
  if (!organizationId) {
    return {
      ok: false,
      error: "organizationId query parameter or active partner context required",
      status: 400,
    };
  }
  return { ok: true, organizationId };
}

/** POST /api/sales: target org for the new sale. */
export async function resolveOrganizationIdForSaleCreate(
  user: SessionUser,
  url: URL,
  bodyOrganizationId?: string | null
): Promise<SalesScopedOrgResult> {
  if (!user.isPlatformSuperadmin) {
    const org = getEffectiveOrganizationId(user);
    if (!org) return { ok: false, error: "No organization", status: 403 };
    return { ok: true, organizationId: org };
  }
  const fromBody = bodyOrganizationId?.trim();
  const fromQuery = url.searchParams.get("organizationId")?.trim();
  const cookieOrg = await getEffectiveActiveOrgId(user);
  const organizationId = fromBody || fromQuery || cookieOrg || "";
  if (!organizationId) {
    return {
      ok: false,
      error: "organizationId required (body, query, or active partner context)",
      status: 400,
    };
  }
  return { ok: true, organizationId };
}

/** Tenant org id for the sale if the user may read or mutate it by id. */
export async function saleOrganizationIdIfReadable(user: SessionUser, saleId: string): Promise<string | null> {
  const row = await prisma.sale.findUnique({
    where: { id: saleId },
    select: { organizationId: true },
  });
  if (!row) return null;
  if (user.isPlatformSuperadmin) return row.organizationId;
  const org = getEffectiveOrganizationId(user);
  return org === row.organizationId ? row.organizationId : null;
}

/** Crear/editar entidades de facturación: fabricante (superadmin) o admin del partner. */
export function canManageBillingEntities(user: SessionUser): boolean {
  if (user.isPlatformSuperadmin) return true;
  return (user.role ?? "").toLowerCase() === "org_admin";
}

export async function billingEntityOrganizationIdIfManageable(
  user: SessionUser,
  billingEntityId: string
): Promise<string | null> {
  const row = await prisma.billingEntity.findUnique({
    where: { id: billingEntityId },
    select: { organizationId: true },
  });
  if (!row) return null;
  if (user.isPlatformSuperadmin) return row.organizationId;
  const org = getEffectiveOrganizationId(user);
  return org === row.organizationId ? row.organizationId : null;
}

export async function paymentRecordIfMutable(
  user: SessionUser,
  paymentId: string
): Promise<{ organizationId: string; saleId: string } | null> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    select: { organizationId: true, saleId: true },
  });
  if (!payment) return null;
  if (user.isPlatformSuperadmin) return payment;
  const org = getEffectiveOrganizationId(user);
  return org === payment.organizationId ? payment : null;
}
