import { beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";

vi.mock("@rivonclaw/logger", () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mockRpcRequest = vi.fn();
const mockGetAuthSession = vi.fn();
vi.mock("../openclaw/index.js", () => ({
  openClawConnector: {
    request: (...args: unknown[]) => mockRpcRequest(...args),
  },
}));

vi.mock("../auth/session-ref.js", () => ({
  getAuthSession: () => mockGetAuthSession(),
}));

vi.mock("../gateway/provider-keys-ref.js", () => ({
  getProviderKeysStore: () => ({ getAll: () => [] }),
}));

vi.mock("../gateway/vendor-dir-ref.js", () => ({
  getVendorDir: () => "/fake/vendor",
}));

vi.mock("@rivonclaw/gateway", () => ({
  readFullModelCatalog: vi.fn().mockResolvedValue({}),
}));

import { AffiliateSession, AffiliateTriggerKind } from "./affiliate-session.js";
import { buildAffiliateAgentRunRequest } from "./affiliate-agent-run-factory.js";
import { initLLMProviderManagerEnv, rootStore } from "../app/store/desktop-store.js";

function createSampleReviewWorkItem(overrides: Partial<GQL.AffiliateWorkItem> = {}): GQL.AffiliateWorkItem {
  const collaboration = {
    id: "collab-001",
    userId: "user-001",
    shopId: "shop-001",
    creatorId: "creator-001",
    creatorImId: "creator-im-001",
    productId: "product-001",
    sampleApplicationRecordId: "sample-record-001",
    platformConversationId: "conversation-001",
    lifecycleStage: "SAMPLE_PENDING",
    processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.AgentNeeded,
    requiredAction: GQL.AffiliateCollaborationRequiredAction.ReviewSampleApplication,
    processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview],
    lastCreatorMessageId: null,
    lastCreatorMessageAt: null,
    lastSignalAt: null,
    workHandledUntil: null,
    nextSellerActionAt: null,
    startedAt: "2026-05-11T00:00:00.000Z",
    endedAt: null,
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:01:00.000Z",
    stateUpdatedAt: "2026-05-11T00:01:00.000Z",
    affiliateCollaborationId: null,
    collaborationType: null,
    platformCollaborationId: null,
    predictionSnapshots: [],
  } as unknown as GQL.AffiliateCollaborationRecord;

  const sampleApplicationRecord: GQL.SampleApplicationRecord = {
    id: "sample-record-001",
    userId: "user-001",
    shopId: "shop-001",
    platformApplicationId: "platform-sample-001",
    creatorId: "creator-001",
    productId: "product-001",
    sampleWorkStatus: GQL.SampleWorkStatus.RequestPendingReview,
    observedContentCount: 0,
    latestObservedContentAt: null,
    latestObservedContentId: null,
    latestObservedContentUrl: null,
    latestObservedContentFormat: null,
    latestObservedContentPaidOrderCount: null,
    latestObservedContentViewCount: null,
    carrier: null,
    trackingNumber: null,
    shippedAt: null,
    deliveredAt: null,
    updatedAt: "2026-05-11T00:01:00.000Z",
  };

  return {
    id: "collab-001",
    shopId: "shop-001",
    platformShopId: "platform-shop-001",
    collaborationRecordId: "collab-001",
    workKind: GQL.AffiliateWorkKind.SampleReviewNeeded,
    workBundleKind: GQL.AffiliateWorkBundleKind.SampleReviewOnly,
    agentDispatchRecommended: true,
    staffReviewRequired: false,
    processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.AgentNeeded,
    requiredAction: GQL.AffiliateCollaborationRequiredAction.ReviewSampleApplication,
    processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview],
    recommendedActionTypes: [
      GQL.ActionProposalType.ReviewSampleApplication,
    ],
    versionAt: "2026-05-11T00:01:00.000Z",
    collaboration,
    sampleApplicationRecord,
    latestPendingProposal: null,
    context: {
      affiliateCollaboration: null,
      creatorProfile: null,
      creatorRelation: null,
      missingContext: [],
      pendingProposals: [],
      primarySampleApplication: sampleApplicationRecord,
      productContext: null,
      recommendedActionTypes: [
        GQL.ActionProposalType.ReviewSampleApplication,
      ],
      relatedSampleApplications: [sampleApplicationRecord],
    },
    ...overrides,
  };
}

