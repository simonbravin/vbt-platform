import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin } from "@/lib/tenant";
import {
  listQuizDefinitionsAdmin,
  createQuizDefinition,
  listVisibleQuizDefinitionsForPartner,
  resolveTrainingModuleVisible,
} from "@vbt/core";
import { createQuizDefinitionSchema } from "@vbt/core/validation";
import { withSaaSHandler } from "@/lib/saas-handler";

async function getHandler(_req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (ctx.isPlatformSuperadmin) {
    const defs = await listQuizDefinitionsAdmin(prisma);
    return NextResponse.json(defs);
  }
  if (!ctx.activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const moduleOk = await resolveTrainingModuleVisible(prisma, ctx.activeOrgId);
  if (!moduleOk) return NextResponse.json([]);
  const defs = await listVisibleQuizDefinitionsForPartner(prisma, ctx.activeOrgId);
  return NextResponse.json(defs);
}

async function postHandler(req: Request) {
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = createQuizDefinitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const def = await createQuizDefinition(prisma, {
      title: d.title,
      description: d.description,
      passingScorePct: d.passingScorePct,
      status: d.status,
      publishedAt: d.publishedAt ? new Date(d.publishedAt) : d.publishedAt === null ? null : undefined,
      visibility: d.visibility,
      topicRules: d.topicRules,
      allowedOrganizationIds: d.allowedOrganizationIds,
    });
    return NextResponse.json(def, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);
export const POST = withSaaSHandler({ rateLimitTier: "create_update" }, postHandler);
