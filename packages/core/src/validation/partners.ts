import { z } from "zod";

export const partnerTypeEnum = z.enum(["commercial_partner", "master_partner"]);
export const engineeringFeeModeEnum = z.enum(["fixed", "percent", "per_request", "included"]);

export const createPartnerSchema = z.object({
  companyName: z.string().min(1),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional().or(z.literal("")),
  website: z.string().max(500).nullable().optional().or(z.literal("")),
  country: z.string().nullable().optional(),
  partnerType: partnerTypeEnum,
  engineeringFeeMode: engineeringFeeModeEnum.nullable().optional(),
  status: z.string().optional(),
});

export const updatePartnerSchema = createPartnerSchema.partial();

export const territorySchema = z.object({
  territoryType: z.enum(["exclusive", "open", "referral"]),
  countryCode: z.string().length(2),
  region: z.string().nullable().optional(),
  exclusive: z.boolean().optional(),
});

export const onboardingStateEnum = z.enum([
  "application_received",
  "agreement_signed",
  "training_started",
  "training_completed",
  "active",
]);
