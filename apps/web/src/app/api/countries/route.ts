import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, requirePlatformSuperadmin, TenantError, tenantErrorStatus } from "@/lib/tenant";

/** GET: list countries — any authenticated user (partners need it for dropdowns). */
export async function GET() {
  try {
    await requireSession();
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: tenantErrorStatus(e) });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const list = await prisma.country.findMany({
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
    const err = e as { code?: string };
    if (err?.code === "P2002") return NextResponse.json({ error: "A country with this code already exists" }, { status: 409 });
    throw e;
  }
}
