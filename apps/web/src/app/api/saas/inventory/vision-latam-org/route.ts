import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { getVisionLatamOrganizationId } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler() {
  await requirePlatformSuperadmin();
  let vlId = await getVisionLatamOrganizationId(prisma);
  if (vlId) {
    const org = await prisma.organization.findUnique({
      where: { id: vlId },
      select: { id: true, name: true },
    });
    return NextResponse.json({ organization: org });
  }
  // No Vision Latam org in DB (e.g. seed not run or DB cleaned). Create it for superadmin.
  const created = await prisma.organization.create({
    data: {
      name: "Vision Latam",
      legalName: "Vision Latam",
      organizationType: "vision_latam",
      status: "active",
    },
    select: { id: true, name: true },
  });
  return NextResponse.json({ organization: created });
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);
