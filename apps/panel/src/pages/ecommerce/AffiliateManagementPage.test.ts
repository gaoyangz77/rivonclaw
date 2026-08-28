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
  affiliateCommissionPercentRange,
  affiliateDelimitedIdentifiers,
  affiliateSellerSafeMetrics,
  emptyAffiliateProposalPageBuffer,
  formatExpectedSalesUnits,
  getProposalActionProductId,
  groupAgentWorkBundles,
  hydrateAffiliateProposalProjection,
  latestManualTagChange,
  latestSystemTagChange,
  mergeAffiliateProposalPage,
  proposalManualTagRows,
  predictionEvidenceHighlightTarget,
  predictionSignalFallbackLabel,
  resolvePredictionEvidenceState,
  proposalSampleDecisionOverrideTarget,
  proposalSampleReviewRows,
  relationshipTimelineLane,
  replaceAffiliateProposalPageBuffer,
  selectAffiliateProposalItems,
  sortAffiliateProposalsNewestFirst,
  sortAffiliateCreatorMessagesOldestFirst,
  proposalMessageWasDelivered,
  reconcileAgendaProcessingStatusWithPendingProposals,
  resolveProposalMessageDisplay,
  summarizeSampleProposalReviewRows,
} from "./AffiliateManagementPage.js";

