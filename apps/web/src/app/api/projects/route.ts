import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { createAuditLog } from "@/lib/audit";

const createSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  client: z.string().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  wallAreaM2S80: z.number().min(0).optional().default(0),
  wallAreaM2S150: z.number().min(0).optional().default(0),
  wallAreaM2S200: z.number().min(0).optional().default(0),
  kitsPerContainer: z.number().min(0).optional().default(0),
  numContainers: z.number().min(0).optional().default(0),
  totalKits: z.number().min(0).optional().default(0),
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
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { client: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      include: { _count: { select: { quotes: true } } },
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

  const { wallAreaM2S80, wallAreaM2S150, wallAreaM2S200, ...rest } = parsed.data;
  const wallAreaM2Total = (wallAreaM2S80 ?? 0) + (wallAreaM2S150 ?? 0) + (wallAreaM2S200 ?? 0);

  const project = await prisma.project.create({
    data: {
      ...rest,
      orgId: user.orgId,
      wallAreaM2S80: wallAreaM2S80 ?? 0,
      wallAreaM2S150: wallAreaM2S150 ?? 0,
      wallAreaM2S200: wallAreaM2S200 ?? 0,
      wallAreaM2Total,
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
