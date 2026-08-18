/**
 * @deprecated Legacy client-by-id API. CANONICAL: TBD (`/api/saas/clients/[id]`).
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireModuleRouteAuth } from "@/lib/module-route-auth";
import { getEffectiveActiveOrgId, getEffectiveOrganizationId } from "@/lib/tenant";
import type { SessionUser } from "@/lib/auth";
import { z } from "zod";

async function actingOrganizationId(user: SessionUser): Promise<string | null> {
  if (user.isPlatformSuperadmin) return getEffectiveActiveOrgId(user);
  return getEffectiveOrganizationId(user);
}

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  legalName: z.string().max(500).nullable().optional(),
  taxId: z.string().max(64).nullable().optional(),
  city: z.string().optional(),
  address: z.string().max(2000).nullable().optional(),
  countryCode: z.string().nullable().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  notes: z.string().optional(),
}).partial();

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireModuleRouteAuth("clients");
  if (!auth.ok) return auth.response;
  const user = auth.user as SessionUser;
  const organizationId = await actingOrganizationId(user);
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const client = await prisma.client.findFirst({
    where: { id: params.id, organizationId },
    include: {
      _count: { select: { projects: true } },
      projects: { select: { id: true, projectName: true, status: true }, orderBy: { updatedAt: "desc" }, take: 20 },
    },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json(client);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireModuleRouteAuth("clients");
  if (!auth.ok) return auth.response;
  const user = auth.user as SessionUser;
  if (["VIEWER", "viewer"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const organizationId = await actingOrganizationId(user);
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const existing = await prisma.client.findFirst({
    where: { id: params.id, organizationId },
  });
  if (!existing) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const data = { ...parsed.data } as Record<string, unknown>;
  if (data.countryCode === "" || data.countryCode === null) data.countryCode = null;
  for (const key of ["legalName", "taxId", "address"] as const) {
    if (data[key] === "") data[key] = null;
  }

  const client = await prisma.client.update({
    where: { id: params.id },
    data: data as any,
    include: { _count: { select: { projects: true } } },
  });
  return NextResponse.json(client);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireModuleRouteAuth("clients");
  if (!auth.ok) return auth.response;
  const user = auth.user as SessionUser;
  if (["VIEWER", "viewer"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const organizationId = await actingOrganizationId(user);
  if (!organizationId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const client = await prisma.client.findFirst({
    where: { id: params.id, organizationId },
    include: { _count: { select: { projects: true, sales: true } } },
  });
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  if (client._count.projects > 0) {
    return NextResponse.json(
      { error: "Cannot delete client with linked projects. Unlink projects first." },
      { status: 400 }
    );
  }
  if (client._count.sales > 0) {
    return NextResponse.json(
      { error: "Cannot delete client with linked sales. Unlink sales first." },
      { status: 400 }
    );
  }

  try {
    await prisma.client.delete({ where: { id: params.id } });
  } catch (e) {
    console.error("[api/clients DELETE]", e);
    return NextResponse.json(
      { error: "Cannot delete this client because it is still referenced." },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true });
}