describe("AffiliateManagementPage proposal source", () => {
  it("orders Creator communication from oldest to newest", () => {
    const message = (
      messageRef: string,
      createdAt: string,
    ): GQL.AffiliateCreatorMessageHistoryItem =>
      ({
        channel: GQL.AffiliateMessageChannel.PlatformChat,
        direction: GQL.AffiliateCreatorMessageDirection.Creator,
        messageRef,
        createdAt,
        parts: [],
      }) as unknown as GQL.AffiliateCreatorMessageHistoryItem;

    expect(
      sortAffiliateCreatorMessagesOldestFirst([
        message("newest", "2026-08-28T05:54:20.000Z"),
        message("oldest", "2026-08-27T10:38:29.000Z"),
        message("middle", "2026-08-28T01:30:02.000Z"),
      ]).map((item) => item.messageRef),
    ).toEqual(["oldest", "middle", "newest"]);
  });

  const proposal = (
    id: string,
    status: string,
    type = "SEND_MESSAGE",
    shopId = "shop-1",
  ): GQL.ActionProposal =>
    ({
      id,
      status,
      type,
      focusShopId: shopId,
      steps: [],
      creatorRelationship: null,
    }) as unknown as GQL.ActionProposal;

  it("appends cursor pages without duplicating proposals", () => {
    expect(
      mergeAffiliateProposalPage(
        [proposal("proposal-1", "PENDING"), proposal("proposal-2", "PENDING")],
        [proposal("proposal-2", "PENDING"), proposal("proposal-3", "PENDING")],
      ).map((item) => item.id),
    ).toEqual(["proposal-1", "proposal-2", "proposal-3"]);
  });

  it("places Creator and operator activity on opposite timeline lanes", () => {
    const timelineItem = (
      overrides: Partial<GQL.AffiliateRelationshipTimelineItem>,
    ): GQL.AffiliateRelationshipTimelineItem =>
      ({
        id: "timeline-1",
        kind: GQL.AffiliateRelationshipTimelineItemKind.BusinessEvent,
        occurredAt: "2026-08-27T00:00:00.000Z",
        relatedIds: {},
        summary: "",
        ...overrides,
      }) as GQL.AffiliateRelationshipTimelineItem;

    expect(
      relationshipTimelineLane(
        timelineItem({
          message: {
            channel: GQL.AffiliateMessageChannel.PlatformChat,
            direction: GQL.AffiliateCreatorMessageDirection.Creator,
          },
        }),
      ),
    ).toBe("creator");
    expect(
      relationshipTimelineLane(timelineItem({ actorRole: GQL.AffiliateLifecycleActorRole.Staff })),
    ).toBe("operator");
    expect(
      relationshipTimelineLane(timelineItem({ actorRole: GQL.AffiliateLifecycleActorRole.System })),
    ).toBe("system");
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

  it("routes a changed proposal to shop lists by its acted-on shop set, not the fabricated focus shop", () => {
    const multiShop = {
      ...proposal("proposal-multi", "PENDING"),
      shopIds: ["shop-1", "shop-2"],
    } as GQL.ActionProposal;
    expect(
      applyAffiliateProposalChange([], multiShop, { shopId: "shop-2" }).map((item) => item.id),
    ).toEqual(["proposal-multi"]);
    expect(applyAffiliateProposalChange([], multiShop, { shopId: "shop-3" })).toEqual([]);

    // The fabricated focus shop no longer routes: a proposal whose honest set
    // excludes the filter shop stays out even when focusShopId names it.
    const fabricated = {
      ...proposal("proposal-fabricated", "PENDING", "SEND_MESSAGE", "shop-9"),
      shopIds: ["shop-1"],
    } as GQL.ActionProposal;
    expect(applyAffiliateProposalChange([], fabricated, { shopId: "shop-9" })).toEqual([]);

    // A shopless direct proposal reaches a shop list only through its
    // relationship coverage; relationship-level views own it otherwise.
    const direct = {
      ...proposal("proposal-direct", "PENDING"),
      shopIds: [],
      creatorRelationship: { shopStates: [{ shopId: "shop-1" }] },
    } as unknown as GQL.ActionProposal;
    expect(
      applyAffiliateProposalChange([], direct, { shopId: "shop-1" }).map((item) => item.id),
    ).toEqual(["proposal-direct"]);
    expect(applyAffiliateProposalChange([], direct, { shopId: "shop-9" })).toEqual([]);
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

  it("routes realtime proposal changes by the frozen Business Developer snapshot", () => {
    const owned = {
      ...proposal("proposal-owned", "PENDING"),
      businessDeveloperIdSnapshot: "bd-1",
    } as unknown as GQL.ActionProposal;
    const other = {
      ...owned,
      id: "proposal-other",
      businessDeveloperIdSnapshot: "bd-2",
    } as unknown as GQL.ActionProposal;
    const reassigned = {
      ...other,
      id: owned.id,
    } as GQL.ActionProposal;

    expect(applyAffiliateProposalChange([], owned, { businessDeveloperId: "bd-1" })).toEqual([
      owned,
    ]);
    expect(applyAffiliateProposalChange([], other, { businessDeveloperId: "bd-1" })).toEqual([]);
    expect(
      applyAffiliateProposalChange([owned], reassigned, { businessDeveloperId: "bd-1" }),
    ).toEqual([]);
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

    expect(sortAffiliateProposalsNewestFirst([older, newer]).map((item) => item.id)).toEqual([
      "proposal-newer",
      "proposal-older",
    ]);
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

    expect(
      applyAffiliateProposalChange([], multiShopProposal, { shopId: "shop-2" as never }),
    ).toEqual([multiShopProposal]);
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
    const businessDeveloperKey = affiliateProposalPageQueryKey({
      userId: "user-1",
      businessDeveloperId: "bd-1",
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
    expect(pending.queryKey).not.toBe(businessDeveloperKey);
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
    expect(selectAffiliateProposalItems([], [{ id: "stale-pending-proposal" }])).toEqual([]);
  });

  it("uses stored proposals only before the query has returned data", () => {
    const stored = [{ id: "cached-proposal" }];

    expect(selectAffiliateProposalItems(undefined, stored)).toBe(stored);
  });

  it("prefers non-empty query results over stored proposals", () => {
    const queried = [{ id: "authoritative-proposal" }];

    expect(selectAffiliateProposalItems(queried, [{ id: "stale-proposal" }])).toBe(queried);
  });

  it("keeps fresh list metrics when the cached proposal projection lacks new fields", () => {
    const queried = {
      ...proposal("proposal-with-metrics", "PENDING"),
      creatorFollowerCount: 105_800,
      creatorAverageVideoViews: 835,
      creatorEngagementRate: 0.0166,
      creatorShoppableVideoCount: 34,
    } as GQL.ActionProposal;

    const hydrated = hydrateAffiliateProposalProjection(
      {
        proposal: proposal("proposal-with-metrics", "PENDING"),
      },
      queried,
    );

    expect(hydrated).toMatchObject({
      creatorFollowerCount: 105_800,
      creatorAverageVideoViews: 835,
      creatorEngagementRate: 0.0166,
      creatorShoppableVideoCount: 34,
    });
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
  ) =>
    ({
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
      expect(predictionEvidenceHighlightTarget({ evidenceMode: mode })).toBe(expected);
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
    expect(predictionSignalFallbackLabel({ status: "READY", error: null }, "不可用")).toBeNull();
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
    expect(predictionSignalFallbackLabel({ status: "ERROR", error: null }, "不可用")).toBe(
      "不可用 (ERROR)",
    );
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
    expect(rows.every((row) => !Object.prototype.hasOwnProperty.call(row, "operatorSummary"))).toBe(
      true,
    );
    expect(
      rows.map((row) => ({
        sampleId: row.sampleApplicationRecordId,
        decision: row.decision,
        productTitle: row.productTitle,
        expectedSalesUnits: (() => {
          const state = resolvePredictionEvidenceState(row.predictionSnapshot);
          return state?.kind === "EVIDENCE" ? state.evidence.expectedSales.value?.units : undefined;
        })(),
        rejectReason: row.rejectReason,
        rejectReasonExplanation: row.rejectReasonExplanation,
      })),
    ).toEqual([
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
      steps: [
        {
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
        },
      ],
    } as unknown as GQL.ActionProposal;

    expect(
      proposalSampleReviewRows(proposalWithoutMatchingPrediction)[0]?.predictionSnapshot,
    ).toBeNull();
  });

  it("offers rejection only as the opposite decision for one pure Sample action", () => {
    const singleApprove = {
      ...proposal("proposal-single-approve", "PENDING", "REVIEW_SAMPLE_APPLICATION"),
      sampleReviewIntent: {
        sampleApplicationRecordId: "sample-1",
        platformApplicationId: "platform-1",
        decision: "APPROVE",
      },
      steps: [
        {
          stepId: "step-1",
          type: "REVIEW_SAMPLE_APPLICATION",
          sampleReviewIntent: {
            sampleApplicationRecordId: "sample-1",
            platformApplicationId: "platform-1",
            decision: "APPROVE",
          },
        },
      ],
    } as unknown as GQL.ActionProposal;
    const singleReject = {
      ...singleApprove,
      id: "proposal-single-reject",
      sampleReviewIntent: {
        ...singleApprove.sampleReviewIntent!,
        decision: "REJECT",
      },
      steps: [
        {
          ...singleApprove.steps[0]!,
          sampleReviewIntent: {
            ...singleApprove.steps[0]!.sampleReviewIntent!,
            decision: "REJECT",
          },
        },
      ],
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
      steps: [
        {
          stepId: "step-1",
          type: "REVIEW_SAMPLE_APPLICATION",
          sampleReviewIntent: {
            sampleApplicationRecordId: "sample-1",
            platformApplicationId: "platform-1",
            decision: "APPROVE",
          },
        },
      ],
    } as unknown as GQL.ActionProposal;
    const multi = {
      ...single,
      steps: [single.steps[0], { ...single.steps[0], stepId: "step-2" }],
    } as GQL.ActionProposal;
    const mixed = {
      ...single,
      messageIntent: { parts: [{ kind: "TEXT", text: "hello" }] },
    } as unknown as GQL.ActionProposal;

    expect(proposalSampleDecisionOverrideTarget(multi)).toBeNull();
    expect(proposalSampleDecisionOverrideTarget(mixed)).toBeNull();
    expect(
      proposalSampleDecisionOverrideTarget(proposal("proposal-message", "PENDING", "SEND_MESSAGE")),
    ).toBeNull();
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
    expect(affiliateDelimitedIdentifiers("creator-1, creator-2\ncreator-1")).toEqual([
      "creator-1",
      "creator-2",
    ]);
  });

  it("shows both Target standard and Shop Ads commissions in list and detail reads", () => {
    expect(affiliateCommissionPercentRange(["12", "5", "12"])).toContain("5%");
    expect(affiliateCommissionPercentRange(["12", "5", "12"])).toContain("12%");
    expect(affiliateCommissionPercentRange([])).toBe("—");
    expect(affiliateCommissionPercentRange([""])).toBe("—");

    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const queries = readFileSync(resolve(process.cwd(), "src/api/shops-queries.ts"), "utf8");
    expect(page).toContain("targetAdsCommissionRates");
    expect(page).toContain("affiliate-platform-product-commission-snapshot");
    expect(queries).toContain("shopAdsCommissionRate");
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

  it("opens platform collaborations in one untabbed detail modal backed by the real detail query", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const queries = readFileSync(resolve(process.cwd(), "src/api/shops-queries.ts"), "utf8");
    const styles = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/components/AffiliateUi.css"),
      "utf8",
    );

    expect(page).toMatch(
      /useState<HistoryTypeFilter>\(\s*GQL\.AffiliateCollaborationType\.Open,?\s*\)/u,
    );
    expect(page).toContain("AffiliateCollaborationDetailModal");
    expect(page).toContain('className="affiliate-platform-collaboration-detail-modal"');
    expect(page).toContain("affiliate-platform-collaboration-workspace");
    expect(page).toContain("affiliate-platform-collaboration-primary-panel");
    expect(page).toContain("affiliate-platform-collaboration-context-panel");
    expect(page).toContain("affiliate-platform-collaboration-empty-row");
    expect(page).toContain("affiliate-platform-collaboration-edit-drawer");
    expect(page).not.toMatch(
      /affiliate-platform-collaboration-header-actions[\s\S]{0,700}className="modal-close"/u,
    );
    expect(page).not.toContain("affiliate-platform-collaboration-detail-sections");
    expect(page).not.toContain("affiliate-platform-collaboration-tabs");
    expect(page).not.toContain('className="affiliate-platform-collaboration-history"');
    expect(page).not.toContain("affiliate-platform-collaboration-detail-page");
    expect(page).not.toContain("collaborationOperations.detailsSummary");
    expect(page).toContain('allowDetailOpen={variant !== "listing"}');
    expect(styles).toMatch(
      /\.affiliate-platform-collaboration-detail-modal\s*\{[^}]*height:\s*auto;/su,
    );
    expect(styles).toContain("grid-template-columns: minmax(0, 1.55fr) minmax(290px, 0.85fr)");
    expect(queries).toContain("query AffiliateCollaborationDetail");
    expect(queries).toContain("shopActivitySummaries");
  });

  it("paginates Creators from hasMore without requesting an exact total", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );

    expect(page).toContain("hasMoreCreators");
    expect(page).not.toContain("stableCreatorTotalCount");
    expect(page).toContain("if (!creatorPageResult) return;");
  });

  it("shows natural AI Team ownership without offering an unassign action", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const queries = readFileSync(resolve(process.cwd(), "src/api/shops-queries.ts"), "utf8");

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
    expect(page).toContain("selectedBusinessDeveloperId");
    expect(page).toContain("businessDeveloperSearchPlaceholder");
    expect(page).toContain("searchable");
  });

  it("uses a dense Agent work table as the workspace entry point", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );

    expect(page).toContain("<AgentWorkBundleTable");
    expect(page).toContain('className="affiliate-agent-work-table"');
    expect(page).toContain("ecommerce.affiliateWorkspace.agentWorkTable.shop");
    expect(page).toContain("ecommerce.affiliateWorkspace.agentWorkTable.type");
    expect(page).toContain("ecommerce.affiliateWorkspace.agentWorkTable.work");
    expect(page).not.toContain("affiliate-proposal-timeline-entry");
    expect(page).not.toContain("affiliate-proposal-timeline-marker");

    const table = page.slice(
      page.indexOf("function AgentWorkBundleTable"),
      page.indexOf("function AgentWorkBundleDetailModal"),
    );
    expect(table).toContain("formatProposalTableTime(proposal.createdAt)");
    expect(table).toContain("formatProposalTableDate(proposal.createdAt)");
    expect(table).toContain("affiliate-agent-work-table-creator-button");
    expect(table).toContain("event.stopPropagation()");
    expect(table).toContain("proposal.creatorProfile.username");
    expect(table).toContain("affiliate-agent-work-table-creator-metrics");
    expect(table).toContain("proposal.creatorFollowerCount");
    expect(table).toContain("proposal.creatorAverageVideoViews");
    expect(table).toContain("proposal.creatorEngagementRate");
    expect(table).toContain("proposal.creatorShoppableVideoCount");
    expect(table).toContain("affiliate-agent-work-type-");
    expect(table).toContain("agentWorkTableActions(proposal, t)");
    expect(table).toContain("affiliate-agent-work-table-action-${action.tone}");
    expect(page).toContain("sampleRows.length === 0 && proposalHasMessageIntent(proposal)");
    expect(table).not.toContain("proposal.operatorSummary");
  });

  it("keeps decisions inside one shared detail modal and hides customer-facing versions", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );

    expect(page).toContain("<AgentWorkBundleDetailModal");
    expect(page).toContain("<AffiliateDetailModal");
    expect(page).toContain('className="affiliate-agent-work-detail-modal"');
    expect(page).toContain("allowDecisionActions={isPending}");
    expect(page).toContain("onApprove={isPending ? onApprove : undefined}");
    expect(page).toContain("showRevisionHistory={false}");
  });

  it("reuses the actionable pending proposal card inside Creator details", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const creatorModal = page.slice(
      page.indexOf("export function CreatorRelationshipDetailModal"),
      page.indexOf("function CreatorProfilePanel"),
    );

    expect(creatorModal).toContain("async function decideRelationshipProposal");
    expect(creatorModal).toContain("optimisticallyDecidedProposalIds");
    expect(creatorModal).toContain("<AgentWorkBundleCard");
    expect(creatorModal).toContain("allowDecisionActions");
    expect(creatorModal).toContain("onApprove={(item) =>");
    expect(creatorModal).toContain("onReject={(item) =>");
    expect(creatorModal).toContain("onRequestRevision={(item, revisionNote) =>");
    expect(creatorModal).toContain("decideRelationshipActionProposal");
    expect(page).toContain("onDecideProposal={decideProposal}");
  });

  it("opens Creator details from the work-detail avatar without a redundant workspace button", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const detailModal = page.slice(
      page.indexOf("function AgentWorkBundleDetailModal"),
      page.indexOf("function AgentWorkReviewContext"),
    );
    const card = page.slice(
      page.indexOf("function AgentWorkBundleCard"),
      page.indexOf("function AgentWorkRevisionHistory"),
    );

    expect(detailModal).toContain("onOpenCreator={onOpenCreator}");
    expect(detailModal).not.toContain("agentWorkDetail.openRelationship");
    expect(card).toContain("onOpen={openCreator}");
    expect(page).toContain('className="affiliate-creator-avatar-button"');
    const openCreatorDetailStart = page.indexOf("function openCreatorDetail");
    const openCreatorDetail = page.slice(
      openCreatorDetailStart,
      page.indexOf("if (authChecking)", openCreatorDetailStart),
    );
    expect(openCreatorDetail).toContain("setSelectedRelationship(detail)");
    expect(openCreatorDetail).not.toContain("setSelectedAgentWorkBundle(null)");
    expect(page).toContain("covered={Boolean(selectedRelationship)}");
    expect(detailModal).toContain("if (covered) return");
  });

  it("organizes Creator relationship context and keeps proposal history collapsed by default", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const styles = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/components/AffiliateUi.css"),
      "utf8",
    );
    const chinese = readFileSync(resolve(process.cwd(), "src/i18n/zh.ts"), "utf8");

    expect(page).toContain('"overview" | "contacts" | "management"');
    expect(page).toContain("const [proposalHistoryOpen, setProposalHistoryOpen] = useState(false)");
    expect(page).toContain("aria-expanded={proposalHistoryOpen}");
    expect(page).toContain("historicalProposals.length");
    expect(page).toContain('t("auth.email")');
    expect(page).not.toContain("<span>Email</span>");
    expect(styles).toContain(".affiliate-relationship-context-nav");
    expect(styles).toContain(".affiliate-relationship-proposal-history-toggle");
    expect(chinese).toContain('relationshipInformation: "达人关系信息"');
    expect(chinese).toContain('relationshipContacts: "达人联系方式"');
  });

  it("keeps relationship context pinned across Creator tabs and tolerates embedded collaboration data", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const styles = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/components/AffiliateUi.css"),
      "utf8",
    );
    const queries = readFileSync(resolve(process.cwd(), "src/api/shops-queries.ts"), "utf8");
    const creatorModal = page.slice(
      page.indexOf("export function CreatorRelationshipDetailModal"),
      page.indexOf("function CreatorProfilePanel"),
    );
    const collaborationCard = page.slice(
      page.indexOf("export function AffiliateCollaborationCard"),
      page.indexOf("type AffiliateCollaborationDetailQueryData"),
    );
    const relationshipCollaborationQuery = queries.slice(
      queries.indexOf("export const AFFILIATE_RELATIONSHIP_PLATFORM_COLLABORATIONS_QUERY"),
      queries.indexOf("export const AFFILIATE_PRODUCT_SUMMARIES_QUERY"),
    );

    expect(creatorModal).toContain("setActiveTab(tab.id);");
    expect(creatorModal).toContain('activeTab === "conversation" ? " affiliate-conversation-tab-panel"');
    expect(styles).toContain(
      ".affiliate-relationship-work-modal .affiliate-conversation-tab-panel",
    );
    expect(creatorModal).not.toContain('setContextInspectorOpen(tab.id === "overview")');
    expect(creatorModal).not.toMatch(
      /setActiveTab\("profile"\);\s*setContextInspectorOpen\(false\)/,
    );
    expect(creatorModal).toContain('window.matchMedia("(min-width: 1081px)").matches');
    expect(creatorModal).toContain("affiliate-relationship-inspector-mobile-toggle");
    expect(creatorModal).toContain("headerContent={");
    const inspectorOpening = creatorModal.slice(
      creatorModal.indexOf("<AffiliateContextInspector"),
      creatorModal.indexOf("headerContent={"),
    );
    expect(inspectorOpening).not.toContain("title=");
    expect(styles).toContain(".affiliate-relationship-inspector-mobile-toggle");
    expect(styles).toContain(".affiliate-context-inspector-header.is-navigation-only");
    expect(collaborationCard).toContain("const products = collaboration.products ?? []");
    expect(collaborationCard).toContain("const productIds = collaboration.productIds ?? []");
    expect(collaborationCard).not.toContain("collaboration.products.filter");
    expect(relationshipCollaborationQuery).toContain("products {");
    expect(relationshipCollaborationQuery).toContain("shopAdsCommissionRate");
  });

  it("localizes relationship agenda owners, actions, reasons, and source types", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const chinese = readFileSync(resolve(process.cwd(), "src/i18n/zh.ts"), "utf8");
    const creatorModal = page.slice(
      page.indexOf("export function CreatorRelationshipDetailModal"),
      page.indexOf("function CreatorProfilePanel"),
    );
    const agendaCard = page.slice(
      page.indexOf("function RelationshipAgendaCard"),
      page.indexOf("function SampleApplicationFact"),
    );
    const agendaSurface = `${creatorModal}\n${agendaCard}`;

    expect(agendaSurface).toContain('affiliateWorkspaceEnumLabel(t, "agendaOwners", agenda.owner)');
    expect(agendaSurface).toMatch(
      /affiliateWorkspaceEnumLabel\(\s*t,\s*"requiredActions",\s*agenda\.requiredAction/,
    );
    expect(agendaSurface).toMatch(
      /affiliateWorkspaceEnumLabel\(\s*t,\s*"agendaSourceTypes",\s*agenda\.sourceType/,
    );
    expect(agendaSurface).toContain('affiliateWorkspaceEnumLabel(t, "processReasons", reason)');
    expect(agendaSurface).not.toContain("formatAffiliateEnumLabel(agenda.owner)");
    expect(agendaSurface).not.toContain("formatAffiliateEnumLabel(agenda.sourceType)");
    expect(chinese).toContain('EXTERNAL: "外部"');
    expect(chinese).toContain('WAIT_PLATFORM_UPDATE: "等待平台更新"');
    expect(chinese).toContain('SAMPLE_APPLICATION: "样品申请"');
  });

  it("hydrates an incomplete current Sample work card only after disclosure", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const queries = readFileSync(resolve(process.cwd(), "src/api/shops-queries.ts"), "utf8");
    const styles = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/components/AffiliateUi.css"),
      "utf8",
    );
    const agendaCard = page.slice(
      page.indexOf("function RelationshipAgendaCard"),
      page.indexOf("function SampleApplicationFact"),
    );

    expect(agendaCard).toContain("useLazyQuery");
    expect(agendaCard).toContain("!detailsOpen");
    expect(agendaCard).toContain("hasSampleEntity");
    expect(agendaCard).toContain("sampleState.called");
    expect(agendaCard).toContain("AFFILIATE_SAMPLE_APPLICATION_STATE_QUERY");
    expect(agendaCard).toContain("<SampleApplicationSummaryCard");
    expect(agendaCard).toContain("allowProductLoad");
    expect(queries).toContain("query AffiliateSampleApplicationState");
    expect(styles).toContain(
      ".affiliate-relationship-work-modal .affiliate-relationship-work-side-facts",
    );
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
  });

  it("uses dense shared entity layouts across Creator detail tabs", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const styles = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/components/AffiliateUi.css"),
      "utf8",
    );
    const chinese = readFileSync(resolve(process.cwd(), "src/i18n/zh.ts"), "utf8");

    expect(page).toContain("affiliate-relationship-sample-list");
    expect(page).toContain("affiliate-relationship-platform-list");
    expect(page).toContain('variant="listing"');
    expect(page).toContain("affiliate-creator-profile-dashboard");
    expect(page).toContain("affiliate-timeline-row-${entry.lane}");
    expect(styles).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(styles).toContain("affiliate-timeline-row-creator");
    expect(styles).toContain("affiliate-timeline-row-operator");
    expect(chinese).toContain('RELATIONSHIP_BD_ASSIGNED: "分配达人关系负责人"');
    expect(chinese).toContain(
      'SAMPLE_APPLICATION_TERMINAL_STATE_FIRST_OBSERVED: "首次发现样品申请已结束"',
    );
  });

  it("removes a decided row before the mutation resolves and restores it on failure", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const decideProposal = page.slice(
      page.indexOf("async function decideProposal"),
      page.indexOf("async function refetchActive"),
    );
    const mutationIndex = decideProposal.indexOf("await decideActionProposal");

    expect(decideProposal.indexOf("const optimisticProposal")).toBeLessThan(mutationIndex);
    expect(decideProposal.indexOf("setProposalPageBuffer")).toBeLessThan(mutationIndex);
    expect(decideProposal).toContain("optimisticApplied = true");
    expect(decideProposal).toContain(
      "items: applyAffiliateProposalChange(current.items, proposal, decisionFilters)",
    );
    expect(decideProposal).toContain("return false");
  });

  it("anchors review context to the Agent run and shows prior relationship work", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const detailModal = page.slice(
      page.indexOf("function AgentWorkBundleDetailModal"),
      page.indexOf("function AgentWorkBundleCard"),
    );

    expect(detailModal).toContain("proposal.sourceWorkBoundary?.versionAt ?? proposal.createdAt");
    expect(detailModal).toContain("AFFILIATE_CREATOR_RELATIONSHIP_DETAIL_QUERY");
    expect(detailModal).toContain("AFFILIATE_RELATIONSHIP_TIMELINE_QUERY");
    expect(detailModal).toContain("AFFILIATE_ACTION_PROPOSALS_QUERY");
    expect(detailModal).toContain("endAt: contextEndAt");
    expect(detailModal).toContain("item.relatedIds.actionProposalId !== proposal.id");
    expect(detailModal).toContain("previousAgentWork");
    expect(detailModal).toContain("<AgentWorkReviewContext");
    expect(detailModal.indexOf("<AgentWorkReviewContext")).toBeLessThan(
      detailModal.indexOf('className="affiliate-agent-work-detail-main"'),
    );
    expect(detailModal).toContain(
      "ecommerce.affiliateWorkspace.triggerKinds.${source.triggerKind}",
    );
    expect(detailModal.indexOf("agentWorkDetail.recentContext")).toBeLessThan(
      detailModal.indexOf("agentWorkDetail.previousAgentWork"),
    );
  });

  it("shows message copy alongside Sample decisions for mixed work", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );
    const card = page.slice(
      page.indexOf("function AgentWorkBundleCard"),
      page.indexOf("function AgentWorkRevisionHistory"),
    );

    expect(card).toContain("sampleReviewRows.length > 0 && proposalHasMessageIntent(proposal)");
    expect(card).toContain("agentWorkDetail.bundledMessage");
    expect(card).toContain("messagePreview");
    expect(card).toContain("messageContentCleared");
  });

  it("lets staff decide a policy-gated no-action proposal", () => {
    const page = readFileSync(
      resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
      "utf8",
    );

    // A NO_ACTION_NEEDED proposal can now be held PENDING by approval policy, so
    // the review card must not exclude it from the decision actions.
    expect(page).not.toContain("proposal.type !== GQL.ActionProposalType.NoActionNeeded");
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
      affiliateModelStagePresentation(availability, "EXPECTED_SALES", "UNIFIED").statusKey,
    ).toBe("bestAvailableCurrentReview");
  });

  it("treats same-user scope fallback as the current unified artifact", () => {
    const availability = [entry("EXPECTED_SALES", "FALLBACK")];

    expect(
      affiliateModelStagePresentation(availability, "EXPECTED_SALES", "UNIFIED").statusKey,
    ).toBe("bestAvailableCurrentReview");
  });

  it("shows data accumulation when the unified family is unavailable", () => {
    const availability = [entry("EXPECTED_SALES", "UNAVAILABLE")];

    expect(
      affiliateModelStagePresentation(availability, "EXPECTED_SALES", "UNIFIED").statusKey,
    ).toBe("modelDataAccumulating");
  });

  it("derives exact, fallback, and unavailable states from live availability", () => {
    expect(
      affiliateExpectedSalesModelAvailabilityState([entry("EXPECTED_SALES", "READY")]),
    ).toMatchObject({ status: "ready", effectiveTenantScope: "SHOP" });
    expect(
      affiliateExpectedSalesModelAvailabilityState([entry("EXPECTED_SALES", "FALLBACK")]),
    ).toMatchObject({ status: "fallback", effectiveTenantScope: "REGION" });
    expect(
      affiliateExpectedSalesModelAvailabilityState([entry("EXPECTED_SALES", "UNAVAILABLE")]),
    ).toMatchObject({ status: "unavailable" });
    expect(
      affiliateExpectedSalesModelAvailabilityState([
        {
          ...entry("EXPECTED_SALES", "READY"),
          contractStatus: "MISMATCH",
        },
      ]),
    ).toMatchObject({ status: "unavailable" });
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
    const availability = [entry("EXPECTED_SALES", "READY", sellerSafeEvaluation)];

    expect(
      affiliateModelStagePresentation(availability, "EXPECTED_SALES", "UNIFIED").evaluationSummary,
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
    const availability = [
      {
        ...entry("EXPECTED_SALES", "READY", { comparisonAvailable: true }),
        contractStatus: "MISMATCH",
      },
    ];

    const presentation = affiliateModelStagePresentation(availability, "EXPECTED_SALES", "UNIFIED");

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
      affiliateModelStagePresentation(availability, "EXPECTED_SALES", "UNIFIED").evaluationSummary,
    ).toBe(expectedEvaluation);
    expect(
      affiliateModelStagePresentation(availability, "HUMAN_DECISION", "UNIFIED").evaluationSummary,
    ).toBeNull();
  });

  it("retains requested/effective scope fallback independently of evaluation", () => {
    const availability = [entry("HUMAN_DECISION", "FALLBACK")];
    const presentation = affiliateModelStagePresentation(availability, "HUMAN_DECISION", "UNIFIED");

    expect(presentation.entry).toMatchObject({
      requestedTenantScope: "SHOP",
      requestedTenantId: "shop-1",
      effectiveTenantScope: "REGION",
      effectiveTenantId: "user-1::region::US",
    });
  });
});

