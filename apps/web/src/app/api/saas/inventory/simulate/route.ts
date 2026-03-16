import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { TenantError } from "@/lib/tenant";
import { simulateForQuote, simulateForProject } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");
  const url = new URL(req.url);
  const quoteId = url.searchParams.get("quoteId") ?? undefined;
  const projectId = url.searchParams.get("projectId") ?? undefined;
  const organizationIdsParam = url.searchParams.get("organizationIds"); // comma-separated for superadmin

  if (!quoteId && !projectId) {
    return NextResponse.json({ error: "quoteId or projectId is required" }, { status: 400 });
  }

  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  const options = organizationIdsParam && ctx.isPlatformSuperadmin
    ? { organizationIds: organizationIdsParam.split(",").map((s) => s.trim()).filter(Boolean) }
    : {};

  try {
    if (quoteId) {
      const result = await simulateForQuote(prisma, tenantCtx, quoteId, options);
      return NextResponse.json(result);
    }
    if (projectId) {
      const result = await simulateForProject(prisma, tenantCtx, projectId, options);
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "quoteId or projectId is required" }, { status: 400 });
  } catch (e) {
    console.error("[api/saas/inventory/simulate]", e);
    return NextResponse.json({ error: "Simulation failed" }, { status: 500 });
  }
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);
