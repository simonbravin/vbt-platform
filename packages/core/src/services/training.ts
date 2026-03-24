import type {
  PrismaClient,
  TrainingProgram,
  TrainingEnrollment,
  TrainingEnrollmentStatus,
  Prisma,
} from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";
import {
  assertPartnerOrgIds,
  resolveTrainingModuleVisible,
  trainingProgramVisibleToPartnerWhere,
} from "./training-visibility";

const programAdminInclude = {
  modules: { orderBy: { sortOrder: "asc" as const } },
  allowedOrganizations: {
    select: { organizationId: true, organization: { select: { id: true, name: true } } },
  },
  _count: { select: { enrollments: true, liveSessions: true } },
} as const;

/**
 * Superadmin / cross-tenant: all programs (optional status filter).
 */
export async function listTrainingProgramsAdmin(
  prisma: PrismaClient,
  options: { status?: string } = {}
): Promise<TrainingProgram[]> {
  const where = options.status ? { status: options.status } : {};
  return prisma.trainingProgram.findMany({
    where,
    include: programAdminInclude,
    orderBy: { title: "asc" },
  });
}

/**
 * Partner catalog: visibility + published + training module enabled (caller should check module flag first).
 */
export async function listTrainingProgramsForPartner(
  prisma: PrismaClient,
  organizationId: string,
  options: { status?: string } = {}
): Promise<TrainingProgram[]> {
  const vis = trainingProgramVisibleToPartnerWhere(organizationId);
  const where: Prisma.TrainingProgramWhereInput = {
    ...vis,
    ...(options.status ? { status: options.status } : {}),
  };
  return prisma.trainingProgram.findMany({
    where,
    include: {
      modules: { orderBy: { sortOrder: "asc" } },
      _count: { select: { enrollments: true, liveSessions: true } },
    },
    orderBy: { title: "asc" },
  });
}

/** @deprecated Use listTrainingProgramsAdmin or listTrainingProgramsForPartner */
export async function listTrainingPrograms(
  prisma: PrismaClient,
  options: { status?: string } = {}
): Promise<TrainingProgram[]> {
  return listTrainingProgramsAdmin(prisma, options);
}

export async function getTrainingProgramById(
  prisma: PrismaClient,
  programId: string,
  opts: { admin?: boolean; partnerOrganizationId?: string } = {}
): Promise<TrainingProgram | null> {
  const row = await prisma.trainingProgram.findUnique({
    where: { id: programId },
    include: programAdminInclude,
  });
  if (!row) return null;
  if (opts.admin) return row;
  if (opts.partnerOrganizationId) {
    const ok = await prisma.trainingProgram.findFirst({
      where: { id: programId, ...trainingProgramVisibleToPartnerWhere(opts.partnerOrganizationId) },
    });
    if (!ok) return null;
  }
  return row;
}

export type CreateTrainingProgramInput = {
  title: string;
  description?: string | null;
  level?: string | null;
  status?: string;
  durationHours?: number | null;
  visibility?: Prisma.TrainingProgramCreateInput["visibility"];
  publishedAt?: Date | null;
  allowedOrganizationIds?: string[];
};

export async function createTrainingProgram(
  prisma: PrismaClient,
  input: CreateTrainingProgramInput
): Promise<TrainingProgram> {
  const { allowedOrganizationIds = [], ...rest } = input;
  await assertPartnerOrgIds(prisma, allowedOrganizationIds);
  return prisma.trainingProgram.create({
    data: {
      title: rest.title,
      description: rest.description ?? null,
      level: rest.level ?? null,
      status: rest.status ?? "active",
      durationHours: rest.durationHours ?? null,
      visibility: rest.visibility ?? "all_partners",
      publishedAt: rest.publishedAt ?? null,
      allowedOrganizations:
        allowedOrganizationIds.length > 0
          ? { create: allowedOrganizationIds.map((organizationId) => ({ organizationId })) }
          : undefined,
    },
    include: programAdminInclude,
  });
}

export type UpdateTrainingProgramInput = Partial<CreateTrainingProgramInput>;

export async function updateTrainingProgram(
  prisma: PrismaClient,
  programId: string,
  input: UpdateTrainingProgramInput
): Promise<TrainingProgram> {
  const { allowedOrganizationIds, ...rest } = input;
  if (allowedOrganizationIds) {
    await assertPartnerOrgIds(prisma, allowedOrganizationIds);
    await prisma.trainingProgramAllowedOrganization.deleteMany({ where: { trainingProgramId: programId } });
    if (allowedOrganizationIds.length > 0) {
      await prisma.trainingProgramAllowedOrganization.createMany({
        data: allowedOrganizationIds.map((organizationId) => ({
          trainingProgramId: programId,
          organizationId,
        })),
      });
    }
  }
  return prisma.trainingProgram.update({
    where: { id: programId },
    data: {
      ...(rest.title !== undefined && { title: rest.title }),
      ...(rest.description !== undefined && { description: rest.description }),
      ...(rest.level !== undefined && { level: rest.level }),
      ...(rest.status !== undefined && { status: rest.status }),
      ...(rest.durationHours !== undefined && { durationHours: rest.durationHours }),
      ...(rest.visibility !== undefined && { visibility: rest.visibility }),
      ...(rest.publishedAt !== undefined && { publishedAt: rest.publishedAt }),
    },
    include: programAdminInclude,
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
  const moduleOk = await resolveTrainingModuleVisible(prisma, orgId);
  if (!moduleOk) throw new Error("Training module is disabled for this organization");
  const program = await prisma.trainingProgram.findFirst({
    where: { id: programId, ...trainingProgramVisibleToPartnerWhere(orgId) },
  });
  if (!program) throw new Error("Program not found or not visible");
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
