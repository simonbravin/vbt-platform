import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { withSaaSHandler } from "@/lib/saas-handler";
import { CACHE_TTL } from "@/lib/cache";

/**
 * Returns the current org's sales goal (from PartnerProfile) and YTD sales for the partner dashboard KPI.
 * Only callable with an active organization (partners). Superadmin without org gets empty response.
 * ytdSales = sum of quote.totalPrice for accepted quotes in the current year.
 * Later this can use FOB (factory cost + Vision Latam commission + distribution share) when defined.
 */
async function getHandler() {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  const orgId = ctx.activeOrgId;
  if (!orgId && !ctx.isPlatformSuperadmin) {
    throw new TenantError("No active organization", "NO_ACTIVE_ORG");
  }
  if (!orgId) {
    return NextResponse.json({
      salesTargetAnnualUsd: null,
      salesTargetAnnualM2: null,
      ytdSales: 0,
    });
  }

  try {
    const startOfYear = new Date(new Date().getFullYear(), 0, 1);
    const [profile, ytdAgg] = await Promise.all([
      prisma.partnerProfile.findUnique({
        where: { organizationId: orgId },
        select: { salesTargetAnnualUsd: true, salesTargetAnnualM2: true },
      }),
      prisma.quote.aggregate({
        where: {
          organizationId: orgId,
          status: "accepted",
          createdAt: { gte: startOfYear },
        },
        _sum: { totalPrice: true },
      }),
    ]);
    const ytdSales = ytdAgg._sum.totalPrice ?? 0;
    return NextResponse.json({
      salesTargetAnnualUsd: profile?.salesTargetAnnualUsd ?? null,
      salesTargetAnnualM2: profile?.salesTargetAnnualM2 ?? null,
      ytdSales,
    });
  } catch (e) {
    console.error("[dashboard/goal]", e);
    return NextResponse.json({
      salesTargetAnnualUsd: null,
      salesTargetAnnualM2: null,
      ytdSales: 0,
    });
  }
}

export const GET = withSaaSHandler(
  { cacheTtl: CACHE_TTL.dashboard },
  async () => getHandler()
);
