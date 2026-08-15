export type QuoteCostMethod = "CSV" | "M2_BY_SYSTEM";

export interface QuoteWizardState {
  projectId: string;
  costMethod: QuoteCostMethod;
  baseUom: "M" | "FT";
  warehouseId: string;
  engineeringRequestId: string;
  revitImportId: string;
  unmatchedRows: Array<{
    lineId: string;
    rowIndex: number;
    revitFamily: string;
    revitType: string;
    quantity: number;
    area: number;
    mappedCatalogId: string | null;
    ignored: boolean;
  }>;
  m2S80: number;
  m2S150: number;
  m2S200: number;
  commissionPct: number;
  commissionFixed: number;
  commissionFixedPerKit: number;
  /** Partner margin % (clamped server-side to org policy). */
  partnerMarkupPct: number;
  totalKits: number;
  /** ISO 3166-1 alpha-2; taxes and freight resolution. */
  destinationCountryCode: string;
  /** Empty string = manual freight total (`freightCostUsd`). */
  freightProfileId: string;
  freightCostUsd: number;
  notes: string;
  /** Last CSV upload parse summary (server). */
  csvValidRows: number | null;
  csvInvalidRows: number | null;
  csvParseErrors: string[];
}

export const initialQuoteWizardState = (): QuoteWizardState => ({
  projectId: "",
  costMethod: "CSV",
  baseUom: "M",
  warehouseId: "",
  engineeringRequestId: "",
  revitImportId: "",
  unmatchedRows: [],
  m2S80: 0,
  m2S150: 0,
  m2S200: 0,
  commissionPct: 0,
  commissionFixed: 0,
  commissionFixedPerKit: 0,
  partnerMarkupPct: 0,
  totalKits: 0,
  destinationCountryCode: "",
  freightProfileId: "",
  freightCostUsd: 0,
  notes: "",
  csvValidRows: null,
  csvInvalidRows: null,
  csvParseErrors: [],
});
