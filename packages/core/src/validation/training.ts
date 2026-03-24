import { z } from "zod";

export const enrollmentStatusEnum = z.enum(["not_started", "in_progress", "completed"]);
export const orgMemberRoleEnum = z.enum(["owner", "admin", "sales", "engineer", "viewer"]);

export const createEnrollmentSchema = z.object({
  programId: z.string().min(1),
  userId: z.string().optional(),
});

export const updateEnrollmentSchema = z.object({
  progressPercent: z.number().min(0).max(100).optional(),
  progressPct: z.number().min(0).max(100).optional(),
  status: enrollmentStatusEnum.optional(),
  completedAt: z.union([z.string().datetime(), z.null()]).optional(),
});

export const inviteOrgMemberSchema = z.object({
  userId: z.string().min(1),
  role: orgMemberRoleEnum,
});

export const updateOrgMemberSchema = z.object({
  role: orgMemberRoleEnum.optional(),
  status: z.enum(["active", "inactive", "invited", "suspended"]).optional(),
});

export const trainingProgramVisibilityEnum = z.enum(["all_partners", "selected_partners"]);

export const createTrainingProgramSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  status: z.string().optional(),
  durationHours: z.number().nullable().optional(),
  visibility: trainingProgramVisibilityEnum.optional(),
  publishedAt: z.union([z.string().datetime(), z.null()]).optional(),
  allowedOrganizationIds: z.array(z.string()).optional(),
});

export const updateTrainingProgramSchema = createTrainingProgramSchema.partial();

export const trainingLiveSessionStatusEnum = z.enum(["scheduled", "cancelled", "completed"]);

export const createLiveSessionSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.union([z.string().datetime(), z.null()]).optional(),
  meetingUrl: z.string().nullable().optional(),
  status: trainingLiveSessionStatusEnum.optional(),
});

export const updateLiveSessionSchema = createLiveSessionSchema.partial();

export const enrollLiveSessionSchema = z.object({
  userId: z.string().optional(),
});

export const sessionAttendanceSchema = z.object({
  status: z.enum(["attended", "no_show"]),
});
