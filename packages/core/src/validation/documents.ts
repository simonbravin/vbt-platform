import { z } from "zod";

export const documentVisibilityEnum = z.enum(["public", "partners_only", "internal"]);

export const createDocumentSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable().optional(),
  categoryId: z.string().min(1),
  fileUrl: z.string().min(1),
  visibility: documentVisibilityEnum.optional(),
  countryScope: z.string().nullable().optional(),
  /** Platform docs: restrict to these partner orgs; omit or [] = all partners. */
  allowedOrganizationIds: z.array(z.string().min(1)).optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  categoryId: z.string().min(1).optional(),
  fileUrl: z.string().min(1).optional(),
  visibility: documentVisibilityEnum.optional(),
  countryScope: z.string().nullable().optional(),
  allowedOrganizationIds: z.array(z.string().min(1)).optional(),
});
