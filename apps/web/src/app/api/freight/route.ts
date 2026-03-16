import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveActiveOrgId, requireSession, TenantError, tenantErrorStatus } from "@/lib/tenant";

/** GET: list freight profiles — base (Vision Latam, org null) + partner's own overrides. */
export async function GET() {
  let user;
  try {
    user = await requireSession();
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperadmin = !!user.isPlatformSuperadmin;
  const activeOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);

  if (isSuperadmin) {
    const list = await prisma.freightProfile.findMany({
      include: { country: true, organization: { select: { id: true, name: true } } },
      orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
    });
    return NextResponse.json(list);
  }

  const list = await prisma.freightProfile.findMany({
    where: {
      OR: [
        { organizationId: null },
        ...(activeOrgId ? [{ organizationId: activeOrgId }] : []),
      ],
    },
    include: { country: true, organization: { select: { id: true, name: true } } },
    orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json(list);
}

/** POST: add freight profile — superadmin can add base (org null) or any org; partner can add only their org. */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireSession();
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isSuperadmin = !!user.isPlatformSuperadmin;
  const activeOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);

  try {
    const body = await req.json();
    const name = String(body?.name ?? "").trim();
    const countryId = String(body?.countryId ?? "").trim();
    const freightPerContainer = Number(body?.freightPerContainer);
    const isDefault = !!body?.isDefault;
    const expiryDate = body?.expiryDate ? new Date(body.expiryDate) : null;
    const notes = body?.notes != null ? String(body.notes).trim() : null;

    if (!name || !countryId) {
      return NextResponse.json({ error: "name and countryId are required" }, { status: 400 });
    }
    if (Number.isNaN(freightPerContainer) || freightPerContainer < 0) {
      return NextResponse.json({ error: "freightPerContainer must be a non-negative number" }, { status: 400 });
    }

    let organizationId: string | null = body?.organizationId != null ? String(body.organizationId).trim() || null : null;

    if (isSuperadmin) {
      if (organizationId === "") organizationId = null;
    } else {
      if (!activeOrgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });
      organizationId = activeOrgId;
    }

    const profile = await prisma.freightProfile.create({
      data: {
        organizationId,
        name,
        countryId,
        freightPerContainer,
        isDefault,
        expiryDate,
        notes,
      },
      include: { country: true, organization: { select: { id: true, name: true } } },
    });
    return NextResponse.json(profile);
  } catch (e) {
    throw e;
  }
}
