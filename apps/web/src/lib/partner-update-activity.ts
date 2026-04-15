/**
 * Builds activity-log metadata for PATCH /api/saas/partners/[id]:
 * list of changed fields with before/after values (JSON-serializable).
 */

export type PartnerOrgSnapshot = {
  id: string;
  name: string;
  website: string | null;
  countryCode: string | null;
  status: string;
  organizationType: string;
  partnerProfile: {
    contactName: string | null;
    contactEmail: string | null;
    partnerType: string;
    engineeringFeeMode: string | null;
    engineeringFeeValue: number | null;
    entryFeeUsd: number | null;
    trainingFeeUsd: number | null;
    materialCreditUsd: number | null;
    marginMinPct: number | null;
    marginMaxPct: number | null;
    minimumPricePolicy: string | null;
    salesTargetAnnualUsd: number | null;
    salesTargetAnnualM2: number | null;
    agreementStartDate: Date | string | null;
    agreementEndDate: Date | string | null;
    agreementStatus: string | null;
    visionLatamCommissionPct: number | null;
    visionLatamCommissionFixedUsd: number | null;
    moduleVisibility: unknown;
    enabledSystems: unknown;
    quoteDefaults: unknown;
    requireDeliveredEngineeringForQuotes: boolean;
  } | null;
};

export type PartnerFieldChange = {
  field: string;
  from: unknown;
  to: unknown;
};

function dateToDayString(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.length >= 10 ? v.slice(0, 10) : v;
  try {
    return v.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function snapshotField(org: PartnerOrgSnapshot, field: string): unknown {
  const p = org.partnerProfile;
  switch (field) {
    case "companyName":
      return org.name;
    case "country":
      return org.countryCode;
    case "website":
      return org.website;
    case "status":
      return org.status;
    case "partnerType":
      return org.organizationType;
    case "contactName":
      return p?.contactName ?? null;
    case "contactEmail":
      return p?.contactEmail ?? null;
    case "engineeringFeeMode":
      return p?.engineeringFeeMode ?? null;
    case "engineeringFeeValue":
      return p?.engineeringFeeValue ?? null;
    case "entryFeeUsd":
      return p?.entryFeeUsd ?? null;
    case "trainingFeeUsd":
      return p?.trainingFeeUsd ?? null;
    case "materialCreditUsd":
      return p?.materialCreditUsd ?? null;
    case "marginMinPct":
      return p?.marginMinPct ?? null;
    case "marginMaxPct":
      return p?.marginMaxPct ?? null;
    case "minimumPricePolicy":
      return p?.minimumPricePolicy ?? null;
    case "salesTargetAnnualUsd":
      return p?.salesTargetAnnualUsd ?? null;
    case "salesTargetAnnualM2":
      return p?.salesTargetAnnualM2 ?? null;
    case "agreementStartDate":
      return dateToDayString(p?.agreementStartDate ?? null);
    case "agreementEndDate":
      return dateToDayString(p?.agreementEndDate ?? null);
    case "agreementStatus":
      return p?.agreementStatus ?? null;
    case "visionLatamCommissionPct":
      return p?.visionLatamCommissionPct ?? null;
    case "visionLatamCommissionFixedUsd":
      return p?.visionLatamCommissionFixedUsd ?? null;
    case "moduleVisibility":
      return p?.moduleVisibility ?? null;
    case "enabledSystems":
      return p?.enabledSystems ?? null;
    case "quotePricingDefaults":
      return p?.quoteDefaults ?? null;
    case "requireDeliveredEngineeringForQuotes":
      return p?.requireDeliveredEngineeringForQuotes ?? false;
    default:
      return null;
  }
}

function stableStringify(v: unknown): string {
  if (v === undefined) return "undefined";
  if (typeof v === "number" && Number.isNaN(v)) return "NaN";
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    return JSON.stringify(v, Object.keys(v as Record<string, unknown>).sort());
  }
  return JSON.stringify(v);
}

/** Keys accepted by PATCH body (must match patchSchema in route). */
export const PARTNER_PATCH_LOG_FIELDS = [
  "companyName",
  "contactName",
  "contactEmail",
  "website",
  "country",
  "partnerType",
  "engineeringFeeMode",
  "engineeringFeeValue",
  "status",
  "entryFeeUsd",
  "trainingFeeUsd",
  "materialCreditUsd",
  "marginMinPct",
  "marginMaxPct",
  "minimumPricePolicy",
  "salesTargetAnnualUsd",
  "salesTargetAnnualM2",
  "agreementStartDate",
  "agreementEndDate",
  "agreementStatus",
  "visionLatamCommissionPct",
  "visionLatamCommissionFixedUsd",
  "moduleVisibility",
  "enabledSystems",
  "quotePricingDefaults",
  "requireDeliveredEngineeringForQuotes",
] as const;

export type PartnerPatchLogField = (typeof PARTNER_PATCH_LOG_FIELDS)[number];

export function buildPartnerUpdateChanges(
  before: PartnerOrgSnapshot,
  after: PartnerOrgSnapshot,
  patchKeys: readonly string[]
): PartnerFieldChange[] {
  const changes: PartnerFieldChange[] = [];
  const keySet = new Set(patchKeys);
  for (const field of PARTNER_PATCH_LOG_FIELDS) {
    if (!keySet.has(field)) continue;
    const fromVal = snapshotField(before, field);
    const toVal = snapshotField(after, field);
    if (stableStringify(fromVal) === stableStringify(toVal)) continue;
    changes.push({ field, from: fromVal, to: toVal });
  }
  return changes;
}
