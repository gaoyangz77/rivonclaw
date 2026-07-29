import { describe, expect, it } from "vitest";
import {
  affiliateModelStagePresentation,
  isBootstrapModelSelection,
  isBootstrapExpectedSalesOutput,
  predictionFamilyAvailability,
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
    stage: "EVENT_TIME" | "BOOTSTRAP",
    status: "READY" | "FALLBACK" | "UNAVAILABLE",
    evaluationSummary?: Record<string, unknown> | null,
  ) => ({
    modelFamily: family,
    modelStage: stage,
    status,
    featureTemporalBasis:
      stage === "EVENT_TIME" ? "DECISION_TIME" : "CURRENT_STATE_PROXY",
    requestedTenantScope: "SHOP",
    requestedTenantId: "shop-1",
    effectiveTenantScope: status === "FALLBACK" ? "REGION" : "SHOP",
    effectiveTenantId: status === "FALLBACK" ? "user-1::region::US" : "shop-1",
    modelVersionKey: `${family}:${stage}:active`,
    contractHash: "a".repeat(64),
    contractStatus: status === "UNAVAILABLE" ? "UNAVAILABLE" : "MATCH",
    evaluationSummary: evaluationSummary as never,
  });

  it("marks Production as current when EVENT_TIME is ready", () => {
    const availability = [
      entry("EXPECTED_SALES", "EVENT_TIME", "READY"),
      entry("EXPECTED_SALES", "BOOTSTRAP", "READY"),
    ];

    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
        "EVENT_TIME",
      ).statusKey,
    ).toBe("productionCurrentReview");
    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
        "BOOTSTRAP",
      ).statusKey,
    ).toBe("bootstrapBackup");
  });

  it("marks Bootstrap as current only when its family Production is unavailable", () => {
    const availability = [
      entry("EXPECTED_SALES", "EVENT_TIME", "UNAVAILABLE"),
      entry("EXPECTED_SALES", "BOOTSTRAP", "FALLBACK"),
      entry("HUMAN_DECISION", "EVENT_TIME", "READY"),
      entry("HUMAN_DECISION", "BOOTSTRAP", "READY"),
    ];

    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
        "BOOTSTRAP",
      ).statusKey,
    ).toBe("bootstrapCurrentReview");
    expect(
      affiliateModelStagePresentation(
        availability,
        "HUMAN_DECISION",
        "BOOTSTRAP",
      ).statusKey,
    ).toBe("bootstrapBackup");
  });

  it("shows data accumulation when both stages are unavailable", () => {
    const availability = [
      entry("EXPECTED_SALES", "EVENT_TIME", "UNAVAILABLE"),
      entry("EXPECTED_SALES", "BOOTSTRAP", "UNAVAILABLE"),
    ];

    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
        "EVENT_TIME",
      ).statusKey,
    ).toBe("modelDataAccumulating");
    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
        "BOOTSTRAP",
      ).statusKey,
    ).toBe("modelDataAccumulating");
  });

  it("rejects an evaluation row that does not match the active artifact", () => {
    const staleEvaluation = {
      modelFamily: "EXPECTED_SALES",
      modelStage: "BOOTSTRAP",
      modelVersionKey: "EXPECTED_SALES:BOOTSTRAP:old",
      contractHash: "b".repeat(64),
      rowCount: 4_935,
      modelVsHumanExpectedUnitsLiftRatio: 1.819,
    };
    const availability = [
      entry(
        "EXPECTED_SALES",
        "BOOTSTRAP",
        "READY",
        staleEvaluation,
      ),
    ];

    expect(
      affiliateModelStagePresentation(
        availability,
        "EXPECTED_SALES",
        "BOOTSTRAP",
      ).evaluationSummary,
    ).toBeNull();
  });

  it("retains requested/effective scope fallback independently of evaluation", () => {
    const availability = [
      entry("HUMAN_DECISION", "BOOTSTRAP", "FALLBACK"),
    ];
    const presentation = affiliateModelStagePresentation(
      availability,
      "HUMAN_DECISION",
      "BOOTSTRAP",
    );

    expect(presentation.entry).toMatchObject({
      requestedTenantScope: "SHOP",
      requestedTenantId: "shop-1",
      effectiveTenantScope: "REGION",
      effectiveTenantId: "user-1::region::US",
    });
  });
});
