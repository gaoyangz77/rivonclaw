import { describe, expect, it } from "vitest";
import {
  isBootstrapExpectedSalesOutput,
  selectAffiliateProposalItems,
} from "./AffiliateManagementPage.js";

describe("AffiliateManagementPage proposal source", () => {
  it("treats an empty query result as authoritative", () => {
    expect(
      selectAffiliateProposalItems([], [{ id: "stale-pending-proposal" }]),
    ).toEqual([]);
  });

  it("uses stored proposals only before the query has returned data", () => {
    const stored = [{ id: "cached-proposal" }];

    expect(selectAffiliateProposalItems(undefined, stored)).toBe(stored);
  });

  it("prefers non-empty query results over stored proposals", () => {
    const queried = [{ id: "authoritative-proposal" }];

    expect(
      selectAffiliateProposalItems(queried, [{ id: "stale-proposal" }]),
    ).toBe(queried);
  });
});

describe("Expected Sales model-stage presentation", () => {
  it("identifies Bootstrap from either explicit stage or proxy temporal basis", () => {
    expect(
      isBootstrapExpectedSalesOutput({
        modelStage: "BOOTSTRAP",
        featureTemporalBasis: "CURRENT_STATE_PROXY",
      }),
    ).toBe(true);
    expect(
      isBootstrapExpectedSalesOutput({
        modelStage: "EVENT_TIME",
        featureTemporalBasis: "DECISION_TIME",
      }),
    ).toBe(false);
  });
});
