import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { prisma } from "@/lib/db";
import { getEffectiveActiveOrgId } from "@/lib/tenant";
import type { Prisma } from "@vbt/db";

const SYSTEM_CODES = ["S80", "S150", "S200"] as const;

/** Resolve allowed system codes + whether current user is superadmin. */
async function getCatalogContext(): Promise<{ allowedSystems: string[]; isSuperadmin: boolean } | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  const user = session.user as { isPlatformSuperadmin?: boolean };
  const activeOrgId = await getEffectiveActiveOrgId(user as import("@/lib/auth").SessionUser);
  if (user.isPlatformSuperadmin && !activeOrgId) {
    return { allowedSystems: [...SYSTEM_CODES], isSuperadmin: true };
  }
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

function pieceToResponse(p: { id: string; dieNumber: string | null; canonicalName: string; systemCode: string; usefulWidthMm: number | null; lbsPerMCored: number | null; kgPerMCored: number | null; pricePerM2Cored: number | null; isActive: boolean }) {
  return {
    ...p,
    costs: p.pricePerM2Cored != null ? [{ pricePerM2Cored: p.pricePerM2Cored }] : [],
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
    const hasSystemsParam = url.searchParams.has("systems");

    const incompleteOnly = url.searchParams.get("incomplete") === "1" || url.searchParams.get("incomplete") === "true";
    if (incompleteOnly && !ctx.isSuperadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const lite = url.searchParams.get("lite") === "1" || url.searchParams.get("lite") === "true";

    let where: Prisma.CatalogPieceWhereInput = {};
    if (!ctx.isSuperadmin) where.isActive = true;

    if (hasSystemsParam) {
      const raw = url.searchParams.get("systems")?.trim() ?? "";
      if (raw === "") {
        where.systemCode = { in: [] };
      } else {
        const requested = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((s): s is (typeof SYSTEM_CODES)[number] =>
            (SYSTEM_CODES as readonly string[]).includes(s)
          );
        const codes = requested.filter((s) => ctx.allowedSystems.includes(s));
        where.systemCode = codes.length > 0 ? { in: codes } : { in: [] };
      }
    } else if (system && ctx.allowedSystems.includes(system)) {
      where.systemCode = system;
    } else {
      where.systemCode = { in: ctx.allowedSystems };
    }
    if (search && search.length >= 1) {
      where.canonicalName = { contains: search, mode: "insensitive" };
    }

    if (incompleteOnly) {
      where = {
        AND: [where, { OR: [{ pricePerM2Cored: null }, { usefulWidthMm: null }] }],
      };
    }

    if (lite) {
      const list = await prisma.catalogPiece.findMany({
        where,
        select: { id: true, canonicalName: true, systemCode: true },
        orderBy: [{ systemCode: "asc" }, { canonicalName: "asc" }],
      });
      return NextResponse.json(list);
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
