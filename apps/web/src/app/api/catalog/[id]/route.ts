import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const updateSchema = z.object({
  canonicalName: z.string().optional(),
  systemCode: z.enum(["S80", "S150", "S200"]).nullable().optional(),
  usefulWidthMm: z.number().optional(),
  lbsPerMCored: z.number().optional(),
  lbsPerMUncored: z.number().optional(),
  volumePerM: z.number().optional(),
  isActive: z.boolean().optional(),
  // Cost update
  pricePerMCored: z.number().optional(),
  pricePerFtCored: z.number().optional(),
  pricePer5000ftCored: z.number().optional(),
}).partial();

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const piece = await prisma.pieceCatalog.findUnique({
    where: { id: params.id },
    include: { costs: { orderBy: { effectiveFrom: "desc" } }, aliases: true, system: true },
  });
  if (!piece) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(piece);
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const { pricePerMCored, pricePerFtCored, pricePer5000ftCored, usefulWidthMm, ...pieceData } = parsed.data;

  const piece = await prisma.pieceCatalog.update({
    where: { id: params.id },
    data: {
      ...pieceData,
      usefulWidthM: usefulWidthMm ? usefulWidthMm / 1000 : undefined,
      usefulWidthMm,
    },
  });

  // Update cost if provided
  if (pricePerMCored !== undefined || pricePerFtCored !== undefined || pricePer5000ftCored !== undefined) {
    await prisma.pieceCost.upsert({
      where: { id: `import-${params.id}` },
      update: {
        pricePerMCored: pricePerMCored ?? undefined,
        pricePerFtCored: pricePerFtCored ?? undefined,
        pricePer5000ftCored: pricePer5000ftCored ?? undefined,
      },
      create: {
        id: `import-${params.id}`,
        pieceId: params.id,
        pricePerMCored: pricePerMCored ?? 0,
        pricePerFtCored: pricePerFtCored ?? 0,
        pricePer5000ftCored: pricePer5000ftCored ?? 0,
      },
    });

    await createAuditLog({
      orgId: user.orgId,
      userId: user.id,
      action: "COST_UPDATED",
      entityType: "PieceCatalog",
      entityId: params.id,
      meta: { pricePerMCored, pricePerFtCored },
    });
  }

  return NextResponse.json(piece);
}
