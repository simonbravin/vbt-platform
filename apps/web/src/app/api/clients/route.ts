import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveOrganizationId } from "@/lib/tenant";
import { createActivityLog } from "@/lib/audit";
import { z } from "zod";

// Client model has: name, clientType, countryCode, city, website, email, phone, notes. legalName, taxId, address are not in the model and are ignored if sent.
const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  city: z.string().optional(),
  countryCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { activeOrgId?: string; orgId?: string };
  const organizationId = getEffectiveOrganizationId(user);
  if (!organizationId) return NextResponse.json({ clients: [], total: 0, page: 1, limit: 50 });

  const url = new URL(req.url);
  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const search = url.searchParams.get("search") ?? "";
  const countryCode = url.searchParams.get("countryCode") ?? url.searchParams.get("countryId") ?? "";

  const where: Record<string, unknown> = { organizationId };
  if (countryCode) (where as any).countryCode = countryCode;
  if (search.trim()) {
    (where as any).OR = [
      { name: { contains: search.trim(), mode: "insensitive" } },
      { email: { contains: search.trim(), mode: "insensitive" } },
    ];
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
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
  const user = session.user as { activeOrgId?: string; orgId?: string; role?: string };
  if (["VIEWER", "viewer"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const organizationId = getEffectiveOrganizationId(user);
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const userWithId = session.user as { id?: string };
    const client = await prisma.client.create({
      data: {
        organizationId,
        name: parsed.data.name,
        clientType: "developer",
        city: parsed.data.city ?? null,
        countryCode: parsed.data.countryCode ?? null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        website: parsed.data.website ?? null,
        notes: parsed.data.notes ?? null,
      },
    });
    await createActivityLog({
      organizationId,
      userId: userWithId.id,
      action: "client_created",
      entityType: "client",
      entityId: client.id,
      metadata: { name: client.name },
    });
    return NextResponse.json(client, { status: 201 });
  } catch (e) {
    console.error("[api/clients POST]", e);
    return NextResponse.json(
      { error: "An error occurred while creating the client. Please try again." },
      { status: 500 }
    );
  }
}