function createCreatorReplyWorkItem(overrides: Partial<GQL.AffiliateWorkItem> = {}): GQL.AffiliateWorkItem {
  const base = createSampleReviewWorkItem();
  const collaboration: GQL.AffiliateCollaborationRecord = {
    ...base.collaboration,
    sampleApplicationRecordId: null,
    platformConversationId: "conversation-001",
    lifecycleStage: "CONVERSATION",
    processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.AgentNeeded,
    requiredAction: GQL.AffiliateCollaborationRequiredAction.RespondToCreator,
    processReasons: [GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply],
    lastCreatorMessageId: null,
    lastCreatorMessageAt: null,
  } as unknown as GQL.AffiliateCollaborationRecord;

  return {
    ...base,
    workKind: GQL.AffiliateWorkKind.CreatorReplyNeeded,
    workBundleKind: GQL.AffiliateWorkBundleKind.CreatorReplyOnly,
    processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.AgentNeeded,
    requiredAction: GQL.AffiliateCollaborationRequiredAction.RespondToCreator,
    processReasons: [GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply],
    recommendedActionTypes: [
      GQL.ActionProposalType.SendMessage,
    ],
    collaboration,
    sampleApplicationRecord: null,
    context: {
      ...base.context,
      primarySampleApplication: null,
      relatedSampleApplications: [],
      recommendedActionTypes: [
        GQL.ActionProposalType.SendMessage,
      ],
    },
    ...overrides,
  } as GQL.AffiliateWorkItem;
}

