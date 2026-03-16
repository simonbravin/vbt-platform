import { z } from "zod";

const projectStatusEnum = z.enum([
  "lead",
  "qualified",
  "quoting",
  "engineering",
  "won",
  "lost",
  "on_hold",
]);

export const createProjectSchema = z.object({
  projectName: z.string().min(1, "Project name is required"),
  projectCode: z.string().optional(),
  clientId: z.string().optional().nullable(),
  countryCode: z.string().optional().nullable(),
  city: z.string().optional(),
  address: z.string().optional(),
  description: z.string().optional(),
  status: projectStatusEnum.optional(),
  estimatedTotalAreaM2: z.number().min(0).optional().nullable(),
  estimatedWallAreaM2: z.number().min(0).optional().nullable(),
  expectedCloseDate: z.union([z.string().datetime(), z.string()]).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const listProjectsQuerySchema = z.object({
  status: projectStatusEnum.optional(),
  clientId: z.string().optional(),
  organizationId: z.string().optional(),
  countryCode: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
