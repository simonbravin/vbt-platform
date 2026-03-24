import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getTenantContext } from "@/lib/tenant";
import { submitQuizAttempt, issueQuizCertificate } from "@vbt/core";
import { submitQuizAttemptSchema } from "@vbt/core/validation";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getTenantContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ctx.activeOrgId) {
    return NextResponse.json({ error: "No active organization" }, { status: 403 });
  }
  const body = await req.json();
  const parsed = submitQuizAttemptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 });
  }
  const tenantCtx = {
    userId: ctx.userId,
    organizationId: ctx.activeOrgId,
    isPlatformSuperadmin: ctx.isPlatformSuperadmin,
  };
  try {
    const attempt = await submitQuizAttempt(prisma, tenantCtx, params.id, parsed.data.answers);
    if (attempt.passed) {
      const userRow = await prisma.user.findUnique({
        where: { id: attempt.userId },
        select: { fullName: true },
      });
      const orgRow = await prisma.organization.findUnique({
        where: { id: attempt.organizationId },
        select: { name: true },
      });
      const title = (attempt as { quizDefinition?: { title?: string } }).quizDefinition?.title ?? "Quiz";
      await issueQuizCertificate(prisma, {
        quizAttemptId: attempt.id,
        userId: attempt.userId,
        organizationId: attempt.organizationId,
        titleSnapshot: title,
        participantNameSnapshot: userRow?.fullName ?? "",
        orgNameSnapshot: orgRow?.name ?? "",
        metadataJson: { scorePct: attempt.scorePct, passed: true },
      });
    }
    return NextResponse.json(attempt);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
