import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const settingsSchema = z.object({
  baseUom: z.enum(["M", "FT"]).optional(),
  weightUom: z.enum(["KG", "LBS"]).optional(),
  minRunFt: z.number().min(0).optional(),
  commissionPct: z.number().min(0).optional(),
  commissionFixed: z.number().min(0).optional(),
});

type QuoteDefaults = {
  baseUom?: "M" | "FT";
  weightUom?: "KG" | "LBS";
  minRunFt?: number;
  commissionPct?: number;
  commissionFixed?: number;
};

/** Resolve organization ID for the current user (session activeOrgId or first membership). */
async function resolveOrgId(userId: string, activeOrgId: string | null): Promise<string | null> {
  if (activeOrgId) return activeOrgId;
  const member = await prisma.orgMember.findFirst({
    where: { userId, status: "active" },
    select: { organizationId: true },
  });
  return member?.organizationId ?? null;
}

/** User can edit partner settings if superadmin or org_admin of their org. */
function canEditSettings(user: { role?: string; isPlatformSuperadmin?: boolean }): boolean {
  if (user.isPlatformSuperadmin) return true;
  const r = (user.role ?? "").toLowerCase();
  return r === "org_admin" || r === "admin" || r === "superadmin" || r === "owner";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id?: string; userId?: string; activeOrgId?: string | null; orgId?: string | null };

  const userId = user.id ?? user.userId;
  if (!userId) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const orgId = await resolveOrgId(userId, user.activeOrgId ?? user.orgId ?? null);
  if (!orgId) return NextResponse.json({ error: "No organization. Join or create an organization first." }, { status: 400 });

  const org = await prisma.organization.findFirst({
    where: { id: orgId },
    include: { partnerProfile: { select: { quoteDefaults: true } } },
  });
  if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

  const defaults = (org.partnerProfile as { quoteDefaults?: QuoteDefaults } | null)?.quoteDefaults as QuoteDefaults | null;
  const { partnerProfile: _, ...orgRest } = org;
  const merged = {
    ...orgRest,
    baseUom: defaults?.baseUom ?? "M",
    weightUom: defaults?.weightUom ?? "KG",
    minRunFt: defaults?.minRunFt ?? 0,
    commissionPct: defaults?.commissionPct ?? 0,
    commissionFixed: defaults?.commissionFixed ?? 0,
  };
  return NextResponse.json(merged);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { id?: string; userId?: string; activeOrgId?: string | null; orgId?: string | null; role?: string; isPlatformSuperadmin?: boolean };

  if (!canEditSettings(user)) {
    return NextResponse.json({ error: "You do not have permission to change these settings." }, { status: 403 });
  }

  const userId = user.id ?? user.userId;
  if (!userId) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const orgId = await resolveOrgId(userId, user.activeOrgId ?? user.orgId ?? null);
  if (!orgId) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const body = await req.json();
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Validation failed" }, { status: 400 });
  }

  const profile = await prisma.partnerProfile.findUnique({
    where: { organizationId: orgId },
    select: { id: true, quoteDefaults: true },
  });

  const current = (profile?.quoteDefaults as QuoteDefaults) ?? {};
  const quoteDefaults: QuoteDefaults = {
    ...current,
    ...(parsed.data.baseUom != null && { baseUom: parsed.data.baseUom }),
    ...(parsed.data.weightUom != null && { weightUom: parsed.data.weightUom }),
    ...(parsed.data.minRunFt != null && { minRunFt: parsed.data.minRunFt }),
    ...(parsed.data.commissionPct != null && { commissionPct: parsed.data.commissionPct }),
    ...(parsed.data.commissionFixed != null && { commissionFixed: parsed.data.commissionFixed }),
  };

  if (profile) {
    await prisma.partnerProfile.update({
      where: { id: profile.id },
      data: { quoteDefaults: quoteDefaults as object },
    });
  } else {
    await prisma.partnerProfile.create({
      data: {
        organizationId: orgId,
        partnerType: "commercial_partner",
        quoteDefaults: quoteDefaults as object,
      },
    });
  }

  const org = await prisma.organization.findFirst({
    where: { id: orgId },
    include: { partnerProfile: { select: { quoteDefaults: true } } },
  });
  const defaults = (org?.partnerProfile as { quoteDefaults?: QuoteDefaults } | null)?.quoteDefaults as QuoteDefaults | null;
  const { partnerProfile: __, ...orgRest } = org ?? {};
  const merged = {
    ...orgRest,
    baseUom: defaults?.baseUom ?? "M",
    weightUom: defaults?.weightUom ?? "KG",
    minRunFt: defaults?.minRunFt ?? 0,
    commissionPct: defaults?.commissionPct ?? 0,
    commissionFixed: defaults?.commissionFixed ?? 0,
  };
  return NextResponse.json(merged);
}
