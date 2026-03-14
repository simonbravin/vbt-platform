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
