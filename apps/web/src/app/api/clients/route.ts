import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  legalName: z.string().optional(),
  taxId: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  countryId: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string };

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const search = url.searchParams.get("search") ?? "";
  const countryId = url.searchParams.get("countryId") ?? "";

  const where: Record<string, unknown> = { orgId: user.orgId };
  if (countryId) (where as any).countryId = countryId;
  if (search.trim()) {
    (where as any).OR = [
      { name: { contains: search.trim(), mode: "insensitive" } },
      { legalName: { contains: search.trim(), mode: "insensitive" } },
      { email: { contains: search.trim(), mode: "insensitive" } },
    ];
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        country: { select: { id: true, name: true, code: true } },
        _count: { select: { projects: true } },
      },
      orderBy: { name: "asc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.client.count({ where }),
  ]);

  return NextResponse.json({ clients, total, page, limit });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { orgId: string; role: string };
  if (["VIEWER"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const client = await prisma.client.create({
    data: {
      orgId: user.orgId,
      name: parsed.data.name,
      legalName: parsed.data.legalName ?? null,
      taxId: parsed.data.taxId ?? null,
      address: parsed.data.address ?? null,
      city: parsed.data.city ?? null,
      countryId: parsed.data.countryId ?? null,
      phone: parsed.data.phone ?? null,
      email: parsed.data.email ?? null,
      website: parsed.data.website ?? null,
      notes: parsed.data.notes ?? null,
    },
    include: { country: { select: { id: true, name: true, code: true } } },
  });
  return NextResponse.json(client, { status: 201 });
}