describe("affiliate work item dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthSession.mockReturnValue(null);
    mockRpcRequest.mockResolvedValue({ runId: "run-affiliate-001" });
    initLLMProviderManagerEnv({
      storage: {
        providerKeys: { getActive: () => null },
      } as any,
      secretStore: {} as any,
      getRpcClient: () => ({ request: (...args: unknown[]) => mockRpcRequest(...args) } as any),
      toMstSnapshot: vi.fn(),
      allKeysToMstSnapshots: vi.fn(),
      syncActiveKey: vi.fn(),
      syncAllAuthProfiles: vi.fn(),
      writeProxyRouterConfig: vi.fn(),
      writeDefaultModelToConfig: vi.fn(),
      writeFullGatewayConfig: vi.fn(),
      restartGateway: vi.fn(),
      proxyFetch: vi.fn(),
      stateDir: "/tmp/rivonclaw-test",
      getLastSystemProxy: () => null,
    });
    rootStore.ingestGraphQLResponse({
      runProfiles: [],
      surfaces: [],
      toolSpecs: [],
      shops: [],
    });
  });

  it("does not dispatch sample-review work items to the agent", async () => {
    const workItem = createSampleReviewWorkItem();
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);

    expect(result.runId).toBeUndefined();
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
  });

  it("resolves expected-sales prediction cache ids before dispatching affiliate work", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      affiliateExpectedSalesPredictions: {
        status: GQL.AffiliateExpectedSalesPredictionStatus.Ok,
        requestId: "prediction-request-001",
        modelTag: "affiliate-expected-test",
        modelType: "ridge",
        trainedAt: "2026-05-11T00:00:00.000Z",
        featureVersion: "v1",
        predictions: [{
          cacheId: "prediction-cache-001",
          status: GQL.AffiliatePredictionStatus.Ok,
          message: null,
          expectedSalesUnits: 3,
          subject: {
            sampleApplicationRecordId: "sample-record-001",
            platformApplicationId: "platform-sample-001",
            creatorId: "creator-001",
            productId: "product-001",
          },
          resolvedContext: {
            shopId: "shop-001",
            sampleApplicationRecordId: "sample-record-001",
            platformApplicationId: "platform-sample-001",
            creatorId: "creator-001",
            productId: "product-001",
            productTitle: "Test Product",
          },
          predictionQuality: {
            score: 0.82,
            level: "HIGH",
            featureCompletenessScore: 0.9,
            dataSupportScore: 0.8,
            probabilityMarginScore: 0.75,
            interpretation: "sufficient signal",
          },
          thresholdProbabilities: {
            unitsGe1: 0.7,
            unitsGe2: 0.55,
            unitsGe3: 0.45,
            unitsGe5: 0.2,
            unitsGe10: 0.05,
          },
          validation: null,
        }],
      },
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createCreatorReplyWorkItem({
      id: "collab-expected-001",
      collaborationRecordId: "collab-expected-001",
      collaboration: {
        ...createCreatorReplyWorkItem().collaboration,
        id: "collab-expected-001",
      },
    });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        conversationId: "conversation-001",
        collaborationRecordId: "collab-expected-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    await session.handleWorkItem(workItem);

    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("affiliateExpectedSalesPredictions"),
      expect.objectContaining({
        input: expect.objectContaining({
          shopId: "shop-001",
          scenario: GQL.AffiliateExpectedSalesPredictionScenario.TargetCollaborationPlanning,
        }),
      }),
    );
    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.message).toContain("prediction-cache-001");
    expect(agentCall?.[1]?.message).toContain("predictionCacheIds");
  });

  it("reuses collaboration prediction snapshot cache ids for deterministic sample review", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      if (query.includes("ResolveAffiliateWorkItem")) {
        return {
          resolveAffiliateWorkItem: {
            decision: GQL.AffiliateWorkItemResolutionDecision.RequestAction,
            stale: false,
            actionMode: GQL.AffiliateActionRequestMode.ProposalCreated,
            proposal: { id: "proposal-from-snapshot" },
            collaborationRecord: {
              id: "collab-with-snapshot",
              processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.WaitingApproval,
            },
          },
        };
      }
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createSampleReviewWorkItem({
      id: "collab-with-snapshot",
      collaborationRecordId: "collab-with-snapshot",
      collaboration: {
        ...createSampleReviewWorkItem().collaboration,
        id: "collab-with-snapshot",
        lastSignalAt: "2026-05-11T00:01:00.000Z",
        predictionSnapshots: [{
          sourceCacheId: "prediction-cache-from-snapshot",
          predictionType: GQL.AffiliatePredictionType.SalesUnitsForecast,
          captureMode: GQL.AffiliatePredictionCaptureMode.PromotedFromCache,
          scenario: GQL.AffiliateExpectedSalesPredictionScenario.SampleReview,
          subject: {
            sampleApplicationRecordId: "sample-record-001",
            platformApplicationId: "platform-sample-001",
            creatorId: "creator-001",
            productId: "product-001",
          },
          status: GQL.AffiliatePredictionStatus.Ok,
          output: { expectedSalesUnits: 0 },
          model: {},
          diagnostics: {},
          predictedAt: "2026-05-11T00:00:00.000Z",
          capturedAt: "2026-05-11T00:00:01.000Z",
          resolvedContext: null,
          message: null,
        }],
      },
    });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
        decisionThresholds: { minExpectedSalesUnits: 2 },
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
        collaborationRecordId: "collab-with-snapshot",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    await session.handleWorkItem(workItem);

    expect(graphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("affiliateExpectedSalesPredictions"),
      expect.anything(),
    );
    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("ResolveAffiliateWorkItem"),
      {
        input: expect.objectContaining({
          action: expect.objectContaining({
            predictionCacheIds: ["prediction-cache-from-snapshot"],
          }),
        }),
      },
    );
  });

  it("deterministically requests sample review when prediction and threshold are complete", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      if (query.includes("affiliateExpectedSalesPredictions")) {
        return {
          affiliateExpectedSalesPredictions: {
            status: GQL.AffiliateExpectedSalesPredictionStatus.Ok,
            requestId: "prediction-request-reject",
            modelTag: "affiliate-expected-test",
            modelType: "ridge",
            trainedAt: "2026-05-11T00:00:00.000Z",
            featureVersion: "v1",
            predictions: [{
              cacheId: "prediction-cache-reject",
              status: GQL.AffiliatePredictionStatus.Ok,
              message: null,
              expectedSalesUnits: 0,
              subject: {
                sampleApplicationRecordId: "sample-record-001",
                platformApplicationId: "platform-sample-001",
                creatorId: "creator-001",
                productId: "product-001",
              },
              resolvedContext: {
                shopId: "shop-001",
                sampleApplicationRecordId: "sample-record-001",
                platformApplicationId: "platform-sample-001",
                creatorId: "creator-001",
                productId: "product-001",
                productTitle: "Test Product",
              },
              predictionQuality: null,
              thresholdProbabilities: null,
              validation: null,
            }],
          },
        };
      }
      if (query.includes("ResolveAffiliateWorkItem")) {
        return {
          resolveAffiliateWorkItem: {
            decision: GQL.AffiliateWorkItemResolutionDecision.RequestAction,
            stale: false,
            actionMode: GQL.AffiliateActionRequestMode.ProposalCreated,
            proposal: { id: "proposal-001" },
            collaborationRecord: {
              id: "collab-deterministic-001",
              processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.WaitingApproval,
            },
          },
        };
      }
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createSampleReviewWorkItem({
      id: "collab-deterministic-001",
      collaborationRecordId: "collab-deterministic-001",
      collaboration: {
        ...createSampleReviewWorkItem().collaboration,
        id: "collab-deterministic-001",
        lastSignalAt: "2026-05-11T00:01:00.000Z",
      },
    });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
        decisionThresholds: { minExpectedSalesUnits: 2 },
        staffLanguage: "Chinese",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
        collaborationRecordId: "collab-deterministic-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);

    expect(result.runId).toBeUndefined();
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("ResolveAffiliateWorkItem"),
      {
        input: expect.objectContaining({
          shopId: "shop-001",
          collaborationRecordId: "collab-deterministic-001",
          handledSignalAt: "2026-05-11T00:01:00.000Z",
          decision: GQL.AffiliateWorkItemResolutionDecision.RequestAction,
          operatorSummary: expect.stringContaining("建议拒绝这次样品申请"),
          action: expect.objectContaining({
            type: GQL.ActionProposalType.ReviewSampleApplication,
            predictionCacheIds: ["prediction-cache-reject"],
            sampleReviewIntent: {
              sampleApplicationRecordId: "sample-record-001",
              platformApplicationId: "platform-sample-001",
              decision: GQL.AffiliateSampleReviewDecision.Reject,
              rejectReason: GQL.AffiliateSampleRejectReason.Other,
            },
          }),
        }),
      },
    );
  });

  it("marks sample review for staff when deterministic review cannot form a decision", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      if (query.includes("affiliateExpectedSalesPredictions")) {
        return {
          affiliateExpectedSalesPredictions: {
            status: GQL.AffiliateExpectedSalesPredictionStatus.Ok,
            requestId: "prediction-request-empty",
            modelTag: "affiliate-expected-test",
            modelType: "ridge",
            trainedAt: null,
            featureVersion: "v1",
            predictions: [],
          },
        };
      }
      if (query.includes("ResolveAffiliateWorkItem")) {
        return {
          resolveAffiliateWorkItem: {
            decision: GQL.AffiliateWorkItemResolutionDecision.NeedsStaffReview,
            stale: false,
            actionMode: null,
            proposal: null,
            collaborationRecord: {
              id: "collab-001",
              processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.StaffNeeded,
            },
          },
        };
      }
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createSampleReviewWorkItem();
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
        decisionThresholds: { minExpectedSalesUnits: 5 },
        staffLanguage: "Chinese",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);

    expect(result.runId).toBeUndefined();
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("ResolveAffiliateWorkItem"),
      {
        input: expect.objectContaining({
          shopId: "shop-001",
          collaborationRecordId: "collab-001",
          decision: GQL.AffiliateWorkItemResolutionDecision.NeedsStaffReview,
          operatorSummary: expect.stringContaining("没有可用的预估销量结果"),
        }),
      },
    );
  });

  it("does not ack work items when the gateway reports an agent run error", async () => {
    const workItem = createCreatorReplyWorkItem();
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        conversationId: "conversation-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);
    expect(result.runId).toBe("run-affiliate-001");

    mockGetAuthSession.mockClear();
    session.onRunCompleted("run-affiliate-001", { errored: true });

    expect(mockGetAuthSession).not.toHaveBeenCalled();
  });

  it("does not mark a run failed when affiliate_resolve_work_item already handled the work boundary", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      if (query.includes("affiliateExpectedSalesPredictions")) {
        return {
          affiliateExpectedSalesPredictions: {
            status: GQL.AffiliateExpectedSalesPredictionStatus.Ok,
            requestId: "prediction-request-empty",
            modelTag: "affiliate-expected-test",
            modelType: "ridge",
            trainedAt: null,
            featureVersion: "v1",
            predictions: [],
          },
        };
      }
      if (query.includes("AffiliateWorkItems")) {
        return {
          affiliateWorkItems: [
            {
              id: "work-collab-001",
              collaborationRecordId: "collab-001",
              versionAt: "2026-05-11T00:01:00.000Z",
              collaboration: {
              id: "collab-001",
              workHandledUntil: "2026-05-11T00:01:00.000Z",
              },
            },
          ],
        };
      }
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createCreatorReplyWorkItem({
      collaboration: {
        ...createCreatorReplyWorkItem().collaboration,
        lastSignalAt: "2026-05-11T00:01:00.000Z",
      },
    });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        conversationId: "conversation-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);
    expect(result.runId).toBe("run-affiliate-001");

    session.onRunCompleted("run-affiliate-001");

    await vi.waitFor(() => {
      expect(graphqlFetch).toHaveBeenCalledWith(
        expect.stringContaining("AffiliateWorkItems"),
        expect.anything(),
      );
    });
    expect(graphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("ResolveAffiliateWorkItem"),
      expect.anything(),
    );
  });

  it("does not dispatch work items that are projection-only", async () => {
    const workItem = createSampleReviewWorkItem({
      agentDispatchRecommended: false,
      workKind: GQL.AffiliateWorkKind.ApprovalWaiting,
      processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.WaitingApproval,
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });
    expect(request).toBeNull();
  });
});
