import { describe, expect, it } from "vitest";
import {
  DEFAULT_WALL_M2_S80,
  LEGACY_WRONG_WALL_M2_S80,
  resolveContainerWallM2S80,
} from "../src/services/platform-config";

describe("resolveContainerWallM2S80", () => {
  it("defaults to 720 when unset or legacy 320", () => {
    expect(DEFAULT_WALL_M2_S80).toBe(720);
    expect(LEGACY_WRONG_WALL_M2_S80).toBe(320);
    expect(resolveContainerWallM2S80(undefined)).toBe(720);
    expect(resolveContainerWallM2S80(null)).toBe(720);
    expect(resolveContainerWallM2S80(320)).toBe(720);
    expect(resolveContainerWallM2S80("320")).toBe(720);
  });

  it("keeps explicit non-legacy overrides", () => {
    expect(resolveContainerWallM2S80(720)).toBe(720);
    expect(resolveContainerWallM2S80(800)).toBe(800);
  });
});
