import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveActiveOrgId, requireSession, TenantError, tenantErrorStatus } from "@/lib/tenant";

/** GET: list tax rule sets — base (org null) + partner's own overrides. */
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

  const withRules = (s: { rulesJson: unknown }) => ({ ...s, rules: s.rulesJson });

  if (isSuperadmin) {
    const list = await prisma.taxRuleSet.findMany({
      include: { country: true, organization: { select: { id: true, name: true } } },
      orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
    });
    return NextResponse.json(list.map(withRules));
  }

  const list = await prisma.taxRuleSet.findMany({
    where: {
      OR: [
        { organizationId: null },
        ...(activeOrgId ? [{ organizationId: activeOrgId }] : []),
      ],
    },
    include: { country: true, organization: { select: { id: true, name: true } } },
    orderBy: [{ country: { name: "asc" } }, { name: "asc" }],
  });
  return NextResponse.json(list.map(withRules));
}

/** POST: add tax rule set — superadmin base (org null) or any org; partner only their org (override %). */
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
    const rules = Array.isArray(body?.rules) ? body.rules : [];

    if (!name || !countryId) {
      return NextResponse.json({ error: "name and countryId are required" }, { status: 400 });
    }

    let organizationId: string | null = body?.organizationId != null ? String(body.organizationId).trim() || null : null;
    if (isSuperadmin) {
      if (organizationId === "") organizationId = null;
    } else {
      if (!activeOrgId) return NextResponse.json({ error: "No active organization" }, { status: 403 });
      organizationId = activeOrgId;
    }

    const rulesJson = rules.map((r: { order?: number; label?: string; base?: string; ratePct?: number; fixedAmount?: number; note?: string }, i: number) => ({
      order: typeof r.order === "number" ? r.order : i + 1,
      label: typeof r.label === "string" ? r.label : "",
      base: typeof r.base === "string" ? r.base : "CIF",
      ratePct: typeof r.ratePct === "number" ? r.ratePct : 0,
      fixedAmount: typeof r.fixedAmount === "number" ? r.fixedAmount : 0,
      note: r.note != null ? String(r.note) : undefined,
    }));

    const set = await prisma.taxRuleSet.create({
      data: { organizationId, name, countryId, rulesJson: rulesJson as object },
      include: { country: true, organization: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ ...set, rules: set.rulesJson });
  } catch (e) {
    throw e;
  }
}
