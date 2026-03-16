import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { getVisionLatamOrganizationId } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler() {
  await requirePlatformSuperadmin();
  const vlId = await getVisionLatamOrganizationId(prisma);
  if (!vlId) return NextResponse.json({ organization: null });
  const org = await prisma.organization.findUnique({
    where: { id: vlId },
    select: { id: true, name: true },
  });
  return NextResponse.json({ organization: org });
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);
