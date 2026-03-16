/**
 * Shared state type for the legacy quote wizard (steps 3–6).
 * The wizard at /quotes/new is deprecated and redirects to /quotes/create;
 * this type is kept so step components still compile if referenced elsewhere.
 */
export interface QuoteWizardState {
  projectId: string;
  costMethod: "CSV" | "M2_BY_SYSTEM";
  baseUom: "M" | "FT";
  warehouseId?: string;
  reserveStock: boolean;
  revitImportId?: string;
  importRows?: unknown[];
  m2S80: number;
  m2S150: number;
  m2S200: number;
  m2Total: number;
  csvLines?: unknown[];
  commissionPct: number;
  commissionFixed: number;
  commissionFixedPerKit: number;
  kitsPerContainer: number;
  totalKits: number;
  numContainers: number;
  countryId?: string;
  freightProfileId?: string;
  freightCostUsd: number;
  taxRuleSetId?: string;
  notes?: string;
  factoryCostUsd?: number;
  fobUsd?: number;
  cifUsd?: number;
  taxesFeesUsd?: number;
  landedDdpUsd?: number;
}
