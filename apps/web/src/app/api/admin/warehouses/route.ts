import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError, tenantErrorStatus } from "@/lib/tenant";

/** GET: list warehouses — superadmin sees all (with org); partner sees their org's. Returns plain array for admin UI. */
export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (ctx.isPlatformSuperadmin) {
      const list = await prisma.warehouse.findMany({
        include: { organization: { select: { id: true, name: true } } },
        orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** POST: create warehouse — uses active org (or body.organizationId for superadmin). */
export async function POST(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const location = typeof body.location === "string" ? body.location.trim() || null : null;
    if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

    let organizationId: string | null = null;
    if (ctx.isPlatformSuperadmin && body.organizationId) {
      organizationId = body.organizationId;
    } else if (ctx.activeOrgId) {
      organizationId = ctx.activeOrgId;
    }
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization required. As superadmin, set active org or pass organizationId in body." },
        { status: 400 }
      );
    }

    const warehouse = await prisma.warehouse.create({
      data: { organizationId, name, location },
      include: { organization: { select: { id: true, name: true } } },
    });
    return NextResponse.json(warehouse);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    console.error("[api/admin/warehouses POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
