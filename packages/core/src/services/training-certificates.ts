import type { PrismaClient, TrainingCertificate } from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";

export async function issueLiveSessionCertificate(
  prisma: PrismaClient,
  input: {
    userId: string;
    organizationId: string;
    liveSessionId: string;
    titleSnapshot: string;
    participantNameSnapshot: string;
    orgNameSnapshot: string;
    metadataJson?: object | null;
  }
): Promise<TrainingCertificate> {
  const dedupeKey = `live:${input.liveSessionId}:${input.userId}`;
  const existing = await prisma.trainingCertificate.findUnique({ where: { dedupeKey } });
  if (existing) return existing;

  return prisma.trainingCertificate.create({
    data: {
      type: "live_session",
      userId: input.userId,
      organizationId: input.organizationId,
      liveSessionId: input.liveSessionId,
      titleSnapshot: input.titleSnapshot,
      participantNameSnapshot: input.participantNameSnapshot,
      orgNameSnapshot: input.orgNameSnapshot,
      metadataJson: input.metadataJson ?? undefined,
      dedupeKey,
    },
  });
}

export async function issueQuizCertificate(
  prisma: PrismaClient,
  input: {
    quizAttemptId: string;
    userId: string;
    organizationId: string;
    titleSnapshot: string;
    participantNameSnapshot: string;
    orgNameSnapshot: string;
    metadataJson?: object | null;
  }
): Promise<TrainingCertificate> {
  const dedupeKey = `quiz:${input.quizAttemptId}`;
  const existing = await prisma.trainingCertificate.findUnique({ where: { dedupeKey } });
  if (existing) return existing;

  return prisma.trainingCertificate.create({
    data: {
      type: "quiz",
      userId: input.userId,
      organizationId: input.organizationId,
      quizAttemptId: input.quizAttemptId,
      titleSnapshot: input.titleSnapshot,
      participantNameSnapshot: input.participantNameSnapshot,
      orgNameSnapshot: input.orgNameSnapshot,
      metadataJson: input.metadataJson ?? undefined,
      dedupeKey,
    },
  });
}

export async function listCertificatesForUser(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: { limit?: number; offset?: number } = {}
): Promise<{ certificates: TrainingCertificate[]; total: number }> {
  const orgWhere = orgScopeWhere(ctx);
  const where = {
    userId: ctx.userId,
    ...orgWhere,
  };
  const [certificates, total] = await Promise.all([
    prisma.trainingCertificate.findMany({
      where,
      orderBy: { issuedAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.trainingCertificate.count({ where }),
  ]);
  return { certificates, total };
}

export async function listCertificatesAdmin(
  prisma: PrismaClient,
  options: {
    organizationId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ certificates: TrainingCertificate[]; total: number }> {
  const where = {
    ...(options.organizationId && { organizationId: options.organizationId }),
    ...(options.userId && { userId: options.userId }),
  };
  const [certificates, total] = await Promise.all([
    prisma.trainingCertificate.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { issuedAt: "desc" },
      take: options.limit ?? 100,
      skip: options.offset ?? 0,
    }),
    prisma.trainingCertificate.count({ where }),
  ]);
  return { certificates, total };
}

export async function getCertificateById(
  prisma: PrismaClient,
  ctx: TenantContext,
  id: string,
  opts: { admin?: boolean } = {}
): Promise<TrainingCertificate | null> {
  const row = await prisma.trainingCertificate.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, fullName: true, email: true } },
      organization: { select: { id: true, name: true } },
      liveSession: {
        include: { trainingProgram: { select: { title: true } } },
      },
    },
  });
  if (!row) return null;
  if (opts.admin || ctx.isPlatformSuperadmin) return row;
  const orgOk =
    ctx.organizationId && row.organizationId === ctx.organizationId && row.userId === ctx.userId;
  if (!orgOk) return null;
  return row;
}
