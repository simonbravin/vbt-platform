import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin } from "@/lib/tenant";
import {
  createTrainingProgram,
  listTrainingProgramsAdmin,
  listTrainingProgramsForPartner,
  resolveTrainingModuleVisible,
} from "@vbt/core";
import { createTrainingProgramSchema } from "@vbt/core/validation";
import { withSaaSHandler } from "@/lib/saas-handler";
import { createActivityLog } from "@/lib/audit";

async function getHandler(req: Request) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status") ?? undefined;

  if (ctx.isPlatformSuperadmin) {
    const programs = await listTrainingProgramsAdmin(prisma, { status });
    return NextResponse.json(programs);
  }

  if (!ctx.activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const moduleOk = await resolveTrainingModuleVisible(prisma, ctx.activeOrgId);
  if (!moduleOk) {
    return NextResponse.json([]);
  }
  const programs = await listTrainingProgramsForPartner(prisma, ctx.activeOrgId, { status });
  return NextResponse.json(programs);
}

async function postHandler(req: Request) {
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = createTrainingProgramSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const data = parsed.data;
  const program = await createTrainingProgram(prisma, {
    title: data.title,
    description: data.description,
    level: data.level,
    status: data.status,
    durationHours: data.durationHours ?? undefined,
    visibility: data.visibility,
    publishedAt: data.publishedAt ? new Date(data.publishedAt) : data.publishedAt === null ? null : undefined,
    allowedOrganizationIds: data.allowedOrganizationIds,
  });
  const user = await getTenantContext();
  if (user) {
    await createActivityLog({
      organizationId: user.activeOrgId,
      userId: user.userId,
      action: "training_program_created",
      entityType: "training_program",
      entityId: program.id,
      metadata: { title: program.title },
    });
  }
  return NextResponse.json(program, { status: 201 });
}

export const GET = withSaaSHandler({ rateLimitTier: "read" }, getHandler);
export const POST = withSaaSHandler({ rateLimitTier: "create_update" }, postHandler);
