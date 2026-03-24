import type { PrismaClient, Prisma, QuizDefinition, QuizTopic, QuizQuestion } from "@vbt/db";
import { assertPartnerOrgIds, quizDefinitionVisibleToPartnerWhere } from "./training-visibility";

const definitionListInclude = {
  topicRules: { include: { topic: { select: { id: true, name: true, code: true } } } },
  allowedOrganizations: {
    select: { organizationId: true, organization: { select: { id: true, name: true } } },
  },
  _count: { select: { attempts: true } },
} as const;

export async function listQuizTopics(prisma: PrismaClient): Promise<QuizTopic[]> {
  return prisma.quizTopic.findMany({ orderBy: { sortOrder: "asc" } });
}

export type CreateQuizTopicInput = { name: string; code?: string | null; sortOrder?: number };

export async function createQuizTopic(prisma: PrismaClient, input: CreateQuizTopicInput): Promise<QuizTopic> {
  return prisma.quizTopic.create({
    data: {
      name: input.name,
      code: input.code ?? null,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateQuizTopic(
  prisma: PrismaClient,
  id: string,
  input: Partial<CreateQuizTopicInput>
): Promise<QuizTopic> {
  return prisma.quizTopic.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.code !== undefined && { code: input.code }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
  });
}

const questionInclude = {
  options: { orderBy: { sortOrder: "asc" as const } },
  topic: { select: { id: true, name: true } },
} as const;

export async function listQuizQuestionsForTopic(
  prisma: PrismaClient,
  topicId: string
): Promise<QuizQuestion[]> {
  return prisma.quizQuestion.findMany({
    where: { topicId },
    include: questionInclude,
    orderBy: { createdAt: "desc" },
  });
}

export type CreateQuizQuestionInput = {
  topicId: string;
  stem: string;
  status?: Prisma.QuizQuestionCreateInput["status"];
  options: { label: string; isCorrect: boolean; sortOrder?: number }[];
};

export async function createQuizQuestion(
  prisma: PrismaClient,
  input: CreateQuizQuestionInput
): Promise<QuizQuestion> {
  const correct = input.options.filter((o) => o.isCorrect);
  if (correct.length !== 1) throw new Error("Exactly one option must be correct");
  return prisma.quizQuestion.create({
    data: {
      topicId: input.topicId,
      stem: input.stem,
      status: input.status ?? "draft",
      options: {
        create: input.options.map((o, i) => ({
          label: o.label,
          isCorrect: o.isCorrect,
          sortOrder: o.sortOrder ?? i,
        })),
      },
    },
    include: questionInclude,
  });
}

export type UpdateQuizQuestionInput = {
  stem?: string;
  status?: Prisma.QuizQuestionUpdateInput["status"];
  options?: CreateQuizQuestionInput["options"];
};

export async function updateQuizQuestion(
  prisma: PrismaClient,
  id: string,
  input: UpdateQuizQuestionInput
): Promise<QuizQuestion> {
  if (input.options) {
    const correct = input.options.filter((o) => o.isCorrect);
    if (correct.length !== 1) throw new Error("Exactly one option must be correct");
    await prisma.quizQuestionOption.deleteMany({ where: { questionId: id } });
    await prisma.quizQuestionOption.createMany({
      data: input.options.map((o, i) => ({
        questionId: id,
        label: o.label,
        isCorrect: o.isCorrect,
        sortOrder: o.sortOrder ?? i,
      })),
    });
  }
  return prisma.quizQuestion.update({
    where: { id },
    data: {
      ...(input.stem !== undefined && { stem: input.stem }),
      ...(input.status !== undefined && { status: input.status }),
    },
    include: questionInclude,
  });
}

export type QuizTopicRuleInput = { topicId: string; pickCount: number };

export type CreateQuizDefinitionInput = {
  title: string;
  description?: string | null;
  passingScorePct: number;
  status?: Prisma.QuizDefinitionCreateInput["status"];
  publishedAt?: Date | null;
  visibility?: Prisma.QuizDefinitionCreateInput["visibility"];
  topicRules: QuizTopicRuleInput[];
  allowedOrganizationIds?: string[];
};

export async function createQuizDefinition(
  prisma: PrismaClient,
  input: CreateQuizDefinitionInput
): Promise<QuizDefinition> {
  if (!input.topicRules.length) throw new Error("At least one topic rule is required");
  for (const r of input.topicRules) {
    if (r.pickCount < 1) throw new Error("pickCount must be >= 1");
  }
  const allowedOrganizationIds = input.allowedOrganizationIds ?? [];
  await assertPartnerOrgIds(prisma, allowedOrganizationIds);
  return prisma.quizDefinition.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      passingScorePct: input.passingScorePct,
      status: input.status ?? "draft",
      publishedAt: input.publishedAt ?? null,
      visibility: input.visibility ?? "all_partners",
      topicRules: {
        create: input.topicRules.map((r) => ({
          topicId: r.topicId,
          pickCount: r.pickCount,
        })),
      },
      allowedOrganizations:
        allowedOrganizationIds.length > 0
          ? { create: allowedOrganizationIds.map((organizationId) => ({ organizationId })) }
          : undefined,
    },
    include: definitionListInclude,
  });
}

