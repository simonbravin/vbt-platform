import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError, tenantErrorStatus } from "@/lib/tenant";

/** PATCH: update warehouse — superadmin any; partner only their org's. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const warehouse = await prisma.warehouse.findUnique({ where: { id: params.id } });
    if (!warehouse) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!ctx.isPlatformSuperadmin && warehouse.organizationId !== ctx.activeOrgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const location = typeof body.location === "string" ? body.location.trim() || null : undefined;
    const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim() || null : undefined;
    const address = typeof body.address === "string" ? body.address.trim() || null : undefined;
    const managerName = typeof body.managerName === "string" ? body.managerName.trim() || null : undefined;
    const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;

    const updated = await prisma.warehouse.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(location !== undefined && { location }),
        ...(countryCode !== undefined && { countryCode }),
        ...(address !== undefined && { address }),
        ...(managerName !== undefined && { managerName }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { organization: { select: { id: true, name: true } } },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    console.error("[api/admin/warehouses PATCH]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE: superadmin any; partner only their org's. */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const warehouse = await prisma.warehouse.findUnique({ where: { id: params.id } });
    if (!warehouse) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (!ctx.isPlatformSuperadmin && warehouse.organizationId !== ctx.activeOrgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.warehouse.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    console.error("[api/admin/warehouses DELETE]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
