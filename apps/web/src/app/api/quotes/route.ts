import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveOrganizationId } from "@/lib/tenant";
import { z } from "zod";
import { buildQuoteSnapshot, TaxRule, removeVersionPrefix } from "@vbt/core";
import { generateQuoteNumber } from "@/lib/utils";

const createSchema = z.object({
  projectId: z.string().min(1),
  costMethod: z.enum(["CSV", "M2_BY_SYSTEM", "M2_TOTAL"]),
  baseUom: z.enum(["M", "FT"]).default("M"),
  revitImportId: z.string().optional(),
  warehouseId: z.string().optional(),
  reserveStock: z.boolean().default(false),
  m2S80: z.number().min(0).default(0),
  m2S150: z.number().min(0).default(0),
  m2S200: z.number().min(0).default(0),
  m2Total: z.number().min(0).default(0),
  commissionPct: z.number().min(0).default(0),
  commissionFixed: z.number().min(0).default(0),
  commissionFixedPerKit: z.number().min(0).default(0),
  freightCostUsd: z.number().min(0).default(0),
  freightProfileId: z.string().optional(),
  numContainers: z.number().min(1).default(1),
  kitsPerContainer: z.number().min(0).default(0),
  totalKits: z.number().min(0).default(0),
  countryId: z.string().optional(),
  taxRuleSetId: z.string().optional(),
  notes: z.string().optional(),
  factoryCostUsd: z.number().min(0).optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? "";
  const projectId = url.searchParams.get("projectId") ?? "";
  const search = (url.searchParams.get("search") ?? "").trim();

  const organizationId = getEffectiveOrganizationId(user);
  if (!organizationId) return NextResponse.json([]);

  const where: any = {
    organizationId,
    ...(status ? { status: status as "draft" | "sent" | "accepted" } : {}),
    ...(projectId ? { projectId } : {}),
  };

  if (search) {
    where.OR = [
      { quoteNumber: { contains: search, mode: "insensitive" } },
      { project: { projectName: { contains: search, mode: "insensitive" } } },
      { project: { client: { name: { contains: search, mode: "insensitive" } } } },
      { project: { city: { contains: search, mode: "insensitive" } } },
    ];
  }

  const quotes = await prisma.quote.findMany({
    where,
    include: {
      project: { select: { projectName: true, id: true, client: { select: { name: true } }, city: true } },
      _count: { select: { items: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(quotes);
}

export async function POST(_req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (["VIEWER", "viewer"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(
    { error: "Quote create (legacy CSV/Revit flow) not migrated; use new quote flow" },
    { status: 501 }
  );
}
