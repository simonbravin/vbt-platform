/**
 * @deprecated Legacy clients API. There is no `/api/saas/clients` yet — do not remove until canonical clients API exists.
 */
import { NextResponse } from "next/server";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireModuleRouteAuth } from "@/lib/module-route-auth";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import { createActivityLog } from "@/lib/audit";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  legalName: z.string().max(500).optional(),
  taxId: z.string().max(64).optional(),
  city: z.string().optional(),
  address: z.string().max(2000).optional(),
  countryCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  const auth = await requireModuleRouteAuth("clients");
  if (!auth.ok) return auth.response;
  const user = auth.user as SessionUser;
  const url = new URL(req.url);
  const paramOrg = url.searchParams.get("organizationId")?.trim();
  const actingOrgId = await getEffectiveActiveOrgId(user);
  const organizationId = user.isPlatformSuperadmin
    ? paramOrg || actingOrgId
    : getEffectiveOrganizationId(user);
  if (!organizationId) return NextResponse.json({ clients: [], total: 0, page: 1, limit: 50 });

  const page = parseInt(url.searchParams.get("page") ?? "1");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);
  const search = url.searchParams.get("search") ?? "";
  const countryCode = url.searchParams.get("countryCode") ?? url.searchParams.get("countryId") ?? "";

  const where: Record<string, unknown> = { organizationId };
  if (countryCode) (where as any).countryCode = countryCode;
  if (search.trim()) {
    const q = search.trim();
    (where as any).OR = [
      { name: { contains: q, mode: "insensitive" } },
      { legalName: { contains: q, mode: "insensitive" } },
      { taxId: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
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
  const auth = await requireModuleRouteAuth("clients");
  if (!auth.ok) return auth.response;
  const user = auth.user as SessionUser;
  if (["VIEWER", "viewer"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const organizationId = user.isPlatformSuperadmin
    ? await getEffectiveActiveOrgId(user)
    : getEffectiveOrganizationId(user);
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  try {
    const userWithId = user as { id?: string };
    const client = await prisma.client.create({
      data: {
        organizationId,
        name: parsed.data.name,
        legalName: parsed.data.legalName?.trim() || null,
        clientType: "developer",
        taxId: parsed.data.taxId?.trim() || null,
        city: parsed.data.city ?? null,
        address: parsed.data.address?.trim() || null,
        countryCode: parsed.data.countryCode ?? null,
        phone: parsed.data.phone ?? null,
        email: parsed.data.email ?? null,
        website: parsed.data.website?.trim() || null,
        notes: parsed.data.notes?.trim() || null,
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
