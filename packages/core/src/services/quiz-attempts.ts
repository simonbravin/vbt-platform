import { randomBytes } from "node:crypto";
import type { PrismaClient, QuizAttempt } from "@vbt/db";
import { orgScopeWhere, type TenantContext } from "./tenant-context";
import { resolveTrainingModuleVisible, quizDefinitionVisibleToPartnerWhere } from "./training-visibility";
import { type QuizAttemptSnapshotV1, stripSnapshotForClient } from "./quizzes";

function shuffleInPlace<T>(arr: T[], random: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function makeRandom(seedHex: string): () => number {
  let i = 0;
  const buf = Buffer.from(seedHex, "hex");
  return () => {
    if (i + 4 > buf.length) {
      i = 0;
    }
    const n = buf.readUInt32BE(i);
    i += 4;
    return (n >>> 0) / 0x1_0000_0000;
  };
}

export async function startQuizAttempt(
  prisma: PrismaClient,
  ctx: TenantContext,
  quizDefinitionId: string
): Promise<{ attemptId: string; snapshotForClient: ReturnType<typeof stripSnapshotForClient> }> {
  const organizationId = ctx.organizationId ?? undefined;
  if (!organizationId && !ctx.isPlatformSuperadmin) {
    throw new Error("Organization context required");
  }
  const orgId = organizationId!;
  const moduleOk = await resolveTrainingModuleVisible(prisma, orgId);
  if (!moduleOk) throw new Error("Training module is disabled for this organization");

  const full = await prisma.quizDefinition.findFirst({
    where: { id: quizDefinitionId, ...quizDefinitionVisibleToPartnerWhere(orgId) },
    include: { topicRules: true },
  });
  if (!full) throw new Error("Quiz not found or not visible");

  const questions: QuizAttemptSnapshotV1["questions"] = [];
  const randomSeed = randomBytes(32).toString("hex");
  const rnd = makeRandom(randomSeed);

  for (const rule of full.topicRules) {
    const pool = await prisma.quizQuestion.findMany({
      where: { topicId: rule.topicId, status: "published" },
      include: { options: true },
    });
    const eligible = pool.filter(
      (q) => q.options.length >= 2 && q.options.some((o) => o.isCorrect)
    );
    if (eligible.length < rule.pickCount) {
      throw new Error(
        `Topic has insufficient published questions (need ${rule.pickCount}, have ${eligible.length})`
      );
    }
    const shuffled = [...eligible];
    shuffleInPlace(shuffled, rnd);
    const picked = shuffled.slice(0, rule.pickCount);
    for (const q of picked) {
      const correct = q.options.find((o) => o.isCorrect);
      if (!correct) continue;
      const oKeys = q.options.map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect }));
      shuffleInPlace(oKeys, rnd);
      const options = oKeys.map((o) => ({
        oKey: o.id,
        text: o.label,
      }));
      const correctOKey = correct.id;
      questions.push({
        qKey: q.id,
        stem: q.stem,
        options,
        correctOKey,
      });
    }
  }

  shuffleInPlace(questions, rnd);

  const snapshot: QuizAttemptSnapshotV1 = { v: 1, questions };
  const attempt = await prisma.quizAttempt.create({
    data: {
      quizDefinitionId,
      organizationId: orgId,
      userId: ctx.userId,
      snapshotJson: snapshot as object,
      randomSeed,
    },
  });

  return {
    attemptId: attempt.id,
    snapshotForClient: stripSnapshotForClient(snapshot),
  };
}

export type SubmitQuizAnswersInput = Record<string, string | null>;

