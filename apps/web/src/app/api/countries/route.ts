import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, getEffectiveActiveOrgId, TenantError, tenantErrorStatus } from "@/lib/tenant";
import { getAllowedCountryCodes } from "@/lib/allowed-countries";

/** GET: list countries — superadmin sees all; partners see only countries assigned to their org. */
export async function GET() {
  let user;
  try {
    user = await requireSession();
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    if (user.isPlatformSuperadmin) {
      const list = await prisma.country.findMany({
        orderBy: [{ name: "asc" }],
      });
      return NextResponse.json(list);
    }
    const activeOrgId = await getEffectiveActiveOrgId(user);
    if (!activeOrgId) {
      return NextResponse.json([]);
    }
    const allowedCodes = await getAllowedCountryCodes(prisma, activeOrgId);
    if (allowedCodes.length === 0) {
      return NextResponse.json([]);
    }
    const list = await prisma.country.findMany({
      where: { code: { in: allowedCodes } },
      orderBy: [{ name: "asc" }],
    });
    return NextResponse.json(list);
  } catch (e) {
    console.error("[api/countries GET]", e);
    return NextResponse.json([]);
  }
}

/** POST: add country — superadmin only (Vision Latam sets countries). */
export async function POST(req: Request) {
  try {
    await requirePlatformSuperadmin();
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();
    const code = String(body?.code ?? "").trim().toUpperCase().slice(0, 2);
    const name = String(body?.name ?? "").trim();
    const currency = body?.currency != null ? String(body.currency).trim() : "USD";
    if (!code || !name) {
      return NextResponse.json({ error: "code and name are required" }, { status: 400 });
    }
    const country = await prisma.country.create({
      data: { code, name, currency: currency || undefined },
    });
    return NextResponse.json(country);
  } catch (e: unknown) {
    const err = e as Error & { code?: string };
    if (err?.code === "P2002") return NextResponse.json({ error: "A country with this code already exists" }, { status: 409 });
    console.error("[api/countries POST]", err);
    return NextResponse.json({ error: err?.message ?? "Failed to create country" }, { status: 500 });
  }
}
