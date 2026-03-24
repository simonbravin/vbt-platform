import type { Prisma, PrismaClient, TrainingLiveSession } from "@vbt/db";
import { trainingProgramVisibleToPartnerWhere } from "./training-visibility";

const sessionInclude = {
  trainingProgram: { select: { id: true, title: true, visibility: true } },
  _count: { select: { enrollments: true } },
} as const;

export type CreateLiveSessionInput = {
  trainingProgramId: string;
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt?: Date | null;
  meetingUrl?: string | null;
  status?: Prisma.TrainingLiveSessionCreateInput["status"];
};

export async function createLiveSession(
  prisma: PrismaClient,
  input: CreateLiveSessionInput
): Promise<TrainingLiveSession> {
  return prisma.trainingLiveSession.create({
    data: {
      trainingProgramId: input.trainingProgramId,
      title: input.title,
      description: input.description ?? null,
      startsAt: input.startsAt,
      endsAt: input.endsAt ?? null,
      meetingUrl: input.meetingUrl ?? null,
      status: input.status ?? "scheduled",
    },
    include: sessionInclude,
  });
}

export type UpdateLiveSessionInput = Partial<Omit<CreateLiveSessionInput, "trainingProgramId">> & {
  trainingProgramId?: string;
};

export async function updateLiveSession(
  prisma: PrismaClient,
  sessionId: string,
  input: UpdateLiveSessionInput
): Promise<TrainingLiveSession> {
  return prisma.trainingLiveSession.update({
    where: { id: sessionId },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.startsAt !== undefined && { startsAt: input.startsAt }),
      ...(input.endsAt !== undefined && { endsAt: input.endsAt }),
      ...(input.meetingUrl !== undefined && { meetingUrl: input.meetingUrl }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.trainingProgramId !== undefined && { trainingProgramId: input.trainingProgramId }),
    },
    include: sessionInclude,
  });
}

export async function getLiveSessionById(
  prisma: PrismaClient,
  sessionId: string
): Promise<TrainingLiveSession | null> {
  return prisma.trainingLiveSession.findUnique({
    where: { id: sessionId },
    include: sessionInclude,
  });
}

export async function listLiveSessionsForProgram(
  prisma: PrismaClient,
  programId: string
): Promise<TrainingLiveSession[]> {
  return prisma.trainingLiveSession.findMany({
    where: { trainingProgramId: programId },
    include: sessionInclude,
    orderBy: { startsAt: "asc" },
  });
}

/** Partner: sessions for a program only if program is visible; excludes cancelled optionally */
export async function listVisibleLiveSessionsForPartnerProgram(
  prisma: PrismaClient,
  programId: string,
  organizationId: string,
  options: { includeCancelled?: boolean } = {}
): Promise<TrainingLiveSession[]> {
  const programOk = await prisma.trainingProgram.findFirst({
    where: { id: programId, ...trainingProgramVisibleToPartnerWhere(organizationId) },
  });
  if (!programOk) return [];
  return prisma.trainingLiveSession.findMany({
    where: {
      trainingProgramId: programId,
      ...(!options.includeCancelled && { status: { not: "cancelled" } }),
    },
    include: sessionInclude,
    orderBy: { startsAt: "asc" },
  });
}

export async function assertPartnerCanAccessLiveSession(
  prisma: PrismaClient,
  sessionId: string,
  organizationId: string
): Promise<TrainingLiveSession> {
  const session = await prisma.trainingLiveSession.findFirst({
    where: {
      id: sessionId,
      trainingProgram: trainingProgramVisibleToPartnerWhere(organizationId),
    },
    include: sessionInclude,
  });
  if (!session) throw new Error("Session not found or not visible");
  return session;
}