export async function submitQuizAttempt(
  prisma: PrismaClient,
  ctx: TenantContext,
  attemptId: string,
  answers: SubmitQuizAnswersInput
): Promise<QuizAttempt> {
  const orgWhere = orgScopeWhere(ctx);
  const attempt = await prisma.quizAttempt.findFirst({
    where: { id: attemptId, userId: ctx.userId, ...orgWhere },
  });
  if (!attempt) throw new Error("Attempt not found");
  if (attempt.submittedAt) throw new Error("Attempt already submitted");

  const snapshot = attempt.snapshotJson as unknown as QuizAttemptSnapshotV1;
  if (!snapshot?.questions?.length) throw new Error("Invalid attempt snapshot");

  let correct = 0;
  const total = snapshot.questions.length;
  const answerRows: { questionKey: string; selectedOptionKey: string | null }[] = [];

  for (const q of snapshot.questions) {
    const selected = answers[q.qKey] ?? null;
    answerRows.push({ questionKey: q.qKey, selectedOptionKey: selected });
    if (selected && selected === q.correctOKey) correct += 1;
  }

  const scorePct = total > 0 ? Math.round((correct / total) * 10000) / 100 : 0;
  const quiz = await prisma.quizDefinition.findUniqueOrThrow({
    where: { id: attempt.quizDefinitionId },
    select: { passingScorePct: true },
  });
  const passed = scorePct >= quiz.passingScorePct;

  await prisma.quizAttemptAnswer.createMany({
    data: answerRows.map((a) => ({
      attemptId,
      questionKey: a.questionKey,
      selectedOptionKey: a.selectedOptionKey,
    })),
  });

  return prisma.quizAttempt.update({
    where: { id: attemptId },
    data: {
      submittedAt: new Date(),
      scorePct,
      passed,
    },
    include: {
      quizDefinition: { select: { id: true, title: true, passingScorePct: true } },
    },
  });
}

export async function listQuizAttemptsForUser(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: { quizDefinitionId?: string; limit?: number; offset?: number } = {}
): Promise<{ attempts: QuizAttempt[]; total: number }> {
  const orgWhere = orgScopeWhere(ctx);
  const where = {
    userId: ctx.userId,
    ...orgWhere,
    submittedAt: { not: null },
    ...(options.quizDefinitionId && { quizDefinitionId: options.quizDefinitionId }),
  };
  const [attempts, total] = await Promise.all([
    prisma.quizAttempt.findMany({
      where,
      include: {
        quizDefinition: { select: { id: true, title: true, passingScorePct: true } },
      },
      orderBy: { submittedAt: "desc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.quizAttempt.count({ where }),
  ]);
  return { attempts, total };
}

export async function listQuizAttemptsAdmin(
  prisma: PrismaClient,
  options: {
    quizDefinitionId?: string;
    organizationId?: string;
    userId?: string;
    limit?: number;
    offset?: number;
  } = {}
): Promise<{ attempts: QuizAttempt[]; total: number }> {
  const where = {
    ...(options.quizDefinitionId && { quizDefinitionId: options.quizDefinitionId }),
    ...(options.organizationId && { organizationId: options.organizationId }),
    ...(options.userId && { userId: options.userId }),
    submittedAt: { not: null },
  };
  const [attempts, total] = await Promise.all([
    prisma.quizAttempt.findMany({
      where,
      include: {
        quizDefinition: { select: { id: true, title: true } },
        user: { select: { id: true, fullName: true, email: true } },
        organization: { select: { id: true, name: true } },
        answers: true,
      },
      orderBy: { submittedAt: "desc" },
      take: options.limit ?? 100,
      skip: options.offset ?? 0,
    }),
    prisma.quizAttempt.count({ where }),
  ]);
  return { attempts, total };
}

export async function getQuizAttemptById(
  prisma: PrismaClient,
  ctx: TenantContext,
  attemptId: string,
  opts: { admin?: boolean } = {}
): Promise<QuizAttempt | null> {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quizDefinition: { select: { id: true, title: true, passingScorePct: true } },
      answers: true,
      user: { select: { id: true, fullName: true, email: true } },
      organization: { select: { id: true, name: true } },
    },
  });
  if (!attempt) return null;
  if (opts.admin) return attempt;
  const orgWhere = orgScopeWhere(ctx);
  const allowed =
    attempt.userId === ctx.userId &&
    (ctx.isPlatformSuperadmin || (ctx.organizationId && attempt.organizationId === ctx.organizationId));
  if (!allowed) return null;
  return attempt;
}
