import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError, tenantErrorStatus } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(req.url);
    const organizationIdParam = url.searchParams.get("organizationId");
    let organizationId: string | null = null;
    if (ctx.isPlatformSuperadmin && organizationIdParam) {
      organizationId = organizationIdParam;
    } else if (ctx.activeOrgId) {
      organizationId = ctx.activeOrgId;
    }
    if (!organizationId) {
      return NextResponse.json({ warehouses: [] });
    }
    const warehouses = await prisma.warehouse.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ warehouses });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    console.error("[api/saas/warehouses GET]", e);
    return NextResponse.json({ warehouses: [] });
  }
}

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
    if (ctx.isPlatformSuperadmin && body.organizationId) {
      organizationId = body.organizationId;
    } else if (ctx.activeOrgId) {
      organizationId = ctx.activeOrgId;
    }
    if (!organizationId) {
      return NextResponse.json({ error: "No organization context" }, { status: 400 });
    }
    const warehouse = await prisma.warehouse.create({
      data: { organizationId, name, location, countryCode, address, managerName },
    });
    return NextResponse.json(warehouse);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    console.error("[api/saas/warehouses POST]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
