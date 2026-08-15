import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, getSessionUser, getEffectiveOrganizationId, isPlatformOperatorContext, TenantError, tenantErrorStatus } from "@/lib/tenant";

async function getOrgId(ctx: Awaited<ReturnType<typeof getTenantContext>>, bodyOrganizationId?: string): Promise<string | null> {
  if (!ctx) return null;
  if (isPlatformOperatorContext(ctx) && bodyOrganizationId) return bodyOrganizationId;
  const user = await getSessionUser();
  return ctx.activeOrgId ?? (user ? getEffectiveOrganizationId(user) : null);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const warehouse = await prisma.warehouse.findUnique({ where: { id: params.id } });
    if (!warehouse) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const orgId = await getOrgId(ctx);
    if (!orgId || warehouse.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const location = typeof body.location === "string" ? body.location.trim() || null : undefined;
    const countryCode = typeof body.countryCode === "string" ? body.countryCode.trim() || null : undefined;
    const address = typeof body.address === "string" ? body.address.trim() || null : undefined;
    const managerName = typeof body.managerName === "string" ? body.managerName.trim() || null : undefined;
    const contactPhone = typeof body.contactPhone === "string" ? body.contactPhone.trim() || null : undefined;
    const contactEmail = typeof body.contactEmail === "string" ? body.contactEmail.trim() || null : undefined;
    const isActive = typeof body.isActive === "boolean" ? body.isActive : undefined;
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (location !== undefined) data.location = location;
    if (countryCode !== undefined) data.countryCode = countryCode;
    if (address !== undefined) data.address = address;
    if (managerName !== undefined) data.managerName = managerName;
    if (contactPhone !== undefined) data.contactPhone = contactPhone;
    if (contactEmail !== undefined) data.contactEmail = contactEmail;
    if (isActive !== undefined) data.isActive = isActive;
    const updated = await prisma.warehouse.update({
      where: { id: params.id },
      data,
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    console.error("[api/saas/warehouses PATCH]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const ctx = await getTenantContext();
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const warehouse = await prisma.warehouse.findUnique({ where: { id: params.id } });
    if (!warehouse) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const orgId = await getOrgId(ctx);
    if (!orgId || warehouse.organizationId !== orgId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.warehouse.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TenantError) {
      return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    }
    console.error("[api/saas/warehouses DELETE]", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
