import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, TenantError } from "@/lib/tenant";
import { pruneZeroInventoryLevels } from "@vbt/core";
import { withSaaSHandler } from "@/lib/saas-handler";

async function postHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) throw new TenantError("Unauthorized", "UNAUTHORIZED");

  const body = await req.json().catch(() => ({}));
  const orgFromBody =
    typeof body.organizationId === "string" && body.organizationId.trim() ? body.organizationId.trim() : undefined;

  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId ?? null,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };

  try {
    const result = await pruneZeroInventoryLevels(prisma, tenantCtx, {
      organizationId: orgFromBody,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Prune failed";
    if (message.includes("organizationId is required")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    throw e;
  }
}

export const POST = withSaaSHandler({ rateLimitTier: "create_update", module: "inventory" }, postHandler);
