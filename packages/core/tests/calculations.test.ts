import { describe, it, expect } from "vitest";
import {
  computeLineMetrics,
  computeLinePrice,
  checkMinRun,
  computeFactoryCostBySystem,
  computeFactoryCostTotal,
  computeFob,
  computeCif,
  computeTaxLines,
  sumTaxLines,
  computeConcreteAndSteel,
  LBS_TO_KG,
  M_TO_FT,
} from "../src/calculations";

describe("computeLineMetrics", () => {
  it("computes linear meters from qty and height", () => {
    const r = computeLineMetrics({ qty: 10, heightMm: 2400 });
    expect(r.linearM).toBeCloseTo(24);
    expect(r.linearFt).toBeCloseTo(24 * M_TO_FT);
  });

  it("computes m2 from useful width", () => {
    const r = computeLineMetrics({ qty: 5, heightMm: 3000, usefulWidthM: 0.2286 });
    expect(r.m2Line).toBeCloseTo(5 * 3 * 0.2286);
  });

  it("computes weight from lbs/m", () => {
    const r = computeLineMetrics({ qty: 1, heightMm: 1000, lbsPerMCored: 7.191 });
    expect(r.weightLbsCored).toBeCloseTo(7.191);
    expect(r.weightKgCored).toBeCloseTo(7.191 * LBS_TO_KG);
  });

  it("computes volume", () => {
    const r = computeLineMetrics({ qty: 2, heightMm: 1000, volumePerM: 0.033 });
    expect(r.volumeM3).toBeCloseTo(0.066);
  });
});

describe("computeLinePrice", () => {
  it("prices by m when baseUom=M", () => {
    const r = computeLinePrice(10, 10 * M_TO_FT, { pricePerMCored: 5 }, "M");
    expect(r.lineTotal).toBeCloseTo(50);
    expect(r.unitPrice).toBeCloseTo(5);
  });

  it("prices by ft when baseUom=FT", () => {
    const r = computeLinePrice(10, 10 * M_TO_FT, { pricePerFtCored: 1.5 }, "FT");
    expect(r.lineTotal).toBeCloseTo(10 * M_TO_FT * 1.5);
  });

  it("derives price from 5000ft cored", () => {
    const r = computeLinePrice(1, M_TO_FT, { pricePer5000ftCored: 5000 }, "M");
    // price per ft = 1, price per m = 1/0.3048 ≈ 3.28084
    expect(r.unitPrice).toBeCloseTo(1 / 0.3048, 3);
  });

  it("applies markup", () => {
    const r = computeLinePrice(10, 0, { pricePerMCored: 5 }, "M", 10);
    expect(r.lineTotalWithMarkup).toBeCloseTo(55);
  });
});

describe("checkMinRun", () => {
  it("flags below min run", () => {
    const r = checkMinRun(1000, 5000);
    expect(r.isBelowMinRun).toBe(true);
    expect(r.productionNeeded).toBe(4000);
  });

  it("passes above min run", () => {
    const r = checkMinRun(6000, 5000);
    expect(r.isBelowMinRun).toBe(false);
    expect(r.productionNeeded).toBe(0);
  });
});

describe("computeFactoryCostBySystem", () => {
  it("sums area * rate for all systems", () => {
    const cost = computeFactoryCostBySystem({
      m2S80: 100,
      m2S150: 200,
      m2S200: 50,
      rateS80: 37,
      rateS150: 67,
      rateS200: 85,
    });
    expect(cost).toBeCloseTo(100 * 37 + 200 * 67 + 50 * 85);
  });
});

describe("computeFactoryCostTotal", () => {
  it("multiplies total m2 by global rate", () => {
    expect(computeFactoryCostTotal(350, 60)).toBeCloseTo(21000);
  });
});

describe("computeFob", () => {
  it("applies pct commission", () => {
    const r = computeFob({ factoryCost: 100000, commissionPct: 10, commissionFixed: 0 });
    expect(r.commissionAmount).toBeCloseTo(10000);
    expect(r.fobUsd).toBeCloseTo(110000);
  });

  it("applies fixed commission", () => {
    const r = computeFob({ factoryCost: 100000, commissionPct: 0, commissionFixed: 5000 });
    expect(r.commissionAmount).toBeCloseTo(5000);
  });
});

describe("computeTaxLines - Panama", () => {
  const panamaRules = [
    { order: 1, label: "ITBMS (7%)", base: "CIF" as const, ratePct: 7 },
    { order: 2, label: "Customs Broker", base: "FIXED_PER_CONTAINER" as const, fixedAmount: 250, perContainer: true },
    { order: 3, label: "Inland Transport", base: "FIXED_TOTAL" as const, fixedAmount: 1000 },
  ];

  it("computes Panama taxes correctly", () => {
    const lines = computeTaxLines({ cifUsd: 100000, fobUsd: 90000, numContainers: 2, rules: panamaRules });
    expect(lines[0].computedAmount).toBeCloseTo(7000); // 7% of 100k
    expect(lines[1].computedAmount).toBeCloseTo(500); // 250 * 2
    expect(lines[2].computedAmount).toBeCloseTo(1000);
    expect(sumTaxLines(lines)).toBeCloseTo(8500);
  });
});

describe("computeTaxLines - Argentina", () => {
  const arRules = [
    { order: 1, label: "Duty (18%)", base: "CIF" as const, ratePct: 18 },
    { order: 2, label: "Statistic (2.5%)", base: "CIF" as const, ratePct: 2.5 },
    { order: 3, label: "VAT (21%)", base: "BASE_IMPONIBLE" as const, ratePct: 21 },
    { order: 4, label: "VAT Add (20%)", base: "BASE_IMPONIBLE" as const, ratePct: 20 },
    { order: 5, label: "Income (6%)", base: "BASE_IMPONIBLE" as const, ratePct: 6 },
    { order: 6, label: "Gross Inc (3%)", base: "BASE_IMPONIBLE" as const, ratePct: 3 },
    { order: 7, label: "Broker", base: "FIXED_PER_CONTAINER" as const, fixedAmount: 725, perContainer: true },
    { order: 8, label: "Local Margin", base: "FIXED_PER_CONTAINER" as const, fixedAmount: 5000, perContainer: true },
  ];

  it("computes Argentina taxes with BASE_IMPONIBLE", () => {
    const cif = 100000;
    const lines = computeTaxLines({ cifUsd: cif, fobUsd: 90000, numContainers: 1, rules: arRules });
    const duty = cif * 0.18; // 18000
    const stat = cif * 0.025; // 2500
    const baseImp = cif + duty + stat; // 120500
    expect(lines[0].computedAmount).toBeCloseTo(duty);
    expect(lines[1].computedAmount).toBeCloseTo(stat);
    expect(lines[2].computedAmount).toBeCloseTo(baseImp * 0.21);
  });
});

describe("computeConcreteAndSteel", () => {
  it("uses default rates", () => {
    const r = computeConcreteAndSteel({ m2S80: 100, m2S150: 200, m2S200: 50 });
    expect(r.concreteM3).toBeCloseTo(100 * 0.08 + 200 * 0.15 + 50 * 0.2);
    expect(r.steelKgEst).toBeCloseTo(100 * 4 + 200 * 6 + 50 * 8);
  });
});
