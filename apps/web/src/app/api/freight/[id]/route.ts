import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveActiveOrgId, requireSession, TenantError, tenantErrorStatus } from "@/lib/tenant";

async function getProfileAndCheckAccess(id: string, isSuperadmin: boolean, activeOrgId: string | null) {
  const profile = await prisma.freightProfile.findUnique({
    where: { id },
    include: { country: true, organization: { select: { id: true, name: true } } },
  });
  if (!profile) return { profile: null, error: "Not found" as const };
  if (isSuperadmin) return { profile, error: null };
  if (profile.organizationId === null) return { profile: null, error: "Partners cannot edit platform base rates" as const };
  if (profile.organizationId !== activeOrgId) return { profile: null, error: "Forbidden" as const };
  return { profile, error: null };
}

/** GET: one freight profile — if partner, only base or their own. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  let user;
  try {
    user = await requireSession();
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const profile = await prisma.freightProfile.findUnique({
    where: { id: params.id },
    include: { country: true, organization: { select: { id: true, name: true } } },
  });
  if (!profile) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.isPlatformSuperadmin && profile.organizationId != null) {
    const activeOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);
    if (profile.organizationId !== activeOrgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(profile);
}

/** PATCH: update freight profile — superadmin any; partner only their own. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  let user;
  try {
    user = await requireSession();
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isSuperadmin = !!user.isPlatformSuperadmin;
  const activeOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);
  const { profile, error } = await getProfileAndCheckAccess(params.id, isSuperadmin, activeOrgId);
  if (error) {
    if (error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error }, { status: 403 });
  }

  const body = await req.json();
  const data: {
    name?: string;
    countryId?: string;
    freightPerContainer?: number;
    isDefault?: boolean;
    expiryDate?: Date | null;
    notes?: string | null;
  } = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.countryId === "string" && body.countryId.trim()) data.countryId = body.countryId.trim();
  if (typeof body?.freightPerContainer === "number" && body.freightPerContainer >= 0) data.freightPerContainer = body.freightPerContainer;
  if (typeof body?.isDefault === "boolean") data.isDefault = body.isDefault;
  if (body?.expiryDate !== undefined) data.expiryDate = body.expiryDate ? new Date(body.expiryDate) : null;
  if (body?.notes !== undefined) data.notes = body.notes != null ? String(body.notes).trim() : null;

  const updated = await prisma.freightProfile.update({
    where: { id: params.id },
    data,
    include: { country: true, organization: { select: { id: true, name: true } } },
  });
  return NextResponse.json(updated);
}

/** DELETE: superadmin any; partner only their own. */
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  let user;
  try {
    user = await requireSession();
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isSuperadmin = !!user.isPlatformSuperadmin;
  const activeOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);
  const { error } = await getProfileAndCheckAccess(params.id, isSuperadmin, activeOrgId);
  if (error) {
    if (error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error }, { status: 403 });
  }
  await prisma.freightProfile.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
