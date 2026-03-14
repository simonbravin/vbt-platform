import type {
  PrismaClient,
  TrainingProgram,
  TrainingEnrollment,
  TrainingEnrollmentStatus,
} from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";

/**
 * Training programs are platform-wide. Enrollments are per-organization and user.
 */
export async function listTrainingPrograms(
  prisma: PrismaClient,
  options: { status?: string } = {}
): Promise<TrainingProgram[]> {
  const where = options.status ? { status: options.status } : {};
  return prisma.trainingProgram.findMany({
    where,
    include: {
      modules: { orderBy: { sortOrder: "asc" } },
      _count: { select: { enrollments: true } },
    },
    orderBy: { title: "asc" },
  });
}

export async function getTrainingProgramById(
  prisma: PrismaClient,
  programId: string
): Promise<TrainingProgram | null> {
  return prisma.trainingProgram.findUnique({
    where: { id: programId },
    include: { modules: { orderBy: { sortOrder: "asc" } } },
  });
}

export type ListEnrollmentsOptions = {
  userId?: string;
  programId?: string;
  status?: TrainingEnrollmentStatus;
  limit?: number;
  offset?: number;
};

export async function listTrainingEnrollments(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: ListEnrollmentsOptions = {}
): Promise<{ enrollments: TrainingEnrollment[]; total: number }> {
  const orgWhere = orgScopeWhere(ctx);
  const where = {
    ...orgWhere,
    ...(options.userId && { userId: options.userId }),
    ...(options.programId && { trainingProgramId: options.programId }),
    ...(options.status && { status: options.status }),
  };
  const [enrollments, total] = await Promise.all([
    prisma.trainingEnrollment.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        trainingProgram: { select: { id: true, title: true, durationHours: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.trainingEnrollment.count({ where }),
  ]);
  return { enrollments, total };
}

export async function enrollInProgram(
  prisma: PrismaClient,
  ctx: TenantContext,
  programId: string,
  userId?: string
): Promise<TrainingEnrollment> {
  const organizationId = ctx.organizationId ?? undefined;
  if (!organizationId && !ctx.isPlatformSuperadmin) {
    throw new Error("Organization context required to enroll");
  }
  const targetUser = userId ?? ctx.userId;
  const orgId = organizationId!;
  return prisma.trainingEnrollment.upsert({
    where: {
      organizationId_userId_trainingProgramId: {
        organizationId: orgId,
        userId: targetUser,
        trainingProgramId: programId,
      },
    },
    update: {},
    create: {
      organizationId: orgId,
      userId: targetUser,
      trainingProgramId: programId,
      status: "not_started",
    },
  });
}

export async function updateEnrollmentProgress(
  prisma: PrismaClient,
  ctx: TenantContext,
  enrollmentId: string,
  data: { progressPct?: number; status?: TrainingEnrollmentStatus; completedAt?: Date | null }
) {
  const orgWhere = orgScopeWhere(ctx);
  await prisma.trainingEnrollment.findFirstOrThrow({
    where: { id: enrollmentId, ...orgWhere },
  });
  return prisma.trainingEnrollment.update({
    where: { id: enrollmentId },
    data: {
      ...(data.progressPct != null && { progressPct: data.progressPct }),
      ...(data.status != null && { status: data.status }),
      ...(data.completedAt !== undefined && { completedAt: data.completedAt }),
      ...(data.status === "in_progress" && { startedAt: new Date() }),
      ...(data.status === "completed" && { completedAt: new Date() }),
    },
  });
}
