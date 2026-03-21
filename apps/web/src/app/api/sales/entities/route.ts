import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEffectiveOrganizationId } from "@/lib/tenant";
import {
  canManageBillingEntities,
  requireSalesScopedOrganizationId,
  resolveOrganizationIdForSaleCreate,
} from "@/lib/sales-access";
import { ensureBillingEntities } from "@/lib/partner-sales";
import { z } from "zod";

const postBodySchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, ""))
    .refine((s) => s.length > 0, "Invalid slug"),
  organizationId: z.string().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  const url = new URL(req.url);
  const includeInactive = url.searchParams.get("includeInactive") === "1";

  if (!user.isPlatformSuperadmin) {
    const organizationId = getEffectiveOrganizationId(user);
    if (!organizationId) return NextResponse.json([]);
    await ensureBillingEntities(organizationId);
    const list = await prisma.billingEntity.findMany({
      where: { organizationId, ...(includeInactive ? {} : { isActive: true }) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, isActive: true },
    });
    return NextResponse.json(list);
  }

  const scoped = await requireSalesScopedOrganizationId(user, url);
  if (!scoped.ok) {
    return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  }
  await ensureBillingEntities(scoped.organizationId);
  const list = await prisma.billingEntity.findMany({
    where: { organizationId: scoped.organizationId, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true, isActive: true },
  });
  return NextResponse.json(list);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!canManageBillingEntities(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const url = new URL(req.url);
  const orgResolved = await resolveOrganizationIdForSaleCreate(user, url, parsed.data.organizationId);
  if (!orgResolved.ok) {
    return NextResponse.json({ error: orgResolved.error }, { status: orgResolved.status });
  }

  const name = parsed.data.name.trim();
  const slug = parsed.data.slug;

  try {
    const created = await prisma.billingEntity.create({
      data: {
        organizationId: orgResolved.organizationId,
        name,
        slug,
        isActive: true,
      },
      select: { id: true, name: true, slug: true, isActive: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2002") {
      return NextResponse.json({ error: "Slug already exists for this organization" }, { status: 409 });
    }
    console.error("[POST /api/sales/entities]", e);
    return NextResponse.json({ error: "Failed to create billing entity" }, { status: 500 });
  }
}