describe("SEND_MESSAGE proposal message box", () => {
  const sendMessageProposal = (
    status: GQL.ActionProposalStatus,
    overrides: Partial<GQL.ActionProposal> = {},
  ): GQL.ActionProposal =>
    ({
      id: "proposal-message",
      status,
      type: GQL.ActionProposalType.SendMessage,
      focusShopId: "shop-1",
      steps: [],
      creatorRelationship: null,
      messageIntent: {
        creatorId: "creator-1",
        preferredChannel: GQL.AffiliateMessageChannel.PlatformChat,
        parts: [
          {
            kind: GQL.AffiliateMessagePartKind.Text,
            textHash: "hash",
            textLength: 501,
          },
        ],
      },
      ...overrides,
    }) as unknown as GQL.ActionProposal;

  it("shows the review draft while the proposal is still open", () => {
    const proposal = sendMessageProposal(GQL.ActionProposalStatus.Pending, {
      messageIntent: {
        creatorId: "creator-1",
        parts: [
          {
            kind: GQL.AffiliateMessagePartKind.Text,
            text: "  Hi there, are you interested?  ",
            textLength: 32,
          },
        ],
      },
    } as unknown as Partial<GQL.ActionProposal>);

    expect(resolveProposalMessageDisplay(proposal)).toEqual({
      text: "Hi there, are you interested?",
      contentCleared: false,
    });
  });

  it("reads a message step from a mixed Sample review proposal", () => {
    const proposal = sendMessageProposal(GQL.ActionProposalStatus.Pending, {
      type: GQL.ActionProposalType.ReviewSampleApplication,
      messageIntent: null,
      steps: [
        {
          stepId: "review-sample",
          type: GQL.ActionProposalType.ReviewSampleApplication,
          sampleReviewIntent: {
            sampleApplicationRecordId: "sample-1",
            platformApplicationId: "application-1",
            decision: GQL.AffiliateSampleReviewDecision.Approve,
          },
        },
        {
          stepId: "reply-to-creator",
          type: GQL.ActionProposalType.SendMessage,
          messageIntent: {
            creatorId: "creator-1",
            parts: [{ kind: GQL.AffiliateMessagePartKind.Text, text: "Your sample was approved." }],
          },
        },
      ],
    } as unknown as Partial<GQL.ActionProposal>);

    expect(resolveProposalMessageDisplay(proposal)).toEqual({
      text: "Your sample was approved.",
      contentCleared: false,
    });
  });

  it("falls back to the delivered message once the draft has been scrubbed", () => {
    const proposal = sendMessageProposal(GQL.ActionProposalStatus.Executed, {
      deliveredMessage: {
        deliveryId: "delivery-1",
        status: GQL.AffiliateDeliveryStatus.Sent,
        channel: GQL.AffiliateMessageChannel.PlatformChat,
        parts: [
          { sequence: 2, kind: GQL.AffiliateMessagePartKind.Text, text: "Second line" },
          { sequence: 1, kind: GQL.AffiliateMessagePartKind.Text, text: "First line" },
        ],
      },
    } as unknown as Partial<GQL.ActionProposal>);

    expect(resolveProposalMessageDisplay(proposal)).toEqual({
      text: "First line\nSecond line",
      contentCleared: false,
    });
  });

  it("reports cleared content for a closed proposal that kept neither draft nor delivery", () => {
    for (const status of [
      GQL.ActionProposalStatus.Expired,
      GQL.ActionProposalStatus.Superseded,
      GQL.ActionProposalStatus.Rejected,
      GQL.ActionProposalStatus.Executed,
      GQL.ActionProposalStatus.ExecutionFailed,
    ]) {
      expect(resolveProposalMessageDisplay(sendMessageProposal(status)), status).toEqual({
        text: null,
        contentCleared: true,
      });
    }
  });

  it("treats only provider-accepted delivery statuses as sent", () => {
    for (const status of [
      GQL.AffiliateDeliveryStatus.Sent,
      GQL.AffiliateDeliveryStatus.PartiallySent,
      GQL.AffiliateDeliveryStatus.Submitted,
    ]) {
      expect(
        proposalMessageWasDelivered(
          sendMessageProposal(GQL.ActionProposalStatus.Executed, {
            executionResult: { deliveryId: "delivery-1", deliveryStatus: status },
          } as unknown as Partial<GQL.ActionProposal>),
        ),
        status,
      ).toBe(true);
    }
  });

  it("never claims a failed, cancelled or queued delivery reached the creator", () => {
    for (const status of [
      GQL.AffiliateDeliveryStatus.Failed,
      GQL.AffiliateDeliveryStatus.Cancelled,
      GQL.AffiliateDeliveryStatus.Queued,
    ]) {
      expect(
        proposalMessageWasDelivered(
          sendMessageProposal(GQL.ActionProposalStatus.ExecutionFailed, {
            executionResult: { deliveryId: "delivery-1", deliveryStatus: status },
          } as unknown as Partial<GQL.ActionProposal>),
        ),
        status,
      ).toBe(false);
    }
  });

  it("prefers the delivery's own status over the execution snapshot", () => {
    const proposal = sendMessageProposal(GQL.ActionProposalStatus.ExecutionFailed, {
      executionResult: {
        deliveryId: "delivery-1",
        deliveryStatus: GQL.AffiliateDeliveryStatus.Failed,
      },
      deliveredMessage: {
        deliveryId: "delivery-1",
        status: GQL.AffiliateDeliveryStatus.Failed,
        parts: [{ sequence: 1, kind: GQL.AffiliateMessagePartKind.Text, text: "Attempted body" }],
      },
    } as unknown as Partial<GQL.ActionProposal>);

    expect(proposalMessageWasDelivered(proposal)).toBe(false);
    expect(resolveProposalMessageDisplay(proposal)).toEqual({
      text: "Attempted body",
      contentCleared: false,
    });
  });

  it("does not treat a proposal without any delivery as sent", () => {
    expect(proposalMessageWasDelivered(sendMessageProposal(GQL.ActionProposalStatus.Expired))).toBe(
      false,
    );
  });

  it("keeps an open proposal without draft text out of the cleared-content note", () => {
    expect(
      resolveProposalMessageDisplay(sendMessageProposal(GQL.ActionProposalStatus.Pending)),
    ).toEqual({
      text: null,
      contentCleared: false,
    });
  });

  it("leaves proposals that never carried a message untouched", () => {
    const proposal = {
      id: "proposal-no-message",
      status: GQL.ActionProposalStatus.Executed,
      type: GQL.ActionProposalType.NoActionNeeded,
      steps: [],
    } as unknown as GQL.ActionProposal;

    expect(resolveProposalMessageDisplay(proposal)).toEqual({
      text: null,
      contentCleared: false,
    });
  });
});

