import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext, requirePlatformSuperadmin } from "@/lib/tenant";
import {
  getLiveSessionById,
  updateLiveSession,
  assertPartnerCanAccessLiveSession,
  resolveTrainingModuleVisible,
} from "@vbt/core";
import { updateLiveSessionSchema } from "@vbt/core/validation";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (ctx.isPlatformSuperadmin) {
    const s = await getLiveSessionById(prisma, params.id);
    if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(s);
  }

  if (!ctx.activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const moduleOk = await resolveTrainingModuleVisible(prisma, ctx.activeOrgId);
  if (!moduleOk) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const s = await assertPartnerCanAccessLiveSession(prisma, params.id, ctx.activeOrgId);
    return NextResponse.json(s);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  await requirePlatformSuperadmin();
  const body = await req.json();
  const parsed = updateLiveSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const session = await updateLiveSession(prisma, params.id, {
      title: d.title,
      description: d.description,
      startsAt: d.startsAt ? new Date(d.startsAt) : undefined,
      endsAt: d.endsAt === undefined ? undefined : d.endsAt === null ? null : new Date(d.endsAt),
      meetingUrl: d.meetingUrl,
      status: d.status,
    });
    return NextResponse.json(session);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
