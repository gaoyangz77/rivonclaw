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
  const collaboration: GQL.AffiliateCollaborationRecord = {
    id: "collab-001",
    userId: "user-001",
    shopId: "shop-001",
    creatorId: "creator-001",
    creatorImId: "creator-im-001",
    productId: "product-001",
    sampleApplicationRecordId: "sample-record-001",
    platformConversationId: "conversation-001",
    lifecycleStage: "SAMPLE_PENDING",
    processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.NeedProcess,
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
  } as GQL.AffiliateCollaborationRecord;

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
    processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.NeedProcess,
    processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview],
    recommendedActionTypes: [
      GQL.ActionProposalType.ApproveSample,
      GQL.ActionProposalType.RejectSample,
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
        GQL.ActionProposalType.ApproveSample,
        GQL.ActionProposalType.RejectSample,
      ],
      relatedSampleApplications: [sampleApplicationRecord],
    },
    ...overrides,
  };
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

  it("turns a sample-review work item into a typed affiliate agent run", async () => {
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

    expect(result.runId).toBe("run-affiliate-001");
    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall).toBeDefined();
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "agent",
      expect.objectContaining({
        sessionKey: "agent:main:affiliate:tiktok:sample_application:sample-record-001",
        promptMode: "raw",
        idempotencyKey: "affiliate:tiktok:work:SAMPLE_REVIEW_NEEDED:collab-001:sample-record-001:2026-05-11T00:01:00.000Z",
        message: expect.stringContaining("[Affiliate Work Item: Sample Review Needed]"),
        extraSystemPrompt: expect.stringContaining("Affiliate / Creator Management Agent"),
      }),
    );
    expect(agentCall?.[1]?.message).toContain("APPROVE_SAMPLE or REJECT_SAMPLE");
    expect(agentCall?.[1]?.message).toContain("platform-sample-001");
    expect(agentCall?.[1]?.message).toContain("reply exactly NO_REPLY");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("final assistant response exactly NO_REPLY");
  });

  it("resolves P50 prediction cache ids before dispatching affiliate work", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      affiliateP50SalesPredictions: {
        status: GQL.AffiliateP50SalesPredictionStatus.Ok,
        requestId: "prediction-request-001",
        modelTag: "affiliate-p50-test",
        modelType: "ridge",
        trainedAt: "2026-05-11T00:00:00.000Z",
        featureVersion: "v1",
        predictions: [{
          cacheId: "prediction-cache-001",
          status: GQL.AffiliatePredictionStatus.Ok,
          message: null,
          p50Units: 3,
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
    const workItem = createSampleReviewWorkItem({
      id: "collab-p50-001",
      collaborationRecordId: "collab-p50-001",
      collaboration: {
        ...createSampleReviewWorkItem().collaboration,
        id: "collab-p50-001",
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
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
        collaborationRecordId: "collab-p50-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    await session.handleWorkItem(workItem);

    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("affiliateP50SalesPredictions"),
      expect.objectContaining({
        input: expect.objectContaining({
          shopId: "shop-001",
          scenario: GQL.AffiliateP50SalesPredictionScenario.SampleReview,
        }),
      }),
    );
    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.message).toContain("prediction-cache-001");
    expect(agentCall?.[1]?.message).toContain("predictionCacheIds");
  });

  it("does not ack work items when the gateway reports an agent run error", async () => {
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
    expect(result.runId).toBe("run-affiliate-001");

    mockGetAuthSession.mockClear();
    session.onRunCompleted("run-affiliate-001", { errored: true });

    expect(mockGetAuthSession).not.toHaveBeenCalled();
  });

  it("does not mark a run failed when affiliate_resolve_work_item already handled the work boundary", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      if (query.includes("affiliateP50SalesPredictions")) {
        return {
          affiliateP50SalesPredictions: {
            status: GQL.AffiliateP50SalesPredictionStatus.Ok,
            requestId: "prediction-request-empty",
            modelTag: "affiliate-p50-test",
            modelType: "ridge",
            trainedAt: null,
            featureVersion: "v1",
            predictions: [],
          },
        };
      }
      if (query.includes("AffiliateWorkspace")) {
        return {
          affiliateWorkspace: {
            sampleApplicationRecords: [],
            collaborationRecords: [{
              id: "collab-001",
              workHandledUntil: "2026-05-11T00:01:00.000Z",
            }],
            actionProposals: [],
            approvalPolicies: [],
          },
        };
      }
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createSampleReviewWorkItem({
      collaboration: {
        ...createSampleReviewWorkItem().collaboration,
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
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
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
        expect.stringContaining("AffiliateWorkspace"),
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
