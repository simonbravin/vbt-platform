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

/** PATCH body: permite `expectedCloseDate: null` para limpiar la fecha (misma semántica que rutas legacy). */
export const updateProjectSchema = createProjectSchema
  .partial()
  .extend({
    expectedCloseDate: z
      .union([z.string().datetime(), z.string(), z.null()])
      .optional(),
    /** Cotización base del proyecto (ventas multi-proyecto e informes). Debe pertenecer al mismo proyecto. */
    baselineQuoteId: z.string().min(1).nullable().optional(),
  });

const optionalBoolQuery = z
  .string()
  .optional()
  .transform((s) => (s === undefined ? undefined : s === "true" || s === "1"));

export const listProjectsQuerySchema = z.object({
  status: projectStatusEnum.optional(),
  /** When true, list includes archived (`lost`) projects when `status` is not set. Default: omit or false. */
  includeArchived: optionalBoolQuery,
  clientId: z.string().optional(),
  organizationId: z.string().optional(),
  countryCode: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