describe("relationship processing status with pending proposals", () => {
  // The agenda cannot see PENDING proposals, so its AGENT-owned item keeps
  // deriving AgentRequired after the Agent has produced its proposal; the
  // detail card reconciles that into StaffRequired, mirroring the backend.
  it("flips AgentRequired to StaffRequired while proposals are pending", () => {
    expect(
      reconcileAgendaProcessingStatusWithPendingProposals(
        GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
        true,
      ),
    ).toBe(GQL.AffiliateRelationshipProcessingStatus.StaffRequired);
  });

  it("keeps AgentRequired without pending proposals", () => {
    expect(
      reconcileAgendaProcessingStatusWithPendingProposals(
        GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
        false,
      ),
    ).toBe(GQL.AffiliateRelationshipProcessingStatus.AgentRequired);
  });

  it("never masks non-agent statuses into staff work", () => {
    for (const status of [
      GQL.AffiliateRelationshipProcessingStatus.StaffRequired,
      GQL.AffiliateRelationshipProcessingStatus.ExternalWaiting,
      GQL.AffiliateRelationshipProcessingStatus.Idle,
    ]) {
      expect(reconcileAgendaProcessingStatusWithPendingProposals(status, true)).toBe(status);
    }
  });
});

describe("manual tag proposal rows", () => {
  const tagIntentProposal = (
    steps: Array<{ stepId: string; operation: GQL.CreatorTagOperation; manualTagId: string }>,
    referencedManualTags: Array<{ id: string; name: string }>,
  ) =>
    ({
      id: "proposal-tag-1",
      type: GQL.ActionProposalType.ManageCreatorTag,
      status: GQL.ActionProposalStatus.Pending,
      referencedManualTags,
      steps: steps.map((step) => ({
        stepId: step.stepId,
        type: GQL.ActionProposalType.ManageCreatorTag,
        creatorTagIntent: {
          operation: step.operation,
          manualTagId: step.manualTagId,
          contextShopId: "shop-1",
        },
      })),
    }) as unknown as GQL.ActionProposal;

  it("names an ADD target the relationship does not carry yet", () => {
    // referencedManualTags is the only source that can name it: joining against
    // the relationship's own tags would come back empty for every ADD.
    const rows = proposalManualTagRows(
      tagIntentProposal(
        [{ stepId: "step-1", operation: GQL.CreatorTagOperation.Add, manualTagId: "tag-1" }],
        [{ id: "tag-1", name: "VIP" }],
      ),
    );
    expect(rows).toEqual([
      {
        key: "step-1",
        operation: GQL.CreatorTagOperation.Add,
        manualTagId: "tag-1",
        systemTag: null,
        tagName: "VIP",
        contextShopId: "shop-1",
      },
    ]);
  });

  it("shows a renamed tag under its current catalog name", () => {
    const rows = proposalManualTagRows(
      tagIntentProposal(
        [{ stepId: "step-1", operation: GQL.CreatorTagOperation.Remove, manualTagId: "tag-9" }],
        [{ id: "tag-9", name: "Renamed later" }],
      ),
    );
    expect(rows[0]?.tagName).toBe("Renamed later");
    expect(rows[0]?.operation).toBe(GQL.CreatorTagOperation.Remove);
  });

  it("reports a deleted catalog row as an unnamed tag rather than guessing", () => {
    const rows = proposalManualTagRows(
      tagIntentProposal(
        [{ stepId: "step-1", operation: GQL.CreatorTagOperation.Add, manualTagId: "tag-gone" }],
        [],
      ),
    );
    expect(rows[0]?.tagName).toBeNull();
  });

  it("falls back to the proposal-level intent for a stepless proposal", () => {
    const proposal = {
      id: "proposal-legacy",
      type: GQL.ActionProposalType.ManageCreatorTag,
      status: GQL.ActionProposalStatus.Pending,
      steps: [],
      referencedManualTags: [{ id: "tag-2", name: "误打扰" }],
      creatorTagIntent: {
        operation: GQL.CreatorTagOperation.Remove,
        manualTagId: "tag-2",
        contextShopId: null,
      },
    } as unknown as GQL.ActionProposal;
    const rows = proposalManualTagRows(proposal);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toBe("proposal-legacy");
    expect(rows[0]?.tagName).toBe("误打扰");
    expect(rows[0]?.contextShopId).toBeNull();
  });

  it("returns no rows for a proposal that changes no tag", () => {
    const proposal = {
      id: "proposal-message",
      type: GQL.ActionProposalType.SendMessage,
      status: GQL.ActionProposalStatus.Pending,
      steps: [{ stepId: "step-1", type: GQL.ActionProposalType.SendMessage }],
      referencedManualTags: [],
    } as unknown as GQL.ActionProposal;
    expect(proposalManualTagRows(proposal)).toEqual([]);
  });

  it("renders a system tag from its enum without a manual-tag projection", () => {
    const proposal = {
      id: "proposal-system-tag",
      type: GQL.ActionProposalType.ManageCreatorTag,
      status: GQL.ActionProposalStatus.Pending,
      referencedManualTags: [],
      steps: [
        {
          stepId: "step-system-tag",
          type: GQL.ActionProposalType.ManageCreatorTag,
          creatorTagIntent: {
            operation: GQL.CreatorTagOperation.Add,
            systemTag: GQL.AffiliateCreatorSystemTag.NoCampaignDisturb,
          },
        },
      ],
    } as unknown as GQL.ActionProposal;

    expect(proposalManualTagRows(proposal)).toEqual([
      {
        key: "step-system-tag",
        operation: GQL.CreatorTagOperation.Add,
        manualTagId: null,
        systemTag: GQL.AffiliateCreatorSystemTag.NoCampaignDisturb,
        tagName: null,
        contextShopId: null,
      },
    ]);
  });
});

