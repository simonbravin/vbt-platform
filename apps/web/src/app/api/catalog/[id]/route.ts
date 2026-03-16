import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { prisma } from "@/lib/db";

function pieceToResponse(p: { id: string; dieNumber: string | null; canonicalName: string; systemCode: string; usefulWidthMm: number | null; lbsPerMCored: number | null; pricePerMCored: number | null; isActive: boolean }) {
  return {
    ...p,
    costs: p.pricePerMCored != null ? [{ pricePerMCored: p.pricePerMCored }] : [],
  };
}

/** GET one piece — any authenticated (partners see only if piece system is in their enabled systems). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const piece = await prisma.catalogPiece.findUnique({ where: { id: params.id } });
  if (!piece) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(pieceToResponse(piece));
}

/** PATCH: edit piece (price, usefulWidth, isActive) — superadmin only. */
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    await requirePlatformSuperadmin();
  } catch {
    return NextResponse.json({ error: "Forbidden: only superadmin can edit the catalog" }, { status: 403 });
  }

  const piece = await prisma.catalogPiece.findUnique({ where: { id: params.id } });
  if (!piece) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { pricePerMCored?: number; usefulWidthMm?: number; isActive?: boolean } = {};
  if (typeof body.pricePerMCored === "number") data.pricePerMCored = body.pricePerMCored;
  if (typeof body.usefulWidthMm === "number") data.usefulWidthMm = body.usefulWidthMm;
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  const updated = await prisma.catalogPiece.update({
    where: { id: params.id },
    data,
  });
  return NextResponse.json(pieceToResponse(updated));
}
