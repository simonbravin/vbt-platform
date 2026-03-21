import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, type SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { billingEntityOrganizationIdIfManageable, canManageBillingEntities } from "@/lib/sales-access";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z
    .string()
    .min(1)
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, ""))
    .refine((s) => s.length > 0, "Invalid slug")
    .optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as SessionUser;
  if (!canManageBillingEntities(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = params instanceof Promise ? await params : params;

  const orgId = await billingEntityOrganizationIdIfManageable(user, id);
  if (!orgId) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }

  const data = parsed.data;
  if (data.name === undefined && data.slug === undefined && data.isActive === undefined) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const updated = await prisma.billingEntity.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
      select: { id: true, name: true, slug: true, isActive: true },
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const code = e && typeof e === "object" && "code" in e ? (e as { code: string }).code : "";
    if (code === "P2002") {
      return NextResponse.json({ error: "Slug already exists for this organization" }, { status: 409 });
    }
    console.error("[PATCH /api/sales/entities/[id]]", e);
    return NextResponse.json({ error: "Failed to update billing entity" }, { status: 500 });
  }
}