describe("manual tag change source", () => {
  const timelineItem = (
    id: string,
    occurredAt: string,
    eventType: GQL.AffiliateLifecycleEventType,
    actorType: GQL.AffiliateLifecycleActorType,
  ) =>
    ({
      id,
      occurredAt,
      actorType,
      summary: `${eventType} ${id}`,
      businessEvent: { eventType },
    }) as unknown as GQL.AffiliateRelationshipTimelineItem;

  it("reads the newest tag event and keeps HUMAN and AGENT distinct", () => {
    const change = latestManualTagChange([
      timelineItem(
        "a",
        "2026-08-01T00:00:00.000Z",
        GQL.AffiliateLifecycleEventType.TagAdded,
        GQL.AffiliateLifecycleActorType.Human,
      ),
      timelineItem(
        "b",
        "2026-08-03T00:00:00.000Z",
        GQL.AffiliateLifecycleEventType.TagRemoved,
        GQL.AffiliateLifecycleActorType.Agent,
      ),
      timelineItem(
        "c",
        "2026-08-02T00:00:00.000Z",
        GQL.AffiliateLifecycleEventType.TagAdded,
        GQL.AffiliateLifecycleActorType.Human,
      ),
    ]);
    expect(change?.occurredAt).toBe("2026-08-03T00:00:00.000Z");
    expect(change?.added).toBe(false);
    expect(change?.actorType).toBe(GQL.AffiliateLifecycleActorType.Agent);
  });

  it("ignores timeline items that are not tag changes", () => {
    const change = latestManualTagChange([
      timelineItem(
        "a",
        "2026-08-05T00:00:00.000Z",
        GQL.AffiliateLifecycleEventType.MessageReceived,
        GQL.AffiliateLifecycleActorType.System,
      ),
    ]);
    expect(change).toBeNull();
  });

  it("tracks system-tag changes separately from manual-tag changes", () => {
    const items = [
      timelineItem(
        "manual",
        "2026-08-05T00:00:00.000Z",
        GQL.AffiliateLifecycleEventType.TagAdded,
        GQL.AffiliateLifecycleActorType.Human,
      ),
      timelineItem(
        "system",
        "2026-08-04T00:00:00.000Z",
        GQL.AffiliateLifecycleEventType.CreatorSystemTagAdded,
        GQL.AffiliateLifecycleActorType.Agent,
      ),
    ];

    expect(latestSystemTagChange(items)).toMatchObject({
      occurredAt: "2026-08-04T00:00:00.000Z",
      added: true,
      actorType: GQL.AffiliateLifecycleActorType.Agent,
    });
    expect(latestManualTagChange(items)?.occurredAt).toBe("2026-08-05T00:00:00.000Z");
  });
});

