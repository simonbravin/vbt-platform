import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  client: z.string().optional(),
  clientId: z.string().optional(),
  location: z.string().optional(),
  countryId: z.string().optional(),
  totalKits: z.number().min(1).optional().default(1),
  wallAreaM2Total: z.number().min(0).optional().default(0),
  plannedStartDate: z.string().optional(),
  durationWeeks: z.number().min(0).optional().nullable(),
  description: z.string().optional(),
  kitsPerContainer: z.number().min(0).optional().default(0),
  numContainers: z.number().min(0).optional().default(0),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = parseInt(url.searchParams.get("limit") ?? "50");
  const search = url.searchParams.get("search") ?? "";

  const where = {
    orgId: user.orgId,
    isArchived: false,
    ...(search.trim()
      ? {
          OR: [
            { name: { contains: search.trim(), mode: "insensitive" as const } },
            { client: { contains: search.trim(), mode: "insensitive" as const } },
            { clientRecord: { name: { contains: search.trim(), mode: "insensitive" as const } } },
            { location: { contains: search.trim(), mode: "insensitive" as const } },
            { country: { name: { contains: search.trim(), mode: "insensitive" as const } } },
            { country: { code: { contains: search.trim(), mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        clientRecord: { select: { id: true, name: true } },
        country: { select: { id: true, name: true, code: true } },
        baselineQuote: { select: { id: true, quoteNumber: true, fobUsd: true } },
        _count: { select: { quotes: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.project.count({ where }),
  ]);

  return NextResponse.json({ projects, total, page, limit });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as any;
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  if (parsed.data.clientId) {
    const client = await prisma.client.findFirst({
      where: { id: parsed.data.clientId, orgId: user.orgId },
    });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 });
    }
  }

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      client: parsed.data.client ?? null,
      clientId: parsed.data.clientId ?? null,
      location: parsed.data.location ?? null,
      countryId: parsed.data.countryId ?? null,
      totalKits: parsed.data.totalKits ?? 1,
      wallAreaM2Total: parsed.data.wallAreaM2Total ?? 0,
      plannedStartDate: parsed.data.plannedStartDate ? new Date(parsed.data.plannedStartDate) : null,
      durationWeeks: parsed.data.durationWeeks ?? null,
      description: parsed.data.description ?? null,
      kitsPerContainer: parsed.data.kitsPerContainer ?? 0,
      numContainers: parsed.data.numContainers ?? 0,
      orgId: user.orgId,
    },
  });

  await createAuditLog({
    orgId: user.orgId,
    userId: user.id,
    action: "PROJECT_CREATED",
    entityType: "Project",
    entityId: project.id,
  });

  return NextResponse.json(project, { status: 201 });
}
