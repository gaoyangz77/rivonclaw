import { describe, expect, it } from "vitest";
import {
  applyAffiliateProposalChange,
  affiliateModelStagePresentation,
  isBootstrapModelSelection,
  isBootstrapExpectedSalesOutput,
  mergeAffiliateProposalPage,
  predictionFamilyAvailability,
  selectAffiliateProposalItems,
} from "./AffiliateManagementPage.js";

describe("AffiliateManagementPage proposal source", () => {
  const proposal = (id: string, status: string, type = "SEND_MESSAGE", shopId = "shop-1") => ({
    id,
    status,
    type,
    focusShopId: shopId,
  } as never);

  it("appends cursor pages without duplicating proposals", () => {
    expect(
      mergeAffiliateProposalPage(
        [proposal("proposal-1", "PENDING"), proposal("proposal-2", "PENDING")],
        [proposal("proposal-2", "PENDING"), proposal("proposal-3", "PENDING")],
      ).map((item) => item.id),
    ).toEqual(["proposal-1", "proposal-2", "proposal-3"]);
  });

  it("removes a locally decided proposal from the pending queue", () => {
    expect(
      applyAffiliateProposalChange(
        [proposal("proposal-1", "PENDING"), proposal("proposal-2", "PENDING")],
        proposal("proposal-1", "APPROVED"),
        { status: "PENDING" as never },
      ).map((item) => item.id),
    ).toEqual(["proposal-2"]);
  });

  it("updates a decided proposal in place when viewing all statuses", () => {
    const updated = applyAffiliateProposalChange(
      [proposal("proposal-1", "PENDING"), proposal("proposal-2", "PENDING")],
      proposal("proposal-1", "REJECTED"),
      {},
    );

    expect(updated.map((item) => `${item.id}:${item.status}`)).toEqual([
      "proposal-1:REJECTED",
      "proposal-2:PENDING",
    ]);
  });

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

  it("keeps Expected Sales and Human Decision stages independent", () => {
    expect(
      isBootstrapModelSelection({
        modelStage: "EVENT_TIME",
        featureTemporalBasis: "DECISION_TIME",
      }),
    ).toBe(false);
    expect(
      isBootstrapModelSelection({
        modelStage: "BOOTSTRAP",
        featureTemporalBasis: "CURRENT_STATE_PROXY",
      }),
    ).toBe(true);
  });

  it.each([
    ["both ready", "OK", "OK", true, true],
    ["Expected only", "OK", "PREDICTION_NOT_AVAILABLE", true, false],
    ["Human only", "PREDICTION_NOT_AVAILABLE", "OK", false, true],
    [
      "neither ready",
      "PREDICTION_NOT_AVAILABLE",
      "PREDICTION_NOT_AVAILABLE",
      false,
      false,
    ],
  ])(
    "keeps family availability independent: %s",
    (
      _label,
      expectedSalesStatus,
      humanDecisionStatus,
      expectedSalesReady,
      humanDecisionReady,
    ) => {
      expect(
        predictionFamilyAvailability({
          expectedSalesStatus,
          humanDecisionStatus,
        }),
      ).toEqual({
        expectedSalesReady,
        humanDecisionReady,
        hasFamilyResult: true,
      });
    },
  );
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

  const entry = (
    family: "EXPECTED_SALES" | "HUMAN_DECISION",
    status: "READY" | "FALLBACK" | "UNAVAILABLE",
    evaluationSummary?: Record<string, unknown> | null,
  ) => ({
    modelFamily: family,
    modelStage: "UNIFIED",
    status,
    featureTemporalBasis: "BEST_AVAILABLE",
    requestedTenantScope: "SHOP",
    requestedTenantId: "shop-1",
    effectiveTenantScope: status === "FALLBACK" ? "REGION" : "SHOP",
    effectiveTenantId: status === "FALLBACK" ? "user-1::region::US" : "shop-1",
    modelVersionKey: `${family}:UNIFIED:active`,
    contractHash: "a".repeat(64),
    contractStatus: status === "UNAVAILABLE" ? "UNAVAILABLE" : "MATCH",
    evaluationSummary: evaluationSummary as never,
  });

  it("marks the unified best-available artifact as current", () => {
    const availability = [entry("EXPECTED_SALES", "READY")];

    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
        "UNIFIED",
      ).statusKey,
    ).toBe("bestAvailableCurrentReview");
  });

  it("treats same-user scope fallback as the current unified artifact", () => {
    const availability = [entry("EXPECTED_SALES", "FALLBACK")];

    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
        "UNIFIED",
      ).statusKey,
    ).toBe("bestAvailableCurrentReview");
  });

  it("shows data accumulation when the unified family is unavailable", () => {
    const availability = [entry("EXPECTED_SALES", "UNAVAILABLE")];

    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
        "UNIFIED",
      ).statusKey,
    ).toBe("modelDataAccumulating");
  });

  it("shows a seller-safe comparison without internal model identity fields", () => {
    const sellerSafeEvaluation = {
      comparisonAvailable: true,
      historicalApplicationCount: 18_065,
      historicalSelectedCount: 558,
      modelSelectedCount: 558,
      selectionDifferenceCount: 490,
      historicalExpectedUnits: 93.45,
      modelExpectedUnits: 214.82,
      expectedSalesLiftRatio: 2.2987,
      confidenceLevel: "high",
    };
    const availability = [
      entry(
        "EXPECTED_SALES",
        "READY",
        sellerSafeEvaluation,
      ),
    ];

    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
        "UNIFIED",
      ).evaluationSummary,
    ).toBe(sellerSafeEvaluation);
  });

  it("does not expose a comparison when the parent contract does not match", () => {
    const availability = [{
      ...entry("EXPECTED_SALES", "READY", { comparisonAvailable: true }),
      contractStatus: "MISMATCH",
    }];

    const presentation = affiliateModelStagePresentation(
      availability,
      "EXPECTED_SALES",
      "UNIFIED",
    );

    expect(presentation.ready).toBe(false);
    expect(presentation.evaluationSummary).toBeNull();
  });

  it("never uses Human Decision comparison availability for Expected Sales", () => {
    const humanEvaluation = { comparisonAvailable: false };
    const expectedEvaluation = {
      comparisonAvailable: true,
      historicalApplicationCount: 18_065,
    };
    const availability = [
      entry("HUMAN_DECISION", "READY", humanEvaluation),
      entry("EXPECTED_SALES", "READY", expectedEvaluation),
    ];

    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
        "UNIFIED",
      ).evaluationSummary,
    ).toBe(expectedEvaluation);
    expect(
      affiliateModelStagePresentation(
        availability,
        "HUMAN_DECISION",
        "UNIFIED",
      ).evaluationSummary,
    ).toBeNull();
  });

  it("retains requested/effective scope fallback independently of evaluation", () => {
    const availability = [
      entry("HUMAN_DECISION", "FALLBACK"),
    ];
    const presentation = affiliateModelStagePresentation(
      availability,
      "HUMAN_DECISION",
      "UNIFIED",
    );

    expect(presentation.entry).toMatchObject({
      requestedTenantScope: "SHOP",
      requestedTenantId: "shop-1",
      effectiveTenantScope: "REGION",
      effectiveTenantId: "user-1::region::US",
    });
  });
});
