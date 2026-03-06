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
  it("FOB = factory + % commission; only fixed commission as tax line", () => {
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

    // FOB = factory + % commission (not fixed)
    const commissionPctAmount = factoryCostUsd * 0.1;
    expect(snapshot.fobUsd).toBeCloseTo(factoryCostUsd + commissionPctAmount);

    // Full commission (for display) = % + fixed
    expect(snapshot.commissionAmount).toBeCloseTo(commissionPctAmount + 5000);

    // Tax lines: one "Commission (fixed)" with only the fixed amount
    const commissionLine = snapshot.taxLines.find((l) =>
      l.label.toLowerCase().includes("commission")
    );
    expect(commissionLine).toBeDefined();
    expect(commissionLine!.computedAmount).toBeCloseTo(5000);

    // Total taxes & fees = sum of tax lines (only the fixed commission line here)
    expect(sumTaxLines(snapshot.taxLines)).toBeCloseTo(snapshot.taxesFeesUsd);
    expect(snapshot.taxesFeesUsd).toBeCloseTo(5000);

    // Landed DDP = CIF + taxes
    const cif = snapshot.fobUsd + (snapshot.freightCostUsd ?? 0);
    expect(snapshot.landedDdpUsd).toBeCloseTo(cif + snapshot.taxesFeesUsd);
  });
});
