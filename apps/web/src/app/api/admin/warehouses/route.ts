import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError, tenantErrorStatus } from "@/lib/tenant";

/** GET: list warehouses (legacy array format). Superadmin = Vision Latam only; partner = their org.
 *  Prefer GET /api/saas/warehouses (returns { warehouses }) with organizationId for new code. */
export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (ctx.isPlatformSuperadmin) {
      const vlOrg = await prisma.organization.findFirst({
        where: { organizationType: "vision_latam" },
        select: { id: true },
      });
      if (!vlOrg) return NextResponse.json([]);
      const list = await prisma.warehouse.findMany({
        where: { organizationId: vlOrg.id },
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
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    let organizationId: string | null = null;
    if (ctx.isPlatformSuperadmin) {
      if (body.organizationId) {
        organizationId = body.organizationId;
      } else {
        const vlOrg = await prisma.organization.findFirst({
          where: { organizationType: "vision_latam" },
          select: { id: true },
        });
        organizationId = vlOrg?.id ?? null;
      }
    } else if (ctx.activeOrgId) {
      organizationId = ctx.activeOrgId;
    }
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization required. As superadmin, Vision Latam org is used by default." },
        { status: 400 }
      );
    }

    const warehouse = await prisma.warehouse.create({
      data: { organizationId, name, location, countryCode, address, managerName },
      include: { organization: { select: { id: true, name: true } } },
    });
    return NextResponse.json(warehouse);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    console.error("[api/admin/warehouses POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
