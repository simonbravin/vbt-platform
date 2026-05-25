import { describe, expect, it } from "vitest";
import { deriveFclContainersAndMetrics, deriveFclContainersFromWallM2 } from "../src/calculations";

describe("deriveFclContainersAndMetrics", () => {
  it("uses ceil(volume/capacity) with kits and volume", () => {
    const r = deriveFclContainersAndMetrics({
      totalKits: 10,
      totalVolumeM3: 70,
      containerCapacityM3: 68,
    });
    expect(r.numContainers).toBe(2);
    expect(r.kitsPerContainer).toBe(5);
  });

  it("uses at least one container when kits exist but volume is zero", () => {
    const r = deriveFclContainersAndMetrics({
      totalKits: 3,
      totalVolumeM3: 0,
      containerCapacityM3: 68,
    });
    expect(r.numContainers).toBe(1);
    expect(r.kitsPerContainer).toBe(3);
  });

  it("defaults to one container when no kits", () => {
    const r = deriveFclContainersAndMetrics({
      totalKits: 0,
      totalVolumeM3: 100,
      containerCapacityM3: 68,
    });
    expect(r.numContainers).toBe(1);
    expect(r.kitsPerContainer).toBe(0);
  });
});

describe("deriveFclContainersFromWallM2", () => {
  const caps = {
    areaM2PerContainerS80: 320,
    areaM2PerContainerS150: 420,
    areaM2PerContainerS200: 380,
  };

  it("120 kits at ~69.65 m² S150 per kit → 20 containers, ~6 kits/container", () => {
    const r = deriveFclContainersFromWallM2({
      m2S80: 0,
      m2S150: 69.65,
      m2S200: 0,
      ...caps,
      totalKits: 120,
    });
    expect(r.numContainers).toBe(20);
    expect(r.kitsPerContainer).toBeCloseTo(6, 0);
    expect(r.slotsPerKit).toBeCloseTo(69.65 / 420, 4);
    expect(r.occupancyPerKitPct).toBeCloseTo((69.65 / 420) * 100, 1);
    expect(r.occupancyTotalPct).toBeGreaterThan(95);
  });

  it("one kit exceeding one container (1000 m² S150) → 3 containers", () => {
    const r = deriveFclContainersFromWallM2({
      m2S80: 0,
      m2S150: 1000,
      m2S200: 0,
      ...caps,
      totalKits: 1,
    });
    expect(r.numContainers).toBe(3);
    expect(r.kitsPerContainer).toBeCloseTo(1 / 3, 4);
    expect(r.occupancyPerKitPct).toBeCloseTo((1000 / 420) * 100, 1);
    expect(r.occupancyTotalPct).toBeCloseTo(((1000 / 420) / 3) * 100, 1);
  });

  it("mixed S80 + S150 per kit: additive container fractions × kits", () => {
    const slotsPerKit = 100 / 320 + 200 / 420;
    const r = deriveFclContainersFromWallM2({
      m2S80: 100,
      m2S150: 200,
      m2S200: 0,
      ...caps,
      totalKits: 10,
    });
    expect(r.slotsPerKit).toBeCloseTo(slotsPerKit, 4);
    expect(r.numContainers).toBe(Math.ceil(slotsPerKit * 10));
    expect(r.kitsPerContainer).toBeCloseTo(10 / r.numContainers, 4);
    expect(r.occupancyPerKitPct).toBeCloseTo(slotsPerKit * 100, 1);
  });

  it("defaults to one container when kits exist but no wall m²", () => {
    const r = deriveFclContainersFromWallM2({
      m2S80: 0,
      m2S150: 0,
      m2S200: 0,
      ...caps,
      totalKits: 5,
    });
    expect(r.numContainers).toBe(1);
    expect(r.kitsPerContainer).toBe(5);
    expect(r.slotsPerKit).toBe(0);
  });
});
