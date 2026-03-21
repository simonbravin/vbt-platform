import { z } from "zod";

export const engineeringStatusEnum = z.enum([
  "draft",
  "submitted",
  "in_review",
  "pending_info",
  "needs_info",
  "in_progress",
  "completed",
  "delivered",
  "rejected",
]);

export const createEngineeringRequestSchema = z.object({
  projectId: z.string().min(1),
  requestNumber: z.string().min(1),
  status: engineeringStatusEnum.optional(),
  requestType: z.string().optional(),
  wallAreaM2: z.number().optional(),
  systemType: z.string().optional(),
  targetDeliveryDate: z.string().datetime().optional().or(z.string()),
  engineeringFeeValue: z.number().optional(),
  notes: z.string().optional(),
});

export const updateEngineeringRequestSchema = z.object({
  status: engineeringStatusEnum.optional(),
  assignedToUserId: z.string().nullable().optional(),
  requestType: z.string().nullable().optional(),
  wallAreaM2: z.number().nullable().optional(),
  systemType: z.string().nullable().optional(),
  targetDeliveryDate: z.union([z.string().datetime(), z.null()]).optional().or(z.string().nullable()),
  engineeringFeeValue: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const engineeringFileSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().nullable().optional(),
  fileSize: z.number().int().min(0).nullable().optional(),
  fileUrl: z.string().min(1),
});

export const engineeringDeliverableSchema = z.object({
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  fileUrl: z.string().min(1),
});

export const engineeringReviewVisibilityEnum = z.enum(["partner", "internal"]);

export const createEngineeringReviewEventSchema = z.object({
  body: z.string().min(1).max(32_000),
  visibility: engineeringReviewVisibilityEnum,
  toStatus: engineeringStatusEnum.optional(),
});
