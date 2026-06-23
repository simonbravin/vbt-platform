import { describe, expect, it } from "vitest";
import { deriveFclContainersAndMetrics, deriveFclContainersFromWallM2 } from "../src/calculations";
import { DEFAULT_WALL_M2_S80, DEFAULT_WALL_M2_S150, DEFAULT_WALL_M2_S200 } from "../src/services/platform-config";

describe("deriveFclContainersAndMetrics", () => {
  it("platform S80 wall cap default is 720 m²", () => {
    expect(DEFAULT_WALL_M2_S80).toBe(720);
  });

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
    areaM2PerContainerS80: DEFAULT_WALL_M2_S80,
    areaM2PerContainerS150: DEFAULT_WALL_M2_S150,
    areaM2PerContainerS200: DEFAULT_WALL_M2_S200,
  };

  it("120 kits at ~69.65 m² S150 per kit → 20 containers, max 6 kits/container", () => {
    const r = deriveFclContainersFromWallM2({
      m2S80: 0,
      m2S150: 69.65,
      m2S200: 0,
      ...caps,
      totalKits: 120,
    });
    expect(r.numContainers).toBe(20);
    expect(r.kitsPerContainer).toBe(6);
    expect(r.kitsPerContainerCapacity).toBeCloseTo(420 / 69.65, 2);
    expect(r.avgKitsPerContainer).toBeCloseTo(6, 0);
    expect(r.slotsPerKit).toBeCloseTo(69.65 / 420, 4);
    expect(r.occupancyPerKitPct).toBeCloseTo((69.65 / 420) * 100, 1);
    expect(r.occupancyTotalPct).toBeGreaterThan(95);
  });

  it("135.55 m² S80 per kit, 5 kits @ 720 m² cap → 1 container, max 5 kits", () => {
    const r = deriveFclContainersFromWallM2({
      m2S80: 135.55,
      m2S150: 0,
      m2S200: 0,
      ...caps,
      totalKits: 5,
    });
    expect(r.slotsPerKit).toBeCloseTo(135.55 / 720, 4);
    expect(r.numContainers).toBe(1);
    expect(r.kitsPerContainer).toBe(5);
    expect(r.kitsPerContainerCapacity).toBeCloseTo(720 / 135.55, 2);
    expect(r.avgKitsPerContainer).toBe(5);
    expect(r.occupancyPerKitPct).toBeCloseTo((135.55 / 720) * 100, 1);
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
    expect(r.kitsPerContainer).toBe(0);
    expect(r.avgKitsPerContainer).toBeCloseTo(1 / 3, 4);
    expect(r.occupancyPerKitPct).toBeCloseTo((1000 / 420) * 100, 1);
    expect(r.occupancyTotalPct).toBeCloseTo(((1000 / 420) / 3) * 100, 1);
  });

  it("mixed S80 + S150 per kit: additive container fractions × kits", () => {
    const slotsPerKit = 100 / DEFAULT_WALL_M2_S80 + 200 / DEFAULT_WALL_M2_S150;
    const maxKits = Math.max(1, Math.floor(1 / slotsPerKit));
    const r = deriveFclContainersFromWallM2({
      m2S80: 100,
      m2S150: 200,
      m2S200: 0,
      ...caps,
      totalKits: 10,
    });
    expect(r.slotsPerKit).toBeCloseTo(slotsPerKit, 4);
    expect(r.kitsPerContainer).toBe(maxKits);
    expect(r.numContainers).toBe(Math.ceil(10 / maxKits));
    expect(r.avgKitsPerContainer).toBeCloseTo(10 / r.numContainers, 4);
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
    expect(r.kitsPerContainer).toBe(0);
    expect(r.slotsPerKit).toBe(0);
  });
});
