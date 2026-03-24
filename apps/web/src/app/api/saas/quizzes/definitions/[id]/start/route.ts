import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { startQuizAttempt } from "@vbt/core/quiz-attempts";
import { withSaaSHandler } from "@/lib/saas-handler";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function postHandler(_req: Request, routeContext?: unknown) {
  const { params } = routeContext as Ctx;
  const { id } = params instanceof Promise ? await params : params;
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  try {
    const result = await startQuizAttempt(prisma, tenantCtx, id);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    const insufficient = msg.includes("insufficient published questions");
    return NextResponse.json(
      insufficient
        ? { error: msg, code: "QUIZ_INSUFFICIENT_PUBLISHED_QUESTIONS" }
        : { error: msg },
      { status: 400 }
    );
  }
}

export const POST = withSaaSHandler({ rateLimitTier: "create_update" }, postHandler);
