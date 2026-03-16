import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requirePlatformSuperadmin, TenantError, tenantErrorStatus } from "@/lib/tenant";

/** GET: one country — any authenticated user. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const country = await prisma.country.findUnique({ where: { id: params.id } });
  if (!country) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(country);
}

/** PATCH: update country (e.g. isActive, name) — superadmin only. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requirePlatformSuperadmin();
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const existing = await prisma.country.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const data: { isActive?: boolean; name?: string; currency?: string } = {};
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (body?.currency != null) data.currency = String(body.currency).trim() || undefined;
  const country = await prisma.country.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(country);
}
