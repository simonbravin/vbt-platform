import { z } from "zod";

export const quoteStatusEnum = z.enum(["draft", "sent", "accepted", "rejected", "expired"]);
export const quoteItemTypeEnum = z.enum(["product", "service", "other"]);

export const quoteItemSchema = z.object({
  itemType: quoteItemTypeEnum,
  sku: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  quantity: z.number().min(0).optional(),
  unitCost: z.number().optional(),
  markupPct: z.number().optional(),
  unitPrice: z.number().optional(),
  totalPrice: z.number().optional(),
  sortOrder: z.number().optional(),
  catalogPieceId: z.string().nullable().optional(),
});

export const createQuoteSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  quoteNumber: z.string().min(1).optional(),
  version: z.number().optional(),
  status: quoteStatusEnum.optional(),
  currency: z.string().optional(),
  factoryCostTotal: z.number().optional(),
  visionLatamMarkupPct: z.number().optional(),
  partnerMarkupPct: z.number().optional(),
  logisticsCost: z.number().optional(),
  importCost: z.number().optional(),
  localTransportCost: z.number().optional(),
  technicalServiceCost: z.number().optional(),
  totalPrice: z.number().optional(),
  items: z.array(quoteItemSchema).optional(),
});

export const updateQuoteSchema = z.object({
  status: quoteStatusEnum.optional(),
  currency: z.string().optional(),
  factoryCostTotal: z.number().optional(),
  visionLatamMarkupPct: z.number().optional(),
  partnerMarkupPct: z.number().optional(),
  logisticsCost: z.number().optional(),
  importCost: z.number().optional(),
  localTransportCost: z.number().optional(),
  technicalServiceCost: z.number().optional(),
  totalPrice: z.number().optional(),
  validUntil: z.union([z.string().datetime(), z.null()]).optional(),
  items: z.array(quoteItemSchema).optional(),
});

export const listQuotesQuerySchema = z.object({
  status: quoteStatusEnum.optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export type UpdateQuoteInput = z.infer<typeof updateQuoteSchema>;
export type ListQuotesQuery = z.infer<typeof listQuotesQuerySchema>;
