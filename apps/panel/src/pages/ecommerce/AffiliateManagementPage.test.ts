import { describe, expect, it } from "vitest";
import {
  applyAffiliateProposalChange,
  affiliateModelStagePresentation,
  affiliateTrainingDatasetCounts,
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
  it("separates final production training rows from the holdout evaluation slice", () => {
    expect(
      affiliateTrainingDatasetCounts({
        rowCount: 418,
        payload: {
          evaluation_method: {
            fit_rows: 1_575,
            holdout_rows: 418,
          },
        },
      }),
    ).toEqual({
      productionTrainingRows: 1_993,
      fitRows: 1_575,
      holdoutRows: 418,
      currentEvaluationRows: 418,
    });
  });

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

  it("rejects an evaluation row that does not match the active artifact", () => {
    const staleEvaluation = {
      modelFamily: "EXPECTED_SALES",
      modelStage: "UNIFIED",
      modelVersionKey: "EXPECTED_SALES:UNIFIED:old",
      contractHash: "b".repeat(64),
      rowCount: 4_935,
      modelVsHumanExpectedUnitsLiftRatio: 1.819,
    };
    const availability = [
      entry(
        "EXPECTED_SALES",
        "READY",
        staleEvaluation,
      ),
    ];

    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
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
