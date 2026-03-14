import { z } from "zod";

/** Accepts ISO date or date-only string (YYYY-MM-DD) */
export const dateParamSchema = z.union([
  z.string().datetime(),
  z.string().regex(/^\d{4}-\d{2}-\d{2}/),
]);

export const analyticsPartnersQuerySchema = z.object({
  dateFrom: dateParamSchema.optional(),
  dateTo: dateParamSchema.optional(),
  partnerId: z.string().optional(),
  country: z.string().optional(),
});

export const analyticsQuotesQuerySchema = z.object({
  dateFrom: dateParamSchema.optional(),
  dateTo: dateParamSchema.optional(),
});

export const analyticsLeaderboardQuerySchema = z.object({
  sort: z.enum(["revenue", "quotes_accepted"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  dateFrom: dateParamSchema.optional(),
  dateTo: dateParamSchema.optional(),
});

export const dashboardLimitQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export type AnalyticsPartnersQuery = z.infer<typeof analyticsPartnersQuerySchema>;
export type AnalyticsQuotesQuery = z.infer<typeof analyticsQuotesQuerySchema>;
export type AnalyticsLeaderboardQuery = z.infer<typeof analyticsLeaderboardQuerySchema>;
