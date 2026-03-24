import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin } from "@/lib/tenant";
import {
  createLiveSession,
  listLiveSessionsForProgram,
  listVisibleLiveSessionsForPartnerProgram,
  resolveTrainingModuleVisible,
} from "@vbt/core";
import { createLiveSessionSchema } from "@vbt/core/validation";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (ctx.isPlatformSuperadmin) {
    const sessions = await listLiveSessionsForProgram(prisma, params.id);
    return NextResponse.json(sessions);
  }

  if (!ctx.activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const moduleOk = await resolveTrainingModuleVisible(prisma, ctx.activeOrgId);
  if (!moduleOk) return NextResponse.json([]);
  const sessions = await listVisibleLiveSessionsForPartnerProgram(prisma, params.id, ctx.activeOrgId);
  return NextResponse.json(sessions);
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = createLiveSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const d = parsed.data;
  const session = await createLiveSession(prisma, {
    trainingProgramId: params.id,
    title: d.title,
    description: d.description,
    startsAt: new Date(d.startsAt),
    endsAt: d.endsAt ? new Date(d.endsAt) : d.endsAt === null ? null : undefined,
    meetingUrl: d.meetingUrl,
    status: d.status,
  });
  return NextResponse.json(session, { status: 201 });
}