describe("creator tag catalog wiring", () => {
  const page = readFileSync(
    resolve(process.cwd(), "src/pages/ecommerce/AffiliateManagementPage.tsx"),
    "utf8",
  );

  it("reads the tag catalog from creatorManualTags, not the policy context", () => {
    // Regression: the catalog used to be typed as `{ creatorTags: CreatorTag[] }`
    // on AFFILIATE_POLICY_CONTEXT_QUERY, which returns no such top-level field,
    // so the dropdown was permanently empty.
    expect(page).toContain("CREATOR_MANUAL_TAGS_QUERY");
    expect(page).not.toContain("policyContextData");
    expect(page).not.toContain("GQL.CreatorTag[]");
    expect(page).not.toContain("?.creatorTags");
  });

  it("drops the variables and shop guard the catalog query never needed", () => {
    expect(page).not.toContain("campaignsInput: { shopId: selectedShopId, limit: 1 }");
    expect(page).not.toContain("ALL_CREATOR_TAGS_FILTER");
  });

  it("sends every Relationship-level filter dimension the backend accepts", () => {
    expect(page).toContain("manualTagIds: selectedManualTagIds.length");
    expect(page).toContain("manualTagMatchMode: selectedManualTagIds.length");
    expect(page).toMatch(/systemTags:\s*selectedSystemTags\.length/u);
    expect(page).toMatch(/systemTagMatchMode:\s*selectedSystemTags\.length/u);
    expect(page).toContain("sampleTiers: selectedSampleTiers.length");
    expect(page).toMatch(
      /shopSampleTiers:\s*selectedShopId\s*&&\s*selectedShopSampleTiers\.length/u,
    );
  });

  it("shows collaboration progress and both tag groups on compact creator cards and detail headers", () => {
    const creatorCard = page.slice(
      page.indexOf("function CreatorRelationshipCompactCard"),
      page.indexOf("function CreatorRelationshipWorkCard"),
    );
    const creatorDetail = page.slice(
      page.indexOf("export function CreatorRelationshipDetailModal"),
      page.indexOf("function CreatorProfilePanel"),
    );
    const chinese = readFileSync(resolve(process.cwd(), "src/i18n/zh.ts"), "utf8");
    const english = readFileSync(resolve(process.cwd(), "src/i18n/en.ts"), "utf8");

    expect(page).toContain('className="affiliate-creator-compact-list"');
    expect(page).not.toContain('className="affiliate-creator-table"');
    expect(creatorCard).toContain("affiliate-creator-compact-card");
    expect(creatorCard).toContain("affiliate-creator-compact-metrics");
    expect(creatorCard).toContain("affiliate-creator-compact-relationship");
    expect(creatorCard).toContain("affiliate-creator-compact-status");
    expect(creatorCard).not.toContain("affiliate-creator-compact-next");
    expect(creatorCard).not.toContain("affiliateWorkspace.labels.nextStep");
    expect(creatorCard).not.toContain("affiliate-creator-card-stat-strip");
    expect(creatorCard).toContain("highestCreatorSampleTier");
    expect(creatorCard).toContain("creatorSampleTierLabel(t, sampleTier)");
    expect(creatorCard).toContain("creatorSystemTagLabel(t, tag)");
    expect(creatorCard).toContain("visibleManualTags.map");
    expect(creatorCard).toContain("<CreatorPlatformHandle handle={handle} />");
    expect(creatorCard).not.toContain("<CreatorPlatformId");
    expect(creatorCard).not.toContain("creatorPlatformIdentity(profile)");
    expect(creatorDetail).toContain("affiliate-relationship-header-progress");
    expect(creatorDetail).toContain("affiliate-relationship-detail-title-row");
    expect(creatorDetail).toContain("creatorSampleTierDisplay(t, cooperationProgressTier)");
    expect(creatorDetail.indexOf("affiliate-relationship-header-progress")).toBeLessThan(
      creatorDetail.indexOf("affiliate-relationship-work-modal-meta"),
    );
    expect(chinese).toContain('sampleTierColumnLabel: "合作进度"');
    expect(chinese).toContain('sampleTierFilterLabel: "合作进度"');
    expect(english).toContain('sampleTierColumnLabel: "Collaboration progress"');
  });

  it("keeps the per-shop tier read-only in the relationship detail", () => {
    // Tiers are backend-derived; the detail must offer no add/remove affordance.
    expect(page).toContain("affiliate-relationship-shop-tier");
    expect(page).not.toContain("onUpdateTier");
    expect(page).not.toContain("setSampleTier");
  });
});
