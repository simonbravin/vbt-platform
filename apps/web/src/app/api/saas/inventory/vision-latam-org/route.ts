import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { getVisionLatamOrganizationId } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler() {
  await requirePlatformSuperadmin();
  const vlId = await getVisionLatamOrganizationId(prisma);
  if (vlId) {
    const org = await prisma.organization.findUnique({
      where: { id: vlId },
      select: { id: true, name: true },
    });
    return NextResponse.json({ organization: org });
  }
  return NextResponse.json(
    { error: "Platform not configured: Vision Latam organization is missing. Run database migrations (prisma migrate deploy)." },
    { status: 503 }
  );
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);
