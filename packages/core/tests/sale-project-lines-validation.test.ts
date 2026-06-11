import { describe, it, expect } from "vitest";
import { validateSaleProjectLinesBaselineAndClient } from "../src/sale-project-lines-validation";

describe("validateSaleProjectLinesBaselineAndClient", () => {
  it("throws when a project has no baseline quote and line has no quoteId", () => {
    expect(() =>
      validateSaleProjectLinesBaselineAndClient(
        [{ projectId: "p1" }],
        [{ id: "p1", clientId: "c1", baselineQuoteId: null }],
        "c1"
      )
    ).toThrow(/quote/);
  });

  it("passes when line provides quoteId without project baseline", () => {
    expect(() =>
      validateSaleProjectLinesBaselineAndClient(
        [{ projectId: "p1", quoteId: "q9" }],
        [{ id: "p1", clientId: "c1", baselineQuoteId: null }],
        "c1"
      )
    ).not.toThrow();
  });

  it("throws when client does not match", () => {
    expect(() =>
      validateSaleProjectLinesBaselineAndClient(
        [{ projectId: "p1" }],
        [{ id: "p1", clientId: "c2", baselineQuoteId: "q1" }],
        "c1"
      )
    ).toThrow(/selected client/);
  });

  it("throws on duplicate project in lines", () => {
    expect(() =>
      validateSaleProjectLinesBaselineAndClient(
        [{ projectId: "p1" }, { projectId: "p1" }],
        [{ id: "p1", clientId: "c1", baselineQuoteId: "q1" }],
        "c1"
      )
    ).toThrow(/Duplicate project/);
  });

  it("throws when a project id is missing from loaded rows", () => {
    expect(() =>
      validateSaleProjectLinesBaselineAndClient([{ projectId: "p1" }, { projectId: "p2" }], [{ id: "p1", clientId: "c1", baselineQuoteId: "q1" }], "c1")
    ).toThrow(/not found/);
  });

  it("passes for two valid projects with baseline", () => {
    expect(() =>
      validateSaleProjectLinesBaselineAndClient(
        [{ projectId: "p1" }, { projectId: "p2" }],
        [
          { id: "p1", clientId: "c1", baselineQuoteId: "q1" },
          { id: "p2", clientId: "c1", baselineQuoteId: "q2" },
        ],
        "c1"
      )
    ).not.toThrow();
  });

  it("passes for two valid projects with explicit quoteId per line", () => {
    expect(() =>
      validateSaleProjectLinesBaselineAndClient(
        [
          { projectId: "p1", quoteId: "q1" },
          { projectId: "p2", quoteId: "q2" },
        ],
        [
          { id: "p1", clientId: "c1", baselineQuoteId: null },
          { id: "p2", clientId: "c1", baselineQuoteId: null },
        ],
        "c1"
      )
    ).not.toThrow();
  });
});
