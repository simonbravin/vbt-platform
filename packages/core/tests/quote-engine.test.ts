import { describe, it, expect } from "vitest";
import { buildQuoteSnapshot } from "../src/quote-engine";
import { sumTaxLines } from "../src/calculations";

const defaultOrgDefaults = {
  baseUom: "M" as const,
  minRunFt: 5000,
  rateS80: 37,
  rateS150: 67,
  rateS200: 85,
  rateGlobal: 60,
};

describe("buildQuoteSnapshot - FOB and commission", () => {
  it("FOB equals factory cost only; commission is a tax line and included in taxes & fees", () => {
    const snapshot = buildQuoteSnapshot({
      method: "M2_TOTAL",
      baseUom: "M",
      m2Total: 100,
      orgDefaults: defaultOrgDefaults,
      commissionPct: 10,
      commissionFixed: 5000,
      freightCostUsd: 2000,
      numContainers: 1,
      taxRules: [],
    });

    const factoryCostUsd = 100 * 60; // M2_TOTAL: 100 * rateGlobal 60
    expect(snapshot.factoryCostUsd).toBeCloseTo(factoryCostUsd);

    // FOB = factory only (no commission added)
    expect(snapshot.fobUsd).toBeCloseTo(factoryCostUsd);
    expect(snapshot.fobUsd).not.toBe(snapshot.factoryCostUsd + snapshot.commissionAmount);

    // Commission amount is correct (10% of factory + 5000 fixed)
    expect(snapshot.commissionAmount).toBeCloseTo(factoryCostUsd * 0.1 + 5000);

    // Tax lines include a Commission line
    const commissionLine = snapshot.taxLines.find((l) =>
      l.label.toLowerCase().includes("commission")
    );
    expect(commissionLine).toBeDefined();
    expect(commissionLine!.computedAmount).toBeCloseTo(snapshot.commissionAmount);

    // Total taxes & fees = sum of tax lines (only the commission line here)
    expect(sumTaxLines(snapshot.taxLines)).toBeCloseTo(snapshot.taxesFeesUsd);
    expect(snapshot.taxesFeesUsd).toBeCloseTo(snapshot.commissionAmount);

    // Landed DDP = CIF + taxes (includes commission)
    const cif = snapshot.fobUsd + (snapshot.freightCostUsd ?? 0);
    expect(snapshot.landedDdpUsd).toBeCloseTo(cif + snapshot.taxesFeesUsd);
  });
});
