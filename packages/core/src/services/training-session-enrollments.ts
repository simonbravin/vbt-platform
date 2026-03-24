import type { PrismaClient, TrainingSessionEnrollment, TrainingSessionEnrollmentStatus } from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";
import { resolveTrainingModuleVisible } from "./training-visibility";
import { assertPartnerCanAccessLiveSession } from "./training-sessions";
import { issueLiveSessionCertificate } from "./training-certificates";

const enrollmentInclude = {
  user: { select: { id: true, fullName: true, email: true } },
  organization: { select: { id: true, name: true } },
  liveSession: {
    include: {
      trainingProgram: { select: { id: true, title: true } },
    },
  },
} as const;

export async function enrollInLiveSession(
  prisma: PrismaClient,
  ctx: TenantContext,
  liveSessionId: string,
  userId?: string
): Promise<TrainingSessionEnrollment> {
  const organizationId = ctx.organizationId ?? undefined;
  if (!organizationId && !ctx.isPlatformSuperadmin) {
    throw new Error("Organization context required to enroll");
  }
  const orgId = organizationId!;
  const targetUser = userId ?? ctx.userId;

  const moduleOk = await resolveTrainingModuleVisible(prisma, orgId);
  if (!moduleOk) throw new Error("Training module is disabled for this organization");

  await assertPartnerCanAccessLiveSession(prisma, liveSessionId, orgId);

  return prisma.trainingSessionEnrollment.upsert({
    where: {
      organizationId_userId_liveSessionId: {
        organizationId: orgId,
        userId: targetUser,
        liveSessionId,
      },
    },
    update: { status: "registered" },
    create: {
      organizationId: orgId,
      userId: targetUser,
      liveSessionId,
      status: "registered",
    },
    include: enrollmentInclude,
  });
}

export async function cancelLiveSessionEnrollment(
  prisma: PrismaClient,
  ctx: TenantContext,
  enrollmentId: string
): Promise<TrainingSessionEnrollment> {
  const orgWhere = orgScopeWhere(ctx);
  await prisma.trainingSessionEnrollment.findFirstOrThrow({
    where: { id: enrollmentId, ...orgWhere },
  });
  return prisma.trainingSessionEnrollment.update({
    where: { id: enrollmentId },
    data: { status: "cancelled" },
    include: enrollmentInclude,
  });
}

export type ListSessionEnrollmentOptions = {
  limit?: number;
  offset?: number;
  status?: TrainingSessionEnrollmentStatus;
};

export async function listLiveSessionEnrollments(
  prisma: PrismaClient,
  liveSessionId: string,
  options: ListSessionEnrollmentOptions = {}
): Promise<{ enrollments: TrainingSessionEnrollment[]; total: number }> {
  const where = {
    liveSessionId,
    ...(options.status && { status: options.status }),
  };
  const [enrollments, total] = await Promise.all([
    prisma.trainingSessionEnrollment.findMany({
      where,
      include: enrollmentInclude,
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 200,
      skip: options.offset ?? 0,
    }),
    prisma.trainingSessionEnrollment.count({ where }),
  ]);
  return { enrollments, total };
}

export async function listMyLiveSessionEnrollments(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: ListSessionEnrollmentOptions = {}
): Promise<{ enrollments: TrainingSessionEnrollment[]; total: number }> {
  const orgWhere = orgScopeWhere(ctx);
  if (!ctx.organizationId && !ctx.isPlatformSuperadmin) {
    return { enrollments: [], total: 0 };
  }
  const where = {
    ...orgWhere,
    ...(ctx.userId && { userId: ctx.userId }),
    ...(options.status && { status: options.status }),
  };
  const [enrollments, total] = await Promise.all([
    prisma.trainingSessionEnrollment.findMany({
      where,
      include: enrollmentInclude,
      orderBy: { createdAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.trainingSessionEnrollment.count({ where }),
  ]);
  return { enrollments, total };
}

export async function markSessionAttendance(
  prisma: PrismaClient,
  enrollmentId: string,
  data: {
    status: "attended" | "no_show";
    markedByUserId: string;
  }
): Promise<TrainingSessionEnrollment> {
  const updated = await prisma.trainingSessionEnrollment.update({
    where: { id: enrollmentId },
    data: {
      status: data.status,
      attendanceMarkedAt: new Date(),
      attendanceMarkedByUserId: data.markedByUserId,
    },
    include: enrollmentInclude,
  });
  if (data.status === "attended") {
    const full = await prisma.trainingSessionEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        user: { select: { fullName: true } },
        organization: { select: { name: true } },
        liveSession: {
          include: { trainingProgram: { select: { title: true } } },
        },
      },
    });
    if (full) {
      const sessionTitle = full.liveSession.title;
      const programTitle = full.liveSession.trainingProgram?.title ?? "";
      const titleSnapshot = programTitle ? `${programTitle} — ${sessionTitle}` : sessionTitle;
      await issueLiveSessionCertificate(prisma, {
        userId: full.userId,
        organizationId: full.organizationId,
        liveSessionId: full.liveSessionId,
        titleSnapshot,
        participantNameSnapshot: full.user.fullName,
        orgNameSnapshot: full.organization.name,
        metadataJson: { attended: true },
      });
    }
  }
  return updated;
}

export async function getSessionEnrollmentById(
  prisma: PrismaClient,
  enrollmentId: string
): Promise<TrainingSessionEnrollment | null> {
  return prisma.trainingSessionEnrollment.findUnique({
    where: { id: enrollmentId },
    include: enrollmentInclude,
  });
}
