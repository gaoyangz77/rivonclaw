import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GQL } from "@rivonclaw/core";
import {
  affiliateProposalPageQueryKey,
  appendAffiliateProposalPageBuffer,
  applyAffiliateProposalChange,
  affiliateModelStagePresentation,
  affiliateExpectedSalesModelAvailabilityState,
  affiliateCommissionPercentToBps,
  affiliateDelimitedIdentifiers,
  affiliateSellerSafeMetrics,
  emptyAffiliateProposalPageBuffer,
  formatExpectedSalesUnits,
  getProposalActionProductId,
  groupAgentWorkBundles,
  mergeAffiliateProposalPage,
  predictionEvidenceHighlightTarget,
  predictionSignalFallbackLabel,
  resolvePredictionEvidenceState,
  proposalSampleDecisionOverrideTarget,
  proposalSampleReviewRows,
  replaceAffiliateProposalPageBuffer,
  selectAffiliateProposalItems,
  sortAffiliateProposalsNewestFirst,
  summarizeSampleProposalReviewRows,
} from "./AffiliateManagementPage.js";

describe("AffiliateManagementPage proposal source", () => {
  const proposal = (id: string, status: string, type = "SEND_MESSAGE", shopId = "shop-1"): GQL.ActionProposal => ({
    id,
    status,
    type,
    focusShopId: shopId,
    steps: [],
    creatorRelationship: null,
  } as unknown as GQL.ActionProposal);

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

  it("moves a changed proposal to the front when viewing all statuses", () => {
    const updated = applyAffiliateProposalChange(
      [proposal("proposal-1", "PENDING"), proposal("proposal-2", "PENDING")],
      proposal("proposal-2", "REJECTED"),
      {},
    );

    expect(updated.map((item) => `${item.id}:${item.status}`)).toEqual([
      "proposal-2:REJECTED",
      "proposal-1:PENDING",
    ]);
  });

  it("orders the proposal timeline by creation time, not later status updates", () => {
    const older = {
      ...proposal("proposal-older", "PENDING"),
      createdAt: "2026-08-13T01:00:00.000Z",
      updatedAt: "2026-08-13T09:00:00.000Z",
    } as GQL.ActionProposal;
    const newer = {
      ...proposal("proposal-newer", "PENDING"),
      createdAt: "2026-08-13T02:00:00.000Z",
      updatedAt: "2026-08-13T02:00:00.000Z",
    } as GQL.ActionProposal;

    expect(sortAffiliateProposalsNewestFirst([older, newer]).map((item) => item.id))
      .toEqual(["proposal-newer", "proposal-older"]);
  });

  it("groups rewrite versions into one Agent work bundle", () => {
    const rootId = "proposal-v1";
    const revisionHistory = [
      {
        id: rootId,
        type: GQL.ActionProposalType.SendMessage,
        status: GQL.ActionProposalStatus.Superseded,
        operatorSummary: "First draft",
        revisionNumber: 1,
        revisionRootProposalId: rootId,
        createdAt: "2026-08-13T01:00:00.000Z",
        updatedAt: "2026-08-13T01:10:00.000Z",
      },
      {
        id: "proposal-v2",
        type: GQL.ActionProposalType.NoActionNeeded,
        status: GQL.ActionProposalStatus.Executed,
        operatorSummary: "No reply needed after rewrite",
        revisionNumber: 2,
        revisionOfProposalId: rootId,
        revisionRootProposalId: rootId,
        createdAt: "2026-08-13T01:15:00.000Z",
        updatedAt: "2026-08-13T01:15:00.000Z",
      },
    ] as GQL.ActionProposalRevisionSummary[];
    const v1 = {
      ...proposal(rootId, "SUPERSEDED"),
      revisionNumber: 1,
      revisionRootProposalId: rootId,
      revisionHistory,
      createdAt: revisionHistory[0]!.createdAt,
    } as GQL.ActionProposal;
    const v2 = {
      ...proposal("proposal-v2", "EXECUTED", "NO_ACTION_NEEDED"),
      revisionNumber: 2,
      revisionOfProposalId: rootId,
      revisionRootProposalId: rootId,
      revisionHistory,
      createdAt: revisionHistory[1]!.createdAt,
    } as GQL.ActionProposal;

    expect(groupAgentWorkBundles([v1, v2])).toEqual([
      expect.objectContaining({
        rootProposalId: rootId,
        proposal: v2,
        revisionHistory,
      }),
    ]);
  });

  it("accepts a realtime proposal that targets the selected shop through a secondary step", () => {
    const multiShopProposal = {
      ...proposal("proposal-2", "PENDING", "SEND_MESSAGE", "shop-1"),
      steps: [{ shopId: "shop-2" }],
    } as GQL.ActionProposal;

    expect(applyAffiliateProposalChange([], multiShopProposal, { shopId: "shop-2" as never }))
      .toEqual([multiShopProposal]);
  });

  it("keeps proposal pagination state isolated by account and filters", () => {
    const pendingKey = affiliateProposalPageQueryKey({
      userId: "user-1",
      status: "PENDING" as never,
    });
    const approvedKey = affiliateProposalPageQueryKey({
      userId: "user-1",
      status: "APPROVED" as never,
    });
    const otherUserKey = affiliateProposalPageQueryKey({
      userId: "user-2",
      status: "PENDING" as never,
    });
    const pendingPage = {
      items: [proposal("proposal-1", "PENDING")],
      nextCursor: "cursor-1",
      hasMore: true,
    };
    const pending = replaceAffiliateProposalPageBuffer(pendingKey, pendingPage as never);

    expect(pending.queryKey).not.toBe(approvedKey);
    expect(pending.queryKey).not.toBe(otherUserKey);
    expect(emptyAffiliateProposalPageBuffer(approvedKey).items).toEqual([]);
    expect(
      appendAffiliateProposalPageBuffer(pending, approvedKey, {
        items: [proposal("proposal-2", "APPROVED")],
        nextCursor: null,
        hasMore: false,
      } as never),
    ).toBe(pending);
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

  const signalFixture = (
    family: "EXPECTED_SALES" | "HUMAN_DECISION",
    overrides: Record<string, unknown> = {},
  ) => ({
    family,
    status: "NOT_AVAILABLE",
    selection: {
      requestedScope: "SHOP",
      effectiveScope: null,
      modelVersion: null,
      evaluatedScopes: [],
    },
    error: null,
    value: null,
    ...overrides,
  });

  const evidenceFixture = (
    mode:
      | "EXPECTED_SALES_TRUSTED"
      | "MERCHANT_APPROVAL_TENDENCY"
      | "NO_MODEL_SIGNAL"
      | "MODEL_SIGNAL_ERROR",
    overrides: {
      expectedSales?: Record<string, unknown>;
      humanDecision?: Record<string, unknown>;
    } = {},
  ) => ({
    evidenceMode: mode,
    expectedSales: signalFixture("EXPECTED_SALES", overrides.expectedSales),
    humanDecision: signalFixture("HUMAN_DECISION", overrides.humanDecision),
  }) as unknown as GQL.AffiliatePredictionEvidence;

  it.each([
    ["EXPECTED_SALES_TRUSTED", "EXPECTED_SALES"],
    ["MERCHANT_APPROVAL_TENDENCY", "HUMAN_DECISION"],
    ["NO_MODEL_SIGNAL", "NONE"],
    ["MODEL_SIGNAL_ERROR", "NONE"],
  ] as const)(
    "maps the frozen evidence mode 1:1 to the highlight target: %s → %s",
    (mode, expected) => {
      expect(
        predictionEvidenceHighlightTarget({ evidenceMode: mode }),
      ).toBe(expected);
    },
  );

  it("classifies the typed evidence field: evidence / request failure / contract violation", () => {
    expect(resolvePredictionEvidenceState(null)).toBeNull();

    const withEvidence = resolvePredictionEvidenceState({
      status: "OK",
      predictionEvidence: evidenceFixture("EXPECTED_SALES_TRUSTED", {
        expectedSales: {
          status: "READY",
          value: { units: 2.4, reliability: "TRUSTED", reliabilityReasons: [] },
        },
      }),
    });
    expect(withEvidence?.kind).toBe("EVIDENCE");
    expect(
      withEvidence?.kind === "EVIDENCE"
        ? withEvidence.evidence.expectedSales.value?.units
        : undefined,
    ).toBe(2.4);

    // Evidence null + snapshot status not OK = the request itself failed:
    // rendered from the snapshot's own status/message, not as a violation.
    expect(
      resolvePredictionEvidenceState({
        status: "SERVICE_ERROR",
        message: "prediction backend unreachable",
      }),
    ).toEqual({
      kind: "REQUEST_FAILED",
      status: "SERVICE_ERROR",
      message: "prediction backend unreachable",
    });

    // Snapshot OK but the typed evidence field is absent = contract violation.
    expect(resolvePredictionEvidenceState({ status: "OK" })).toEqual({
      kind: "CONTRACT_VIOLATION",
    });
    // Legacy payloads inside `output` are ignored entirely — no fallback.
    expect(
      resolvePredictionEvidenceState({
        status: "OK",
        output: { legacyFlatStatusField: "OK", legacyUnitsField: 2.4 },
      }),
    ).toEqual({ kind: "CONTRACT_VIOLATION" });
  });

  it("renders signal fallbacks from the family's own error code and never from a status", () => {
    expect(
      predictionSignalFallbackLabel({ status: "READY", error: null }, "不可用"),
    ).toBeNull();
    // NOT_AVAILABLE is the sanctioned absence: plain text, no parenthetical,
    // even when a stray error object is present.
    expect(
      predictionSignalFallbackLabel(
        { status: "NOT_AVAILABLE", error: { code: "DATA_NOT_READY" } },
        "不可用",
      ),
    ).toBe("不可用");
    expect(
      predictionSignalFallbackLabel(
        { status: "ERROR", error: { code: "SERVICE_ERROR" } },
        "不可用",
      ),
    ).toBe("不可用 (SERVICE_ERROR)");
    expect(
      predictionSignalFallbackLabel({ status: "ERROR", error: null }, "不可用"),
    ).toBe("不可用 (ERROR)");
    // "不可用 (OK)" must be impossible: the signal status is never printed.
    for (const status of ["READY", "NOT_AVAILABLE", "ERROR"] as const) {
      const label = predictionSignalFallbackLabel(
        { status, error: { code: "ARTIFACT_INVALID" } },
        "不可用",
      );
      expect(label ?? "").not.toContain("(OK)");
    }
  });

  it("keeps every Sample Application decision in one proposal and binds its exact prediction", () => {
    const multiSampleProposal = {
      ...proposal("proposal-multi", "PENDING", "REVIEW_SAMPLE_APPLICATION"),
      sampleReviewIntent: {
        sampleApplicationRecordId: "sample-1",
        platformApplicationId: "platform-1",
        decision: "APPROVE",
      },
      predictionSnapshots: [
        {
          sourceCacheId: "prediction-2",
          status: "OK",
          capturedAt: "2026-08-13T02:00:00.000Z",
          predictionEvidence: evidenceFixture("EXPECTED_SALES_TRUSTED", {
            expectedSales: {
              status: "READY",
              value: { units: 0.22, reliability: "TRUSTED", reliabilityReasons: [] },
            },
          }),
          subject: { sampleApplicationRecordId: "sample-2" },
          resolvedContext: { productId: "product-2", productTitle: "Product two" },
        },
        {
          sourceCacheId: "prediction-1",
          status: "OK",
          capturedAt: "2026-08-13T01:00:00.000Z",
          predictionEvidence: evidenceFixture("EXPECTED_SALES_TRUSTED", {
            expectedSales: {
              status: "READY",
              value: { units: 3.75, reliability: "TRUSTED", reliabilityReasons: [] },
            },
          }),
          subject: { sampleApplicationRecordId: "sample-1" },
          resolvedContext: { productId: "product-1", productTitle: "Product one" },
        },
      ],
      steps: [
        {
          stepId: "step-1",
          shopId: "shop-1",
          type: "REVIEW_SAMPLE_APPLICATION",
          productId: "product-1",
          sampleApplicationRecordId: "sample-1",
          predictionCacheIds: ["prediction-1"],
          sampleReviewIntent: {
            sampleApplicationRecordId: "sample-1",
            platformApplicationId: "platform-1",
            decision: "APPROVE",
          },
        },
        {
          stepId: "step-2",
          shopId: "shop-2",
          type: "REVIEW_SAMPLE_APPLICATION",
          productId: "product-2",
          sampleApplicationRecordId: "sample-2",
          predictionCacheIds: ["prediction-2"],
          sampleReviewIntent: {
            sampleApplicationRecordId: "sample-2",
            platformApplicationId: "platform-2",
            decision: "REJECT",
            rejectReason: "OTHER",
            rejectReasonExplanation: "Creator quality evidence is below the shop requirement.",
          },
        },
      ],
    } as unknown as GQL.ActionProposal;

    const rows = proposalSampleReviewRows(multiSampleProposal);

    expect(rows).toHaveLength(2);
    expect(
      rows.every((row) => !Object.prototype.hasOwnProperty.call(row, "operatorSummary")),
    ).toBe(true);
    expect(rows.map((row) => ({
      sampleId: row.sampleApplicationRecordId,
      decision: row.decision,
      productTitle: row.productTitle,
      expectedSalesUnits: (() => {
        const state = resolvePredictionEvidenceState(row.predictionSnapshot);
        return state?.kind === "EVIDENCE"
          ? state.evidence.expectedSales.value?.units
          : undefined;
      })(),
      rejectReason: row.rejectReason,
      rejectReasonExplanation: row.rejectReasonExplanation,
    }))).toEqual([
      {
        sampleId: "sample-1",
        decision: "APPROVE",
        productTitle: "Product one",
        expectedSalesUnits: 3.75,
        rejectReason: null,
        rejectReasonExplanation: null,
      },
      {
        sampleId: "sample-2",
        decision: "REJECT",
        productTitle: "Product two",
        expectedSalesUnits: 0.22,
        rejectReason: "OTHER",
        rejectReasonExplanation: "Creator quality evidence is below the shop requirement.",
      },
    ]);
    expect(summarizeSampleProposalReviewRows(rows)).toEqual({
      approveCount: 1,
      rejectCount: 1,
    });
  });

  it("uses an existing Seller SKU when a Sample product title is unavailable", () => {
    const sampleProposal = {
      ...proposal("proposal-seller-sku", "PENDING", "REVIEW_SAMPLE_APPLICATION"),
      productId: "product-1",
      productSummary: {
        productId: "product-1",
        skus: [{ skuId: "sku-1", sellerSku: "SELLER-ROPE-01" }],
      },
      sampleReviewIntent: {
        sampleApplicationRecordId: "sample-1",
        platformApplicationId: "platform-1",
        decision: "REJECT",
        rejectReason: "OUT_OF_STOCK",
      },
    } as unknown as GQL.ActionProposal;

    expect(proposalSampleReviewRows(sampleProposal)[0]).toMatchObject({
      productTitle: null,
      productSellerSku: "SELLER-ROPE-01",
      rejectReason: "OUT_OF_STOCK",
      rejectReasonExplanation: null,
    });
  });

  it("formats expected sales to two decimal places", () => {
    expect(formatExpectedSalesUnits(2.2502386227488933)).toBe("2.25");
    expect(formatExpectedSalesUnits(0.2)).toBe("0.20");
  });

  it("does not attach an unrelated prediction to a Sample step", () => {
    const proposalWithoutMatchingPrediction = {
      ...proposal("proposal-no-match", "PENDING", "REVIEW_SAMPLE_APPLICATION"),
      predictionSnapshots: [
        {
          sourceCacheId: "prediction-other",
          status: "OK",
          predictionEvidence: evidenceFixture("EXPECTED_SALES_TRUSTED", {
            expectedSales: {
              status: "READY",
              value: { units: 9, reliability: "TRUSTED", reliabilityReasons: [] },
            },
          }),
          subject: { sampleApplicationRecordId: "sample-other" },
        },
        {
          sourceCacheId: "prediction-another",
          status: "OK",
          predictionEvidence: evidenceFixture("EXPECTED_SALES_TRUSTED", {
            expectedSales: {
              status: "READY",
              value: { units: 8, reliability: "TRUSTED", reliabilityReasons: [] },
            },
          }),
          subject: { sampleApplicationRecordId: "sample-another" },
        },
      ],
      steps: [{
        stepId: "step-target",
        shopId: "shop-1",
        type: "REVIEW_SAMPLE_APPLICATION",
        productId: "product-target",
        sampleApplicationRecordId: "sample-target",
        predictionCacheIds: ["prediction-target"],
        sampleReviewIntent: {
          sampleApplicationRecordId: "sample-target",
          platformApplicationId: "platform-target",
          decision: "APPROVE",
        },
      }],
    } as unknown as GQL.ActionProposal;

    expect(proposalSampleReviewRows(proposalWithoutMatchingPrediction)[0]?.predictionSnapshot)
      .toBeNull();
  });

  it("offers rejection only as the opposite decision for one pure Sample action", () => {
    const singleApprove = {
      ...proposal("proposal-single-approve", "PENDING", "REVIEW_SAMPLE_APPLICATION"),
      sampleReviewIntent: {
        sampleApplicationRecordId: "sample-1",
        platformApplicationId: "platform-1",
        decision: "APPROVE",
      },
      steps: [{
        stepId: "step-1",
        type: "REVIEW_SAMPLE_APPLICATION",
        sampleReviewIntent: {
          sampleApplicationRecordId: "sample-1",
          platformApplicationId: "platform-1",
          decision: "APPROVE",
        },
      }],
    } as unknown as GQL.ActionProposal;
    const singleReject = {
      ...singleApprove,
      id: "proposal-single-reject",
      sampleReviewIntent: {
        ...singleApprove.sampleReviewIntent!,
        decision: "REJECT",
      },
      steps: [{
        ...singleApprove.steps[0]!,
        sampleReviewIntent: {
          ...singleApprove.steps[0]!.sampleReviewIntent!,
          decision: "REJECT",
        },
      }],
    } as unknown as GQL.ActionProposal;

    expect(proposalSampleDecisionOverrideTarget(singleApprove)).toBe("REJECT");
    expect(proposalSampleDecisionOverrideTarget(singleReject)).toBe("APPROVE");
  });

  it("hides rejection for multi-Sample and mixed-action proposals", () => {
    const single = {
      ...proposal("proposal-single", "PENDING", "REVIEW_SAMPLE_APPLICATION"),
      sampleReviewIntent: {
        sampleApplicationRecordId: "sample-1",
        platformApplicationId: "platform-1",
        decision: "APPROVE",
      },
      steps: [{
        stepId: "step-1",
        type: "REVIEW_SAMPLE_APPLICATION",
        sampleReviewIntent: {
          sampleApplicationRecordId: "sample-1",
          platformApplicationId: "platform-1",
          decision: "APPROVE",
        },
      }],
    } as unknown as GQL.ActionProposal;
    const multi = {
      ...single,
      steps: [
        single.steps[0],
        { ...single.steps[0], stepId: "step-2" },
      ],
    } as GQL.ActionProposal;
    const mixed = {
      ...single,
      messageIntent: { parts: [{ kind: "TEXT", text: "hello" }] },
    } as unknown as GQL.ActionProposal;

    expect(proposalSampleDecisionOverrideTarget(multi)).toBeNull();
    expect(proposalSampleDecisionOverrideTarget(mixed)).toBeNull();
    expect(proposalSampleDecisionOverrideTarget(
      proposal("proposal-message", "PENDING", "SEND_MESSAGE"),
    )).toBeNull();
  });

  it("does not treat a Sample-trigger provenance product as part of a text-only reply", () => {
    const reply = {
      ...proposal("proposal-reply", "PENDING", "SEND_MESSAGE"),
      productId: "provenance-product",
      sampleApplicationRecordId: "sample-1",
      sampleApplicationRecord: { productId: "provenance-product" },
      productSummary: { productId: "provenance-product", title: "Historical product" },
      messageIntent: {
        parts: [{ kind: "TEXT", text: "Thanks!" }],
      },
    } as unknown as GQL.ActionProposal;

    expect(getProposalActionProductId(reply)).toBeNull();
  });

  it("shows product context only when the proposed action actually carries a product", () => {
    const productCardReply = {
      ...proposal("proposal-product-card", "PENDING", "SEND_MESSAGE"),
      productId: "provenance-product",
      messageIntent: {
        parts: [
          { kind: "TEXT", text: "Here is the product." },
          { kind: "PRODUCT_CARD", productId: "action-product" },
        ],
      },
    } as unknown as GQL.ActionProposal;

    expect(getProposalActionProductId(productCardReply)).toBe("action-product");
  });
});

describe("Affiliate canonical UI contract", () => {
  it("converts operator-friendly commissions and identifier lists into API-safe values", () => {
    expect(affiliateCommissionPercentToBps("25")).toBe(2500);
    expect(affiliateCommissionPercentToBps("12.5")).toBe(1250);
    expect(() => affiliateCommissionPercentToBps("0.5")).toThrow(/1% and 80%/);
    expect(() => affiliateCommissionPercentToBps("81")).toThrow(/1% and 80%/);
    expect(affiliateDelimitedIdentifiers("creator-1, creator-2\ncreator-1"))
      .toEqual(["creator-1", "creator-2"]);
  });

  it("renders create, settings, edit, and stop controls for platform collaborations", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );

    expect(page).toContain("AffiliateCollaborationCreateModal");
    expect(page).toContain("AffiliateOpenCollaborationSettingsModal");
    expect(page).toContain("AffiliateOpenCollaborationEditor");
    expect(page).toContain("AffiliateTargetCollaborationEditor");
    expect(page).toContain("REMOVE_AFFILIATE_OPEN_COLLABORATION_MUTATION");
    expect(page).toContain("REMOVE_AFFILIATE_TARGET_COLLABORATION_MUTATION");
  });

  it("does not reintroduce CollaborationRecord compatibility identifiers", () => {
    const sources = [
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      resolve(process.cwd(), "src/api/shops-queries.ts"),
      resolve(process.cwd(), "../../packages/core/src/models/Affiliate.ts"),
    ].map((path) => readFileSync(path, "utf8"));

    for (const source of sources) {
      expect(source).not.toMatch(/collaborationRecord/i);
    }
  });

  it("defaults platform inventory to Open collaborations and exposes a real detail query", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const queries = readFileSync(
      resolve(process.cwd(), "src/api/shops-queries.ts"),
      "utf8",
    );

    expect(page).toContain(
      "useState<HistoryTypeFilter>(GQL.AffiliateCollaborationType.Open)",
    );
    expect(page).toContain("AffiliateCollaborationDetailModal");
    expect(queries).toContain("query AffiliateCollaborationDetail");
    expect(queries).toContain("shopActivitySummaries");
  });

  it("keeps Creator pagination totals stable while cache-and-network fetches a new page", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );

    expect(page).toContain("stableCreatorTotalCount");
    expect(page).toContain("if (!creatorPageResult) return;");
  });

  it("shows natural AI Team ownership without offering an unassign action", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const queries = readFileSync(
      resolve(process.cwd(), "src/api/shops-queries.ts"),
      "utf8",
    );

    expect(page).toContain('placeholder={t("ecommerce.affiliateTeam.aiTeam")}');
    expect(page).not.toContain("__AI_TEAM__");
    expect(page).not.toContain("unassignAffiliateBusinessDeveloper");
    expect(queries).not.toContain("unassignAffiliateBusinessDeveloper");
  });

  it("separates the pending-only scope switch from workspace filters", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );

    expect(page).toContain("affiliate-agent-workspace-controls");
    expect(page).toContain('aria-pressed={agentWorkspaceView === "PENDING"}');
    expect(page).toContain("affiliate-agent-workspace-scope-check");
    expect(page).not.toContain('role="switch"');
    expect(page).not.toContain("AGENT_WORKSPACE_VIEWS.map");
    expect(page).not.toContain("ecommerce.affiliateWorkspace.approvalQueueTitle");
    expect(page).not.toContain("ecommerce.affiliateWorkspace.approvalQueueHint");
  });

  it("lets staff decide a policy-gated no-action proposal", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );

    // A NO_ACTION_NEEDED proposal can now be held PENDING by approval policy, so
    // the review card must not exclude it from the decision actions.
    expect(page).not.toContain(
      "proposal.type !== GQL.ActionProposalType.NoActionNeeded",
    );
    expect(page).toContain("ecommerce.affiliateWorkspace.noActionDecision.confirm");
    expect(page).toContain(
      "ecommerce.affiliateWorkspace.proposalExecutionDescriptions.NO_ACTION_NEEDED_PENDING",
    );
  });
});

