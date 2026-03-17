import { NextResponse } from "next/server";
import { getVisionLatamOrganizationId } from "@vbt/core";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError, tenantErrorStatus } from "@/lib/tenant";

/** GET: list warehouses (legacy array format). Superadmin = Vision Latam only; partner = their org.
 *  Prefer GET /api/saas/warehouses (returns { warehouses }) with organizationId for new code. */
export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (ctx.isPlatformSuperadmin) {
      const vlOrgId = await getVisionLatamOrganizationId(prisma);
      if (!vlOrgId) return NextResponse.json([]);
      const list = await prisma.warehouse.findMany({
        where: { organizationId: vlOrgId },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { name: "asc" },
      });
      return NextResponse.json(list);
    }

    if (!ctx.activeOrgId) {
      return NextResponse.json([]);
    }
    const list = await prisma.warehouse.findMany({
      where: { organizationId: ctx.activeOrgId },
      include: { organization: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(list);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    console.error("[api/admin/warehouses GET]", e);
    return NextResponse.json([]);
  }
}

/** POST: create warehouse. Superadmin defaults to Vision Latam org; partner uses active org. */
export async function POST(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const location = typeof body.location === "string" ? body.location.trim() || null : null;
    const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim() || null : null;
    const address = typeof body.address === "string" ? body.address.trim() || null : null;
    const managerName = typeof body.managerName === "string" ? body.managerName.trim() || null : null;
    const contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim() || null : null;
    const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim() || null : null;
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    // Superadmin = Vision Latam org (platform owner). Partner = their active org. No ad-hoc org creation.
    let organizationId: string | null = null;
    if (ctx.isPlatformSuperadmin) {
      if (body.organizationId && typeof body.organizationId === "string" && body.organizationId.trim()) {
        organizationId = body.organizationId.trim();
      } else {
        organizationId = await getVisionLatamOrganizationId(prisma);
      }
    } else if (ctx.activeOrgId) {
      organizationId = ctx.activeOrgId;
    }
    if (!organizationId || typeof organizationId !== "string" || !organizationId.trim()) {
      const msg = ctx.isPlatformSuperadmin
        ? "Platform not configured: Vision Latam organization is missing. Run database migrations (prisma migrate deploy) and optionally seed (pnpm db:seed)."
        : "Organization required. Select your organization or contact support.";
      return NextResponse.json({ error: msg }, { status: ctx.isPlatformSuperadmin ? 503 : 400 });
    }
    const orgId = organizationId.trim();

    const fullData = { organizationId: orgId, name, location, countryCode, address, managerName, contactPhone, contactEmail };
    const includeOrg = { organization: { select: { id: true, name: true } } } as const;
    let warehouse: Awaited<ReturnType<typeof prisma.warehouse.create>> & { organization?: { id: string; name: string } };
    try {
      warehouse = await prisma.warehouse.create({
        data: fullData,
        include: includeOrg,
      });
    } catch (createErr) {
      const err = createErr as Error & { code?: string };
      const isMissingColumn = err?.code === "P2022" || /column.*does not exist|Unknown column/i.test(String(err?.message ?? ""));
      if (isMissingColumn) {
        try {
          warehouse = await prisma.warehouse.create({
            data: { organizationId: orgId, name, location },
            include: includeOrg,
          });
          if (warehouse && (countryCode ?? address ?? managerName ?? contactPhone ?? contactEmail)) {
            await prisma.warehouse
              .update({
                where: { id: warehouse.id },
                data: {
                  ...(countryCode != null && { countryCode }),
                  ...(address != null && { address }),
                  ...(managerName != null && { managerName }),
                  ...(contactPhone != null && { contactPhone }),
                  ...(contactEmail != null && { contactEmail }),
                },
              })
              .then(() => prisma.warehouse.findUnique({ where: { id: warehouse!.id }, include: includeOrg }))
              .then((updated) => {
                if (updated) warehouse = updated as typeof warehouse;
              })
              .catch(() => {});
          }
        } catch (fallbackErr) {
          console.error("[api/admin/warehouses POST fallback]", fallbackErr);
          return NextResponse.json(
            { error: "Database schema may be outdated. Run migrations (prisma migrate deploy) with the production DATABASE_URL." },
            { status: 500 }
          );
        }
      } else {
        throw createErr;
      }
    }
    return NextResponse.json(warehouse);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    const err = e as Error & { code?: string };
    console.error("[api/admin/warehouses POST]", err);
    const message = err?.code === "P2011"
      ? "Organization is required. Ensure Vision Latam org exists (superadmin)."
      : err?.code === "P2022" || err?.message?.includes("column")
        ? "Database schema may be outdated. Run migrations (prisma migrate deploy) with the production DATABASE_URL."
        : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
