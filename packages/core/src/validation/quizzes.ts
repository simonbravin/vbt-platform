import { z } from "zod";
import { trainingProgramVisibilityEnum } from "./training";

export const quizQuestionStatusEnum = z.enum(["draft", "published"]);
export const quizDefinitionStatusEnum = z.enum(["draft", "published", "archived"]);

export const createQuizTopicSchema = z.object({
  name: z.string().min(1),
  code: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateQuizTopicSchema = createQuizTopicSchema.partial();

export const quizOptionSchema = z.object({
  label: z.string().min(1),
  isCorrect: z.boolean(),
  sortOrder: z.number().int().optional(),
});

export const createQuizQuestionSchema = z.object({
  topicId: z.string().min(1),
  stem: z.string().min(1),
  status: quizQuestionStatusEnum.optional(),
  options: z.array(quizOptionSchema).min(2),
});

export const updateQuizQuestionSchema = z.object({
  stem: z.string().min(1).optional(),
  status: quizQuestionStatusEnum.optional(),
  options: z.array(quizOptionSchema).min(2).optional(),
});

export const quizTopicRuleSchema = z.object({
  topicId: z.string().min(1),
  pickCount: z.number().int().min(1),
});

export const createQuizDefinitionSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  passingScorePct: z.number().min(0).max(100),
  status: quizDefinitionStatusEnum.optional(),
  publishedAt: z.union([z.string().datetime(), z.null()]).optional(),
  visibility: trainingProgramVisibilityEnum.optional(),
  topicRules: z.array(quizTopicRuleSchema).min(1),
  allowedOrganizationIds: z.array(z.string()).optional(),
});

export const updateQuizDefinitionSchema = createQuizDefinitionSchema.partial();

export const submitQuizAttemptSchema = z.object({
  answers: z.record(z.string().nullable()),
});
