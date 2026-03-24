import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { listQuizAttemptsForUser } from "@vbt/core/quiz-attempts";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.activeOrgId && !ctx.isPlatformSuperadmin) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const url = new URL(req.url);
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  const result = await listQuizAttemptsForUser(prisma, tenantCtx, {
    quizDefinitionId: url.searchParams.get("quizDefinitionId") ?? undefined,
    limit: Number(url.searchParams.get("limit")) || 50,
    offset: Number(url.searchParams.get("offset")) || 0,
  });
  return NextResponse.json(result);
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);
