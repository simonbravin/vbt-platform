import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin } from "@/lib/tenant";
import { getTrainingProgramById, updateTrainingProgram, resolveTrainingModuleVisible } from "@vbt/core";
import { updateTrainingProgramSchema } from "@vbt/core/validation";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (ctx.isPlatformSuperadmin) {
    const p = await getTrainingProgramById(prisma, params.id, { admin: true });
    if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(p);
  }

  if (!ctx.activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const moduleOk = await resolveTrainingModuleVisible(prisma, ctx.activeOrgId);
  if (!moduleOk) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const p = await getTrainingProgramById(prisma, params.id, { partnerOrganizationId: ctx.activeOrgId });
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(p);
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = updateTrainingProgramSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const data = parsed.data;
  try {
    const program = await updateTrainingProgram(prisma, params.id, {
      title: data.title,
      description: data.description,
      level: data.level,
      status: data.status,
      durationHours: data.durationHours,
      visibility: data.visibility,
      publishedAt:
        data.publishedAt === undefined
          ? undefined
          : data.publishedAt === null
            ? null
            : new Date(data.publishedAt),
      allowedOrganizationIds: data.allowedOrganizationIds,
    });
    return NextResponse.json(program);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
