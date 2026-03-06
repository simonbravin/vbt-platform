import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const search = (url.searchParams.get("search") ?? url.searchParams.get("q") ?? "").trim();
  const systemCode = url.searchParams.get("system") ?? "";
  const minimal = url.searchParams.get("minimal") === "1";

  const where = {
    isActive: true,
    ...(search
      ? {
          OR: [
            { canonicalName: { contains: search, mode: "insensitive" as const } },
            { canonicalNameNormalized: { contains: search, mode: "insensitive" as const } },
            ...(search.length > 0 ? [{ dieNumber: { contains: search, mode: "insensitive" as const } }] : []),
          ],
        }
      : {}),
    ...(systemCode ? { systemCode: systemCode as any } : {}),
  };

  const pieces = minimal
    ? await prisma.pieceCatalog.findMany({
        where,
        select: { id: true, canonicalName: true, systemCode: true, dieNumber: true },
        orderBy: [{ systemCode: "asc" }, { canonicalName: "asc" }],
      })
    : await prisma.pieceCatalog.findMany({
        where,
        include: {
          costs: { orderBy: { effectiveFrom: "desc" }, take: 1 },
          system: true,
          aliases: { take: 5 },
        },
        orderBy: [{ systemCode: "asc" }, { canonicalName: "asc" }],
      });

  return NextResponse.json(pieces);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (!["SUPERADMIN", "ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const schema = z.object({
    canonicalName: z.string().min(1),
    systemCode: z.enum(["S80", "S150", "S200"]).optional(),
    usefulWidthMm: z.number().optional(),
    lbsPerMCored: z.number().optional(),
    lbsPerMUncored: z.number().optional(),
    volumePerM: z.number().optional(),
    categoryRaw: z.string().optional(),
    dieNumber: z.string().optional(),
  });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { normalizeAliasRaw } = await import("@vbt/core");
  const canonicalNameNormalized = normalizeAliasRaw(parsed.data.canonicalName);

  const piece = await prisma.pieceCatalog.create({
    data: {
      ...parsed.data,
      canonicalNameNormalized,
      usefulWidthM: parsed.data.usefulWidthMm ? parsed.data.usefulWidthMm / 1000 : undefined,
    },
  });

  return NextResponse.json(piece, { status: 201 });
}