export type UpdateQuizDefinitionInput = Partial<
  Omit<CreateQuizDefinitionInput, "topicRules">
> & { topicRules?: QuizTopicRuleInput[] };

export async function updateQuizDefinition(
  prisma: PrismaClient,
  id: string,
  input: UpdateQuizDefinitionInput
): Promise<QuizDefinition> {
  if (input.topicRules) {
    if (!input.topicRules.length) throw new Error("At least one topic rule is required");
    await prisma.quizDefinitionTopicRule.deleteMany({ where: { quizDefinitionId: id } });
    await prisma.quizDefinitionTopicRule.createMany({
      data: input.topicRules.map((r) => ({
        quizDefinitionId: id,
        topicId: r.topicId,
        pickCount: r.pickCount,
      })),
    });
  }
  if (input.allowedOrganizationIds) {
    await assertPartnerOrgIds(prisma, input.allowedOrganizationIds);
    await prisma.quizQuizAllowedOrganization.deleteMany({ where: { quizDefinitionId: id } });
    if (input.allowedOrganizationIds.length > 0) {
      await prisma.quizQuizAllowedOrganization.createMany({
        data: input.allowedOrganizationIds.map((organizationId) => ({
          quizDefinitionId: id,
          organizationId,
        })),
      });
    }
  }
  return prisma.quizDefinition.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.passingScorePct !== undefined && { passingScorePct: input.passingScorePct }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.publishedAt !== undefined && { publishedAt: input.publishedAt }),
      ...(input.visibility !== undefined && { visibility: input.visibility }),
    },
    include: definitionListInclude,
  });
}

export async function listQuizDefinitionsAdmin(prisma: PrismaClient): Promise<QuizDefinition[]> {
  return prisma.quizDefinition.findMany({
    include: definitionListInclude,
    orderBy: { title: "asc" },
  });
}

export async function listVisibleQuizDefinitionsForPartner(
  prisma: PrismaClient,
  organizationId: string
): Promise<QuizDefinition[]> {
  return prisma.quizDefinition.findMany({
    where: quizDefinitionVisibleToPartnerWhere(organizationId),
    include: definitionListInclude,
    orderBy: { title: "asc" },
  });
}

export async function getQuizDefinitionById(
  prisma: PrismaClient,
  id: string,
  opts: { admin?: boolean; partnerOrganizationId?: string } = {}
): Promise<QuizDefinition | null> {
  const row = await prisma.quizDefinition.findUnique({
    where: { id },
    include: {
      ...definitionListInclude,
      topicRules: {
        include: { topic: true },
      },
    },
  });
  if (!row) return null;
  if (opts.admin) return row;
  if (opts.partnerOrganizationId) {
    const ok = await prisma.quizDefinition.findFirst({
      where: { id, ...quizDefinitionVisibleToPartnerWhere(opts.partnerOrganizationId) },
    });
    if (!ok) return null;
  }
  return row;
}

export type QuizSnapshotQuestion = {
  qKey: string;
  stem: string;
  options: { oKey: string; text: string }[];
  correctOKey: string;
};

export type QuizAttemptSnapshotV1 = {
  v: 1;
  questions: QuizSnapshotQuestion[];
};

export function stripSnapshotForClient(snapshot: QuizAttemptSnapshotV1): {
  v: 1;
  questions: { qKey: string; stem: string; options: { oKey: string; text: string }[] }[];
} {
  return {
    v: 1,
    questions: snapshot.questions.map((q) => ({
      qKey: q.qKey,
      stem: q.stem,
      options: q.options.map((o) => ({ oKey: o.oKey, text: o.text })),
    })),
  };
}