describe("Expected Sales model-stage presentation", () => {
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

  it("derives exact, fallback, and unavailable states from live availability", () => {
    expect(affiliateExpectedSalesModelAvailabilityState([
      entry("EXPECTED_SALES", "READY"),
    ])).toMatchObject({ status: "ready", effectiveTenantScope: "SHOP" });
    expect(affiliateExpectedSalesModelAvailabilityState([
      entry("EXPECTED_SALES", "FALLBACK"),
    ])).toMatchObject({ status: "fallback", effectiveTenantScope: "REGION" });
    expect(affiliateExpectedSalesModelAvailabilityState([
      entry("EXPECTED_SALES", "UNAVAILABLE"),
    ])).toMatchObject({ status: "unavailable" });
    expect(affiliateExpectedSalesModelAvailabilityState([{
      ...entry("EXPECTED_SALES", "READY"),
      contractStatus: "MISMATCH",
    }])).toMatchObject({ status: "unavailable" });
    expect(affiliateExpectedSalesModelAvailabilityState([])).toMatchObject({
      status: "unavailable",
    });
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
      outperformanceProbability: 0.955,
      dataFoundationLevel: "MODERATE",
      expectedSalesLiftRatioPrimaryRangeLevel: 0.8,
      expectedSalesLiftRatioPrimaryRangeLowerBound: 1.067,
      expectedSalesLiftRatioPrimaryRangeUpperBound: 1.594,
      sameBudgetComparison: {
        historicalApprovalRate: 0.153,
        historicalActualObservedCount: 376,
        modelSelectedHistoricalRejectedCount: 490,
        modelRejectedHistoricalSelectedCount: 490,
        historicalActualUnitsHistogram: [{ key: "0", label: "0", count: 307 }],
        historicalExpectedUnitsHistogram: [{ key: "0", label: "0", count: 489 }],
        modelExpectedUnitsHistogram: [{ key: "0", label: "0", count: 492 }],
      },
      sameThresholdComparison: {
        minimumExpectedSalesUnits: 0.3,
        historicalQualifiedCount: 68,
        modelQualifiedCount: 558,
        modelQualifiedHistoricalRejectedCount: 490,
        belowThresholdCount: 3_089,
        qualifiedCreatorLiftRatio: 8.2059,
        historicalExpectedUnitsHistogram: [{ key: "0", label: "0", count: 66 }],
        modelExpectedUnitsHistogram: [{ key: "0", label: "0", count: 508 }],
        belowThresholdModelExpectedUnitsHistogram: [{ key: "0", label: "0", count: 3_089 }],
      },
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

    expect(affiliateSellerSafeMetrics(sellerSafeEvaluation as never)).toEqual({
      outperformanceProbability: 0.955,
      dataFoundationLevel: "MODERATE",
      primaryRangeLevel: 0.8,
      primaryRangeLowerBound: 1.067,
      primaryRangeUpperBound: 1.594,
    });
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
