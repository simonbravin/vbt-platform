import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { getEffectiveActiveOrgId } from "@/lib/tenant";

const SYSTEM_CODES = ["S80", "S150", "S200"] as const;

/** Resolve allowed system codes + whether current user is superadmin. */
async function getCatalogContext(): Promise<{ allowedSystems: string[]; isSuperadmin: boolean } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as { isPlatformSuperadmin?: boolean };
  if (user.isPlatformSuperadmin) return { allowedSystems: [...SYSTEM_CODES], isSuperadmin: true };

  const activeOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);
  if (!activeOrgId) return { allowedSystems: [], isSuperadmin: false };

  const profile = await prisma.partnerProfile.findUnique({
    where: { organizationId: activeOrgId },
    select: { enabledSystems: true },
  });
  const raw = profile?.enabledSystems;
  const allowed =
    raw == null || !Array.isArray(raw) || raw.length === 0
      ? [...SYSTEM_CODES]
      : raw.filter((s): s is string => typeof s === "string" && SYSTEM_CODES.includes(s as (typeof SYSTEM_CODES)[number]));
  return { allowedSystems: allowed, isSuperadmin: false };
}

function pieceToResponse(p: { id: string; dieNumber: string | null; canonicalName: string; systemCode: string; usefulWidthMm: number | null; lbsPerMCored: number | null; pricePerMCored: number | null; isActive: boolean }) {
  return {
    ...p,
    costs: p.pricePerMCored != null ? [{ pricePerMCored: p.pricePerMCored }] : [],
  };
}

/** GET: list catalog — any authenticated. Partners only see pieces for their enabled systems (S80/S150/S200). */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const ctx = await getCatalogContext();
    if (ctx === null) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (ctx.allowedSystems.length === 0) return NextResponse.json([]);

    const url = new URL(req.url);
    const search = url.searchParams.get("search")?.trim() ?? url.searchParams.get("q")?.trim();
    const system = url.searchParams.get("system")?.trim();

    const where: {
      isActive?: boolean;
      systemCode?: string | { in: string[] };
      canonicalName?: { contains: string; mode: "insensitive" };
    } = {};
    if (!ctx.isSuperadmin) where.isActive = true;
    where.systemCode =
      system && ctx.allowedSystems.includes(system) ? system : { in: ctx.allowedSystems };
    if (search && search.length >= 1) {
      where.canonicalName = { contains: search, mode: "insensitive" };
    }

    const list = await prisma.catalogPiece.findMany({
      where,
      orderBy: [{ systemCode: "asc" }, { canonicalName: "asc" }],
    });
    return NextResponse.json(list.map(pieceToResponse));
  } catch (e) {
    console.error("[api/catalog GET]", e);
    return NextResponse.json([]);
  }
}

/** POST: create/update catalog — superadmin only. */
export async function POST() {
  try {
    await requirePlatformSuperadmin();
  } catch {
    return NextResponse.json({ error: "Forbidden: only superadmin can modify the catalog" }, { status: 403 });
  }
  return NextResponse.json(
    { error: "Use PATCH /api/catalog/[id] to edit a piece, or POST /api/catalog/import to import Excel" },
    { status: 400 }
  );
}
