import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin } from "@/lib/tenant";
import { getQuizDefinitionById, updateQuizDefinition, resolveTrainingModuleVisible } from "@vbt/core";
import { updateQuizDefinitionSchema } from "@vbt/core/validation";
import { withSaaSHandler } from "@/lib/saas-handler";

type Ctx = { params: Promise<{ id: string }> | { id: string } };

async function getHandler(_req: Request, routeContext?: unknown) {
  const { params } = routeContext as Ctx;
  const { id } = params instanceof Promise ? await params : params;
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.isPlatformSuperadmin) {
    const d = await getQuizDefinitionById(prisma, id, { admin: true });
    if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(d);
  }
  if (!ctx.activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const moduleOk = await resolveTrainingModuleVisible(prisma, ctx.activeOrgId);
  if (!moduleOk) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const d = await getQuizDefinitionById(prisma, id, { partnerOrganizationId: ctx.activeOrgId });
  if (!d) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(d);
}

async function patchHandler(req: Request, routeContext?: unknown) {
  const { params } = routeContext as Ctx;
  const { id } = params instanceof Promise ? await params : params;
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = updateQuizDefinitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const def = await updateQuizDefinition(prisma, id, {
      title: d.title,
      description: d.description,
      passingScorePct: d.passingScorePct,
      status: d.status,
      publishedAt:
        d.publishedAt === undefined
          ? undefined
          : d.publishedAt === null
            ? null
            : new Date(d.publishedAt),
      visibility: d.visibility,
      topicRules: d.topicRules,
      allowedOrganizationIds: d.allowedOrganizationIds,
    });
    return NextResponse.json(def);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Not found";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);
export const PATCH = withSaaSHandler({ rateLimitTier: "create_update" }, patchHandler);
