import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformSuperadmin } from "@/lib/tenant";
import { listCertificatesAdmin } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(req: Request) {
  await requirePlatformSuperadmin();
  const url = new URL(req.url);
  const result = await listCertificatesAdmin(prisma, {
    organizationId: url.searchParams.get("organizationId") ?? undefined,
    userId: url.searchParams.get("userId") ?? undefined,
    limit: Number(url.searchParams.get("limit")) || 100,
    offset: Number(url.searchParams.get("offset")) || 0,
  });
  return NextResponse.json(result);
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);
