import type { Prisma, PrismaClient } from "@vbt/db";
import type { PartnerQuoteDefaultsJson } from "../pricing/partner-pricing-resolution";
import { parsePartnerQuoteDefaultsJson } from "../pricing/partner-pricing-resolution";
import { type TenantContext, orgScopeWhere } from "./tenant-context";

const PARTNER_ORG_TYPES = ["commercial_partner", "master_partner"] as const;

function requirePlatformAdmin(ctx: TenantContext) {
  if (!ctx.isPlatformSuperadmin) throw new Error("Platform superadmin required");
}

export type ListPartnersOptions = {
  status?: string;
  partnerType?: "commercial_partner" | "master_partner";
  /** Case-insensitive match on company name, country code, or partner contact fields */
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listPartners(
  prisma: PrismaClient,
  ctx: TenantContext,
  options: ListPartnersOptions = {}
) {
  requirePlatformAdmin(ctx);
  const searchTerm = options.search?.trim();
  const andParts: Prisma.OrganizationWhereInput[] = [
    { organizationType: { in: [...PARTNER_ORG_TYPES] } },
  ];
  if (options.status) andParts.push({ status: options.status });
  if (options.partnerType) {
    andParts.push({ partnerProfile: { partnerType: options.partnerType } });
  }
  if (searchTerm && searchTerm.length > 0) {
    andParts.push({
      OR: [
        { name: { contains: searchTerm, mode: "insensitive" } },
        { countryCode: { contains: searchTerm, mode: "insensitive" } },
        {
          partnerProfile: {
            OR: [
              { contactName: { contains: searchTerm, mode: "insensitive" } },
              { contactEmail: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
        },
      ],
    });
  }
  const where: Prisma.OrganizationWhereInput = { AND: andParts };

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      include: { partnerProfile: true },
      orderBy: { name: "asc" },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.organization.count({ where }),
  ]);
  return { partners: organizations, total };
}

export async function getPartnerById(prisma: PrismaClient, ctx: TenantContext, partnerId: string) {
  requirePlatformAdmin(ctx);
  const org = await prisma.organization.findFirst({
    where: {
      id: partnerId,
      organizationType: { in: [...PARTNER_ORG_TYPES] },
    },
    include: { partnerProfile: true, territories: true },
  });
  return org;
}

export type CreatePartnerInput = {
  companyName: string;
  contactName?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  country?: string | null;
  partnerType: "commercial_partner" | "master_partner";
  engineeringFeeMode?: "fixed" | "percent" | "per_request" | "included" | null;
  status?: string;
};

export async function createPartner(
  prisma: PrismaClient,
  ctx: TenantContext,
  input: CreatePartnerInput
) {
  requirePlatformAdmin(ctx);
  const org = await prisma.organization.create({
    data: {
      name: input.companyName,
      website: input.website ?? null,
      countryCode: input.country ?? null,
      organizationType: input.partnerType,
      status: input.status ?? "active",
      partnerProfile: {
        create: {
          partnerType: input.partnerType,
          contactName: input.contactName ?? null,
          contactEmail: input.contactEmail ?? null,
          engineeringFeeMode: input.engineeringFeeMode ?? null,
        },
      },
    },
    include: { partnerProfile: true },
  });
  return org;
}

export type UpdatePartnerInput = {
  companyName?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  country?: string | null;
  partnerType?: "commercial_partner" | "master_partner";
  engineeringFeeMode?: "fixed" | "percent" | "per_request" | "included" | null;
  engineeringFeeValue?: number | null;
  status?: string;
  // Partner profile parameters (overrides)
  entryFeeUsd?: number | null;
  trainingFeeUsd?: number | null;
  materialCreditUsd?: number | null;
  marginMinPct?: number | null;
  marginMaxPct?: number | null;
  minimumPricePolicy?: string | null;
  salesTargetAnnualUsd?: number | null;
  salesTargetAnnualM2?: number | null;
  agreementStartDate?: string | null; // ISO date
  agreementEndDate?: string | null;   // ISO date
  agreementStatus?: string | null;
  visionLatamCommissionPct?: number | null;
  visionLatamCommissionFixedUsd?: number | null;
  /** Per-partner module visibility override; when set, overrides global default for this partner. */
  moduleVisibility?: Record<string, boolean> | null;
  /** Panel systems this partner can use: S80, S150, S200. Null = all enabled. */
  enabledSystems?: string[] | null;
  /** Deep-merge into `partner_profiles.quote_defaults` (SaaS pricing defaults + country overrides). */
  quotePricingDefaults?: Partial<PartnerQuoteDefaultsJson> | null;
  /** When true, creating a SaaS quote requires at least one completed engineering request on the project. */
  requireDeliveredEngineeringForQuotes?: boolean;
};

export async function updatePartner(
  prisma: PrismaClient,
  ctx: TenantContext,
  partnerId: string,
  data: UpdatePartnerInput
) {
  requirePlatformAdmin(ctx);
  const existing = await prisma.organization.findFirst({
    where: { id: partnerId, organizationType: { in: [...PARTNER_ORG_TYPES] } },
    include: { partnerProfile: true },
  });
  if (!existing) throw new Error("Partner not found");

  const [orgName, orgWebsite, orgCountry, orgStatus, orgType] = [
    data.companyName ?? existing.name,
    data.website !== undefined ? data.website : existing.website,
    data.country !== undefined ? data.country : existing.countryCode,
    data.status !== undefined ? data.status : existing.status,
    data.partnerType ?? existing.organizationType,
  ];

  const profileUpdate: Record<string, unknown> = {};
  if (data.contactName !== undefined) profileUpdate.contactName = data.contactName;
  if (data.contactEmail !== undefined) profileUpdate.contactEmail = data.contactEmail;
  if (data.partnerType !== undefined) profileUpdate.partnerType = data.partnerType;
  if (data.engineeringFeeMode !== undefined) profileUpdate.engineeringFeeMode = data.engineeringFeeMode;
  if (data.engineeringFeeValue !== undefined) profileUpdate.engineeringFeeValue = data.engineeringFeeValue;
  if (data.entryFeeUsd !== undefined) profileUpdate.entryFeeUsd = data.entryFeeUsd;
  if (data.trainingFeeUsd !== undefined) profileUpdate.trainingFeeUsd = data.trainingFeeUsd;
  if (data.materialCreditUsd !== undefined) profileUpdate.materialCreditUsd = data.materialCreditUsd;
  if (data.marginMinPct !== undefined) profileUpdate.marginMinPct = data.marginMinPct;
  if (data.marginMaxPct !== undefined) profileUpdate.marginMaxPct = data.marginMaxPct;
  if (data.minimumPricePolicy !== undefined) profileUpdate.minimumPricePolicy = data.minimumPricePolicy;
  if (data.salesTargetAnnualUsd !== undefined) profileUpdate.salesTargetAnnualUsd = data.salesTargetAnnualUsd;
  if (data.salesTargetAnnualM2 !== undefined) profileUpdate.salesTargetAnnualM2 = data.salesTargetAnnualM2;
  if (data.agreementStatus !== undefined) profileUpdate.agreementStatus = data.agreementStatus;
  if (data.agreementStartDate !== undefined) {
    profileUpdate.agreementStartDate = data.agreementStartDate ? new Date(data.agreementStartDate) : null;
  }
  if (data.agreementEndDate !== undefined) {
    profileUpdate.agreementEndDate = data.agreementEndDate ? new Date(data.agreementEndDate) : null;
  }
  if (data.visionLatamCommissionPct !== undefined) profileUpdate.visionLatamCommissionPct = data.visionLatamCommissionPct;
  if (data.visionLatamCommissionFixedUsd !== undefined) profileUpdate.visionLatamCommissionFixedUsd = data.visionLatamCommissionFixedUsd;
  if (data.moduleVisibility !== undefined) profileUpdate.moduleVisibility = data.moduleVisibility as object;
  if (data.enabledSystems !== undefined) profileUpdate.enabledSystems = data.enabledSystems as object;
  if (data.quotePricingDefaults !== undefined && data.quotePricingDefaults !== null) {
    const qpd = data.quotePricingDefaults;
    const prev = parsePartnerQuoteDefaultsJson(existing.partnerProfile?.quoteDefaults ?? undefined);
    const next: PartnerQuoteDefaultsJson = { ...prev, ...qpd };
    if (qpd.countryOverrides !== undefined) {
      next.countryOverrides = qpd.countryOverrides;
    }
    profileUpdate.quoteDefaults = next as object;
  }
  if (data.requireDeliveredEngineeringForQuotes !== undefined) {
    profileUpdate.requireDeliveredEngineeringForQuotes = data.requireDeliveredEngineeringForQuotes;
  }

  const profileData =
    Object.keys(profileUpdate).length > 0
      ? !existing.partnerProfile
        ? {
            partnerProfile: {
              create: {
                partnerType:
                  orgType === "master_partner"
                    ? ("master_partner" as const)
                    : ("commercial_partner" as const),
                ...(profileUpdate as Record<string, unknown>),
              },
            },
          }
        : {
            partnerProfile: {
              update: profileUpdate as Parameters<typeof prisma.partnerProfile.update>[0]["data"],
            },
          }
      : {};

  const updated = await prisma.organization.update({
    where: { id: partnerId },
    data: {
      name: orgName,
      website: orgWebsite,
      countryCode: orgCountry,
      status: orgStatus,
      organizationType: orgType,
      ...profileData,
    },
    include: { partnerProfile: true },
  });
  return updated;
}

// ─── Territories ─────────────────────────────────────────────────────────────

export type TerritoryInput = {
  territoryType: "exclusive" | "open" | "referral";
  countryCode: string;
  region?: string | null;
  exclusive?: boolean; // if true, store as territoryType exclusive
};

export async function listPartnerTerritories(
  prisma: PrismaClient,
  ctx: TenantContext,
  partnerId: string
) {
  requirePlatformAdmin(ctx);
  await getPartnerById(prisma, ctx, partnerId);
  return prisma.partnerTerritory.findMany({
    where: { organizationId: partnerId },
    orderBy: [{ countryCode: "asc" }, { region: "asc" }],
  });
}

export async function addPartnerTerritory(
  prisma: PrismaClient,
  ctx: TenantContext,
  partnerId: string,
  input: TerritoryInput
) {
  requirePlatformAdmin(ctx);
  await getPartnerById(prisma, ctx, partnerId);
  const territoryType = input.exclusive === true ? "exclusive" : input.territoryType;
  return prisma.partnerTerritory.create({
    data: {
      organizationId: partnerId,
      countryCode: input.countryCode,
      region: input.region ?? null,
      territoryType,
    },
  });
}

export async function removeTerritory(
  prisma: PrismaClient,
  ctx: TenantContext,
  territoryId: string
) {
  requirePlatformAdmin(ctx);
  const territory = await prisma.partnerTerritory.findUnique({
    where: { id: territoryId },
  });
  if (!territory) throw new Error("Territory not found");
  await prisma.partnerTerritory.delete({ where: { id: territoryId } });
  return { id: territoryId };
}

// ─── Onboarding ─────────────────────────────────────────────────────────────

const ONBOARDING_STATES = ["application_received", "agreement_signed", "training_started", "training_completed", "active"] as const;

export type OnboardingState = (typeof ONBOARDING_STATES)[number];

export async function getPartnerOnboarding(prisma: PrismaClient, ctx: TenantContext, partnerId: string) {
  requirePlatformAdmin(ctx);
  const profile = await prisma.partnerProfile.findFirst({
    where: { organizationId: partnerId },
  });
  if (!profile) throw new Error("Partner profile not found");
  return { onboardingState: profile.onboardingState ?? null };
}

export async function updatePartnerOnboarding(
  prisma: PrismaClient,
  ctx: TenantContext,
  partnerId: string,
  state: OnboardingState
) {
  requirePlatformAdmin(ctx);
  const profile = await prisma.partnerProfile.findFirst({
    where: { organizationId: partnerId },
  });
  if (!profile) throw new Error("Partner profile not found");
  return prisma.partnerProfile.update({
    where: { id: profile.id },
    data: { onboardingState: state },
  });
}
