import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveActiveOrgId, requireSession, TenantError, tenantErrorStatus } from "@/lib/tenant";

async function getSetAndCheckAccess(id: string, isSuperadmin: boolean, activeOrgId: string | null) {
  const set = await prisma.taxRuleSet.findUnique({
    where: { id },
    include: { country: true, organization: { select: { id: true, name: true } } },
  });
  if (!set) return { set: null, error: "Not found" as const };
  if (isSuperadmin) return { set, error: null };
  if (set.organizationId === null) return { set: null, error: "Partners cannot edit platform base tax rules" as const };
  if (set.organizationId !== activeOrgId) return { set: null, error: "Forbidden" as const };
  return { set, error: null };
}

function withRules<T extends { rulesJson: unknown }>(obj: T) {
  return { ...obj, rules: obj.rulesJson };
}

/** GET: one tax rule set. */
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
  const set = await prisma.taxRuleSet.findUnique({
    where: { id: params.id },
    include: { country: true, organization: { select: { id: true, name: true } } },
  });
  if (!set) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!user.isPlatformSuperadmin && set.organizationId != null) {
    const activeOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);
    if (set.organizationId !== activeOrgId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(withRules(set));
}

/** PATCH: update tax rule set — superadmin any; partner only their own (e.g. override %). */
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
  const { set, error } = await getSetAndCheckAccess(params.id, isSuperadmin, activeOrgId);
  if (error) {
    if (error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error }, { status: 403 });
  }

  const body = await req.json();
  const data: { name?: string; countryId?: string; rulesJson?: object } = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.countryId === "string" && body.countryId.trim()) data.countryId = body.countryId.trim();
  if (Array.isArray(body?.rules)) {
    data.rulesJson = body.rules.map((r: { order?: number; label?: string; base?: string; ratePct?: number; fixedAmount?: number; note?: string }, i: number) => ({
      order: typeof r.order === "number" ? r.order : i + 1,
      label: typeof r.label === "string" ? r.label : "",
      base: typeof r.base === "string" ? r.base : "CIF",
      ratePct: typeof r.ratePct === "number" ? r.ratePct : 0,
      fixedAmount: typeof r.fixedAmount === "number" ? r.fixedAmount : 0,
      note: r.note != null ? String(r.note) : undefined,
    })) as object;
  }

  const updated = await prisma.taxRuleSet.update({
    where: { id: params.id },
    data,
    include: { country: true, organization: { select: { id: true, name: true } } },
  });
  return NextResponse.json(withRules(updated));
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
  const { error } = await getSetAndCheckAccess(params.id, isSuperadmin, activeOrgId);
  if (error) {
    if (error === "Not found") return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ error }, { status: 403 });
  }
  await prisma.taxRuleSet.delete({ where: { id: params.id } });
  return new NextResponse(null, { status: 204 });
}
