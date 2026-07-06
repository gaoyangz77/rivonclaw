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
import { AffiliateInbound } from "./affiliate-inbound.js";
import { initLLMProviderManagerEnv, rootStore } from "../app/store/desktop-store.js";

describe("affiliate session identity", () => {
  it("uses user id and creator relationship id as the long-lived affiliate session key", () => {
    expect(
      AffiliateSession.buildScopeKey("tiktok", {
        userId: "user-1",
        shopId: "shop-1",
        platformShopId: "platform-shop-1",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conv-1",
        creatorRelationshipId: "rel-1",
      }),
    ).toBe("agent:main:affiliate:user-1:rel-1");
    expect(
      AffiliateSession.buildScopeKey("whatsapp", {
        userId: "user-1",
        shopId: "shop-1",
        platformShopId: "platform-shop-1",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "wa-message-1",
        creatorRelationshipId: "rel-1",
      }),
    ).toBe("agent:main:affiliate:user-1:rel-1");
  });

  it("rejects affiliate session keys without a user id", () => {
    expect(() =>
      AffiliateSession.buildScopeKey("tiktok", {
        shopId: "shop-1",
        platformShopId: "platform-shop-1",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conv-1",
        creatorRelationshipId: "rel-1",
      }),
    ).toThrow("userId is required");
  });

  it("rejects affiliate session keys without a creator relationship id", () => {
    expect(() =>
      AffiliateSession.buildScopeKey("tiktok", {
        userId: "user-1",
        shopId: "shop-1",
        platformShopId: "platform-shop-1",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conv-1",
      } as any),
    ).toThrow("creatorRelationshipId is required");
  });
});

async function waitForCondition(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

function createSampleReviewWorkItem(overrides: Partial<GQL.AffiliateWorkItem> = {}): GQL.AffiliateWorkItem {
  const collaboration = {
    id: "collab-001",
    userId: "user-001",
    shopId: "shop-001",
    creatorId: "creator-001",
    creatorImId: "creator-im-001",
    productId: "product-001",
    sampleApplicationRecordId: "sample-record-001",
    lifecycleStage: "SAMPLE_PENDING",
    processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.AgentRequired,
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
    id: "relationship-001",
    focusShopId: "shop-001",
    focusPlatformShopId: "platform-shop-001",
    routingShopIds: ["shop-001"],
    routingPlatformShopIds: ["platform-shop-001"],
    subjectType: GQL.AffiliateWorkItemSubjectType.CreatorRelationship,
    creatorRelationshipId: "relationship-001",
    collaborationRecordId: "collab-001",
    workKind: GQL.AffiliateWorkKind.SampleApplicationDecision,
    workBundleKind: GQL.AffiliateWorkBundleKind.SampleReviewOnly,
    agentDispatchRecommended: true,
    staffReviewRequired: false,
    processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
    requiredAction: GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask,
    processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview],
    recommendedActionTypes: [
      GQL.ActionProposalType.ReviewSampleApplication,
    ],
    versionAt: "2026-05-11T00:01:00.000Z",
    collaboration,
    creatorRelationship: {
      id: "relationship-001",
      userId: "user-001",
      creatorId: "creator-001",
      shopStates: [],
      whatsappContacts: [],
      emailContacts: [],
      processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask,
      processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview],
      nextSellerActionAt: null,
      lastInboundAt: null,
      lastOutboundAt: null,
      lastAgentHandledAt: null,
      lastBlockedAt: null,
      lastPlatformSyncedAt: null,
      stateUpdatedAt: "2026-05-11T00:01:00.000Z",
      activeCollaborationRecordIds: ["collab-001"],
      pendingActionProposalId: null,
      blocked: false,
      blockedShopIds: [],
      createdAt: "2026-05-11T00:00:00.000Z",
      updatedAt: "2026-05-11T00:01:00.000Z",
    },
    sampleApplicationRecord,
    latestPendingProposal: null,
    context: {
      activeCollaborations: [collaboration],
      affiliateCollaboration: null,
      ambiguousCollaborationCandidates: [],
      creatorProfile: null,
      creatorRelation: null,
      focusCollaboration: collaboration,
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
    ...(base.collaboration as GQL.AffiliateCollaborationRecord),
    sampleApplicationRecordId: null,
    lifecycleStage: "CONVERSATION",
    processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.AgentRequired,
    requiredAction: GQL.AffiliateCollaborationRequiredAction.RespondToCreator,
    processReasons: [GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply],
    lastCreatorMessageId: null,
    lastCreatorMessageAt: null,
  } as unknown as GQL.AffiliateCollaborationRecord;

  return {
    ...base,
    workKind: GQL.AffiliateWorkKind.InboundMessageTriage,
    workBundleKind: GQL.AffiliateWorkBundleKind.CreatorReplyOnly,
    processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
    requiredAction: GQL.AffiliateRelationshipRequiredAction.ReplyToCreator,
    processReasons: [GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply],
    recommendedActionTypes: [
      GQL.ActionProposalType.SendMessage,
    ],
    collaboration,
    creatorRelationship: {
      ...base.creatorRelationship,
      processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.ReplyToCreator,
      processReasons: [GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply],
    },
    sampleApplicationRecord: null,
    context: {
      ...base.context,
      activeCollaborations: [collaboration],
      focusCollaboration: collaboration,
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
        providerKeys: {
          getActive: () => ({
            provider: "openai",
            model: "gpt-5-test",
            authType: "custom",
          }),
        },
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

  it("fetches sample update workspace snapshots within the creator relationship boundary", async () => {
    const graphqlFetch = vi.fn(async (query: string, variables: unknown) => {
      if (query.includes("affiliateWorkspace")) {
        return {
          affiliateWorkspace: {
            sampleApplicationRecords: [],
            collaborationRecords: [],
            actionProposals: [],
            approvalPolicies: [],
            creatorRelations: [],
            creatorTags: [],
            creatorProfiles: [],
            campaigns: [],
            campaignProducts: [],
            affiliateCollaborations: [],
            searchRuns: [],
            candidates: [],
          },
        };
      }
      throw new Error(`Unexpected GraphQL call: ${query} ${JSON.stringify(variables)}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    await session.handleSampleApplicationUpdated({
      applicationId: "platform-sample-001",
      creatorRelationshipId: "relationship-001",
      creatorId: "creator-001",
      productId: "product-001",
      status: "PENDING",
      eventTime: "2026-05-11T00:01:00.000Z",
    } as any);

    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("affiliateWorkspace"),
      expect.objectContaining({
        input: expect.objectContaining({
          shopId: "shop-001",
          creatorRelationshipId: "relationship-001",
          platformApplicationId: "platform-sample-001",
        }),
      }),
    );
  });

  it("dispatches sample-review work items to the agent instead of resolving them in desktop", async () => {
    const workItem = createSampleReviewWorkItem();
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);

    expect(result).toEqual({
      runId: "run-affiliate-001",
      runMode: "OPERATOR_REASONING",
    });
    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.message).toContain("[Affiliate Work Item: Sample Application Review]");
    expect(agentCall?.[1]?.message).toContain("non-binding evidence");
  });

  it("starts affiliate work runs from a brand-new checkpoint session when no checkpoint is committed", async () => {
    const workItem = createSampleReviewWorkItem();
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
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
    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.create", expect.objectContaining({
      key: "agent:main:affiliate:user-001:relationship-001",
    }));
    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.reset", {
      key: "agent:main:affiliate:user-001:relationship-001",
      reason: "new",
    });
    const pluginPatchCall = mockRpcRequest.mock.calls.find((call) => call[0] === "sessions.pluginPatch");
    expect(pluginPatchCall?.[1]).toEqual(expect.objectContaining({
      key: "agent:main:affiliate:user-001:relationship-001",
      pluginId: "rivonclaw-capability-manager",
      namespace: "affiliateCheckpoint",
      value: {
        baseCheckpointId: null,
        candidateCheckpointId: expect.any(String),
      },
    }));

    session.onRunCompleted("run-affiliate-001");

    await waitForCondition(() =>
      mockRpcRequest.mock.calls.some((call) => call[0] === "sessions.checkpoint.create"),
    );
    const checkpointCall = mockRpcRequest.mock.calls.find((call) => call[0] === "sessions.checkpoint.create");
    expect(checkpointCall?.[1]).toEqual(expect.objectContaining({
      key: "agent:main:affiliate:user-001:relationship-001",
      checkpointId: pluginPatchCall?.[1]?.value?.candidateCheckpointId,
    }));
  });

  it("restores affiliate work runs from the committed relationship checkpoint", async () => {
    const workItem = createSampleReviewWorkItem({
      creatorRelationship: {
        ...(createSampleReviewWorkItem().creatorRelationship as GQL.AffiliateCreatorRelationship),
        committedCheckpointId: "checkpoint-committed-001",
      },
    });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    await session.handleWorkItem(workItem);

    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.compaction.restore", {
      key: "agent:main:affiliate:user-001:relationship-001",
      checkpointId: "checkpoint-committed-001",
    });
    expect(mockRpcRequest.mock.calls.some((call) => call[0] === "sessions.reset")).toBe(false);
    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.pluginPatch", expect.objectContaining({
      value: expect.objectContaining({
        baseCheckpointId: "checkpoint-committed-001",
        candidateCheckpointId: expect.any(String),
      }),
    }));
  });

  it("does not dispatch caught-up sample-review work items when the backend dispatch flag is false", async () => {
    const sampleWorkItem = createSampleReviewWorkItem({
      focusShopId: "shop-001",
      focusPlatformShopId: "platform-shop-001",
      routingShopIds: ["shop-001"],
      routingPlatformShopIds: ["platform-shop-001"],
      agentDispatchRecommended: false,
      staffReviewRequired: true,
    });
    const graphqlFetch = vi.fn(async (_query: string, variables: any) => {
      if (variables?.input?.agentDispatchRecommended === true) {
        return { affiliateWorkItems: [] };
      }
      if (variables?.input?.workKind === GQL.AffiliateWorkKind.SampleApplicationDecision) {
        return { affiliateWorkItems: [sampleWorkItem] };
      }
      throw new Error(`Unexpected GraphQL variables: ${JSON.stringify(variables)}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const inbound = new AffiliateInbound("en");

    inbound.syncFromShops([
      {
        id: "shop-001",
        userId: "user-001",
        platform: "tiktok",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        runProfileId: "AFFILIATE_OPERATOR",
      },
    ]);

    await inbound.catchUpCurrentWorkItems();

    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("AffiliateWorkItems"),
      expect.objectContaining({
        input: expect.objectContaining({
          processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
          agentDispatchRecommended: true,
        }),
      }),
    );
    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("AffiliateWorkItems"),
      expect.objectContaining({
        input: expect.objectContaining({
          processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
          workKind: GQL.AffiliateWorkKind.SampleApplicationDecision,
        }),
      }),
    );
    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall).toBeUndefined();
  });

  it("uses the signed-in user id for caught-up affiliate work when shop context has no owner id", () => {
    rootStore.setCurrentUser({
      userId: "user-001",
      email: "affiliate@example.com",
      name: "Affiliate Tester",
      createdAt: "2026-01-01T00:00:00Z",
      enrolledModules: [],
      entitlementKeys: [],
      defaultRunProfileId: null,
    });
    const workItem = createSampleReviewWorkItem({
      focusShopId: "shop-001",
      focusPlatformShopId: "platform-shop-001",
      routingShopIds: ["shop-001"],
      routingPlatformShopIds: ["platform-shop-001"],
      agentDispatchRecommended: true,
    });
    const inbound = new AffiliateInbound("en");
    const context = (inbound as any).buildContextFromWorkItem(
      {
        objectId: "shop-001",
        platform: "tiktok",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      workItem,
    ) as { userId?: string } | null;

    expect(context?.userId).toBe("user-001");
  });

  it("auto-forwards creator-outreach assistant text through affiliate delivery bridge", async () => {
    const graphqlFetch = vi.fn().mockImplementation(async (query: string) => {
      if (query.includes("DeliverAffiliateCreatorText")) {
        return {
          deliverAffiliateCreatorText: {
            id: "delivery-001",
            status: "SENT",
            preferredChannel: "WHATSAPP",
            actualChannel: "WHATSAPP",
          },
        };
      }
      throw new Error("delta unavailable");
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
      },
    );

    const result = await session.handleCreatorMessage({
      shopId: "platform-shop-001",
      conversationId: "conversation-001",
      messageId: "message-001",
      messageType: "TEXT",
      senderRole: "CREATOR",
      imUserId: "creator-im-001",
      content: JSON.stringify({ content: "Can we talk on WhatsApp?" }),
      createTime: 1780000000,
    } as any);
    expect(result.runMode).toBe("CREATOR_OUTREACH");
    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("CREATOR_OUTREACH");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("WhatsApp and Outlook email are direct affiliate outreach channels");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("bridge delivers the final assistant text");
    expect(agentCall?.[1]?.message).toContain("direct-channel routing");
    expect(agentCall?.[1]?.message).toContain("affiliate_set_creator_email");
    expect(agentCall?.[1]?.message).not.toContain("WhatsApp-first");

    session.handleAgentEvent({
      runId: result.runId,
      stream: "assistant",
      data: { text: "Sure, I will follow up with the details here." },
    });
    session.handleAgentEvent({
      runId: result.runId,
      stream: "lifecycle",
      data: { phase: "end" },
    });
    session.onRunCompleted(result.runId!);

    await waitForCondition(() =>
      graphqlFetch.mock.calls.some(([query]) => String(query).includes("DeliverAffiliateCreatorText")),
    );
    const [, variables] = graphqlFetch.mock.calls.find(([query]) =>
      String(query).includes("DeliverAffiliateCreatorText"),
    )!;
    expect(variables).toEqual({
      input: expect.objectContaining({
        shopId: "shop-001",
        creatorRelationshipId: "relationship-001",
        text: "Sure, I will follow up with the details here.",
        runId: "run-affiliate-001",
        sessionKey: "agent:main:affiliate:user-001:relationship-001",
        baseCheckpointId: null,
        candidateCheckpointId: expect.any(String),
        source: "AGENT_AUTO_FORWARD",
      }),
    });
  });

  it("dispatches relationship-scoped WhatsApp creator signals through the delivery bridge", async () => {
    const graphqlFetch = vi.fn().mockImplementation(async (query: string) => {
      if (query.includes("DeliverAffiliateCreatorText")) {
        return {
          deliverAffiliateCreatorText: {
            id: "delivery-whatsapp-001",
            status: "SENT",
            preferredChannel: "WHATSAPP",
            actualChannel: "WHATSAPP",
          },
        };
      }
      throw new Error("workspace unavailable");
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "relationship-001",
      },
    );

    const result = await session.handleRelationshipSignal({
      type: GQL.AffiliateRelationshipSignalType.AffiliateRelationshipMessageObserved,
      source: GQL.AffiliateRelationshipSignalSource.Webhook,
      workSignal: true,
      shopId: "shop-001",
      platformShopId: "platform-shop-001",
      creatorRelationshipId: "relationship-001",
      messageId: "wamid-1",
      messageType: "conversation",
      channel: "WHATSAPP",
      messageDirection: GQL.AffiliateCreatorMessageDirection.Creator,
      eventTime: "2026-07-01T12:00:00.000Z",
    } as GQL.AffiliateRelationshipSignal);
    expect(result.runMode).toBe("CREATOR_OUTREACH");

    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("WhatsApp and Outlook email are direct affiliate outreach channels");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("affiliate_get_creator_contact_state");
    expect(agentCall?.[1]?.message).toContain("Affiliate Creator Message Update");
    expect(agentCall?.[1]?.message).toContain("Current Channel: WHATSAPP");
    expect(agentCall?.[1]?.message).toContain("Creator Relationship ID: relationship-001");

    session.handleAgentEvent({
      runId: result.runId,
      stream: "assistant",
      data: { text: "Thanks, I will send the next steps here." },
    });
    session.handleAgentEvent({
      runId: result.runId,
      stream: "lifecycle",
      data: { phase: "end" },
    });
    session.onRunCompleted(result.runId!);

    await waitForCondition(() =>
      graphqlFetch.mock.calls.some(([query]) => String(query).includes("DeliverAffiliateCreatorText")),
    );
    const [, variables] = graphqlFetch.mock.calls.find(([query]) =>
      String(query).includes("DeliverAffiliateCreatorText"),
    )!;
    expect(variables).toEqual({
      input: expect.objectContaining({
        creatorRelationshipId: "relationship-001",
        text: "Thanks, I will send the next steps here.",
        sessionKey: "agent:main:affiliate:user-001:relationship-001",
        baseCheckpointId: null,
        candidateCheckpointId: expect.any(String),
        preferredChannel: "WHATSAPP",
      }),
    });
  });

  it("preserves email as preferred channel for relationship-scoped Outlook creator signals", async () => {
    const graphqlFetch = vi.fn().mockImplementation(async (query: string) => {
      if (query.includes("DeliverAffiliateCreatorText")) {
        return {
          deliverAffiliateCreatorText: {
            id: "delivery-email-001",
            status: "SENT",
            preferredChannel: "EMAIL",
            actualChannel: "EMAIL",
          },
        };
      }
      throw new Error("workspace unavailable");
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "relationship-001",
      },
    );

    const result = await session.handleRelationshipSignal({
      type: GQL.AffiliateRelationshipSignalType.AffiliateRelationshipMessageObserved,
      source: GQL.AffiliateRelationshipSignalSource.Webhook,
      workSignal: true,
      shopId: "shop-001",
      platformShopId: "platform-shop-001",
      creatorRelationshipId: "relationship-001",
      messageId: "graph-message-1",
      messageType: "email",
      channel: "EMAIL",
      messageDirection: GQL.AffiliateCreatorMessageDirection.Creator,
      eventTime: "2026-07-01T12:05:00.000Z",
    } as GQL.AffiliateRelationshipSignal);

    session.handleAgentEvent({
      runId: result.runId,
      stream: "assistant",
      data: { text: "Thanks, I will reply with the agreement details by email." },
    });
    session.handleAgentEvent({
      runId: result.runId,
      stream: "lifecycle",
      data: { phase: "end" },
    });
    session.onRunCompleted(result.runId!);

    await waitForCondition(() =>
      graphqlFetch.mock.calls.some(([query]) => String(query).includes("DeliverAffiliateCreatorText")),
    );
    const [, variables] = graphqlFetch.mock.calls.find(([query]) =>
      String(query).includes("DeliverAffiliateCreatorText"),
    )!;
    expect(variables).toEqual({
      input: expect.objectContaining({
        creatorRelationshipId: "relationship-001",
        text: "Thanks, I will reply with the agreement details by email.",
        sessionKey: "agent:main:affiliate:user-001:relationship-001",
        baseCheckpointId: null,
        candidateCheckpointId: expect.any(String),
        preferredChannel: "EMAIL",
      }),
    });
  });

  it("does not create creator-outreach sessions without a creator relationship id", () => {
    expect(() => new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
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
      } as any,
    )).toThrow("creatorRelationshipId is required");
  });

  it("does not prefetch expected-sales prediction before dispatching affiliate work", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createCreatorReplyWorkItem({
      id: "collab-expected-001",
      collaborationRecordId: "collab-expected-001",
      collaboration: {
        ...(createCreatorReplyWorkItem().collaboration as GQL.AffiliateCollaborationRecord),
        id: "collab-expected-001",
      },
    });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        collaborationRecordId: "collab-expected-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);
    expect(result.runMode).toBe("OPERATOR_REASONING");

    expect(graphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("affiliateExpectedSalesPredictions"),
      expect.anything(),
    );
    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("OPERATOR_REASONING");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("assistant output is internal/operator-facing");
    expect(agentCall?.[1]?.message).toContain("Status: NOT_PREFETCHED");
    expect(agentCall?.[1]?.message).toContain("call affiliate_predict_creator_product_fit");
    expect(agentCall?.[1]?.message).toContain("Prediction is an agent tool");
  });

  it("does not auto-forward operator-reasoning assistant text even with a creator relationship id", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({
      affiliateExpectedSalesPredictions: {
        status: GQL.AffiliateExpectedSalesPredictionStatus.Ok,
        requestId: "prediction-request-operator-001",
        modelTag: "affiliate-expected-test",
        modelType: "ridge",
        trainedAt: "2026-05-11T00:00:00.000Z",
        featureVersion: "v1",
        predictions: [],
      },
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createCreatorReplyWorkItem();
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
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
        creatorRelationshipId: "relationship-operator-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);
    expect(result).toEqual({
      runId: "run-affiliate-001",
      runMode: "OPERATOR_REASONING",
    });

    expect(session.handleAgentEvent({
      runId: result.runId,
      stream: "assistant",
      data: { text: "Internal operator summary that must never be sent." },
    })).toBe(false);
    expect(session.handleAgentEvent({
      runId: result.runId,
      stream: "lifecycle",
      data: { phase: "end" },
    })).toBe(false);
    await Promise.resolve();

    expect(graphqlFetch.mock.calls.some(([query]) => String(query).includes("DeliverAffiliateCreatorText"))).toBe(false);
  });

  it("passes collaboration prediction snapshot cache ids into the sample review agent run", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createSampleReviewWorkItem({
      id: "collab-with-snapshot",
      collaborationRecordId: "collab-with-snapshot",
      collaboration: {
        ...(createSampleReviewWorkItem().collaboration as GQL.AffiliateCollaborationRecord),
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
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
        decisionThresholds: { minExpectedSalesUnits: 2 },
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
        collaborationRecordId: "collab-with-snapshot",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);

    expect(result).toEqual({
      runId: "run-affiliate-001",
      runMode: "OPERATOR_REASONING",
    });
    expect(graphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("affiliateExpectedSalesPredictions"),
      expect.anything(),
    );
    expect(graphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("ResolveAffiliateWorkItem"),
      expect.anything(),
    );
    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.message).toContain("[Affiliate Work Item: Sample Application Review]");
    expect(agentCall?.[1]?.message).toContain("prediction-cache-from-snapshot");
    expect(agentCall?.[1]?.message).toContain("non-binding evidence");
  });

  it("dispatches sample review to the agent without prefetching prediction evidence", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createSampleReviewWorkItem({
      id: "collab-sample-agent-001",
      collaborationRecordId: "collab-sample-agent-001",
      agentDispatchRecommended: true,
      staffReviewRequired: false,
      collaboration: {
        ...(createSampleReviewWorkItem().collaboration as GQL.AffiliateCollaborationRecord),
        id: "collab-sample-agent-001",
        lastSignalAt: "2026-05-11T00:01:00.000Z",
      },
    });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
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
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
        collaborationRecordId: "collab-sample-agent-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);

    expect(result).toEqual({
      runId: "run-affiliate-001",
      runMode: "OPERATOR_REASONING",
    });
    expect(graphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("affiliateExpectedSalesPredictions"),
      expect.anything(),
    );
    expect(graphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("ResolveAffiliateWorkItem"),
      expect.anything(),
    );
    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.message).toContain("[Affiliate Work Item: Sample Application Review]");
    expect(agentCall?.[1]?.message).toContain("call affiliate_predict_creator_product_fit with creatorRelationshipId before submitting a REVIEW_SAMPLE_APPLICATION action");
    expect(agentCall?.[1]?.message).toContain("copy its cacheId into action.predictionCacheIds");
    expect(agentCall?.[1]?.message).toContain("must not automatically determine approve/reject");
  });

  it("renders relationship-level sample pending work as a sample review agent run", () => {
    const workItem = createSampleReviewWorkItem({
      workKind: GQL.AffiliateWorkKind.ManualReview,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask,
      processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview],
      agentDispatchRecommended: true,
      staffReviewRequired: false,
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

    expect(request?.message).toContain("[Affiliate Work Item: Sample Application Review]");
    expect(request?.message).toContain("Use the CreatorRelationship workspace as the business boundary");
    expect(request?.message).toContain("non-binding evidence");
  });

  it("does not build a sample review agent run when backend has already handled that work boundary", () => {
    const workItem = createSampleReviewWorkItem({
      agentDispatchRecommended: false,
      staffReviewRequired: false,
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });
    expect(request).toBeNull();
  });

  it("describes collaboration records as relationship context instead of the work owner", () => {
    const request = buildAffiliateAgentRunRequest({
      workItem: createSampleReviewWorkItem(),
      platform: "tiktok",
    });

    expect(request?.message).toContain("## Backend Relationship Work Projection");
    expect(request?.message).toContain("Relationship Work Item ID: relationship-001");
    expect(request?.message).toContain("Creator Relationship ID: relationship-001");
    expect(request?.message).toContain("Focus Collaboration Context ID: collab-001");
    expect(request?.message).toContain(
      "This collaboration is context under the CreatorRelationship; it is not the work owner or Agent memory boundary.",
    );
    expect(request?.message).toContain("Focus Collaboration Context: collab-001");
    expect(request?.message).not.toContain("Primary Collaboration Candidate");
  });

  it("keeps ambiguous relationship work unbound from an arbitrary focus collaboration", () => {
    const base = createCreatorReplyWorkItem();
    const firstCollaboration = {
      ...(base.collaboration as GQL.AffiliateCollaborationRecord),
      id: "collab-ambiguous-001",
      productId: "product-ambiguous-001",
      sampleApplicationRecordId: "sample-ambiguous-001",
    } as GQL.AffiliateCollaborationRecord;
    const secondCollaboration = {
      ...(base.collaboration as GQL.AffiliateCollaborationRecord),
      id: "collab-ambiguous-002",
      productId: "product-ambiguous-002",
      sampleApplicationRecordId: null,
    } as GQL.AffiliateCollaborationRecord;
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({
        collaborationRecordId: null,
        collaboration: null,
        sampleApplicationRecord: null,
        processReasons: [
          GQL.AffiliateCollaborationRecordProcessReason.CollaborationContextAmbiguous,
          GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply,
        ],
        context: {
          ...base.context,
          activeCollaborations: [firstCollaboration, secondCollaboration],
          ambiguousCollaborationCandidates: [firstCollaboration, secondCollaboration],
          focusCollaboration: null,
          productContext: null,
          primarySampleApplication: null,
        },
      }),
      platform: "tiktok",
    });

    expect(request?.message).toContain("Focus Collaboration Context ID: (none)");
    expect(request?.message).toContain(
      "(none: this creator relationship work item has no resolved focus collaboration context)",
    );
    expect(request?.message).toContain("Active Collaborations: 2");
    expect(request?.message).toContain("Ambiguous Collaboration Candidates:");
    expect(request?.message).toContain("contextCollaborationRecordId=collab-ambiguous-001");
    expect(request?.message).toContain("contextCollaborationRecordId=collab-ambiguous-002");
    expect(request?.message).toContain("Ambiguity Instruction");
    expect(request?.message).not.toContain("This collaboration is context under the CreatorRelationship");
  });

  it("dispatches sample review to the agent even when prediction evidence was not prefetched", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createSampleReviewWorkItem();
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
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
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationId: "platform-sample-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);

    expect(result).toEqual({
      runId: "run-affiliate-001",
      runMode: "OPERATOR_REASONING",
    });
    expect(graphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("affiliateExpectedSalesPredictions"),
      expect.anything(),
    );
    expect(graphqlFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("ResolveAffiliateWorkItem"),
      expect.anything(),
    );
    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.message).toContain("[Affiliate Work Item: Sample Application Review]");
    expect(agentCall?.[1]?.message).toContain("Status: NOT_PREFETCHED");
    expect(agentCall?.[1]?.message).toContain("No affiliate prediction cache id was prefilled");
  });

  it("does not ack work items when the gateway reports an agent run error", async () => {
    const workItem = createCreatorReplyWorkItem();
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
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

  it("does not convert model runtime failures into business review failures", async () => {
    const workItem = createCreatorReplyWorkItem();
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);
    expect(result.runId).toBe("run-affiliate-001");
    expect(session.handleAgentEvent({
      runId: "run-affiliate-001",
      stream: "assistant",
      data: { text: "ResourceExhausted: Worker local total request limit reached (24/16)" },
    })).toBe(false);

    mockGetAuthSession.mockClear();
    session.onRunCompleted("run-affiliate-001");

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
              creatorRelationship: {
                id: "relationship-001",
                lastAgentHandledAt: "2026-05-11T00:01:00.000Z",
              },
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
        ...(createCreatorReplyWorkItem().collaboration as GQL.AffiliateCollaborationRecord),
        lastSignalAt: "2026-05-11T00:01:00.000Z",
      },
    });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
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

  it("does not treat a handled collaboration as a handled relationship work boundary", async () => {
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
              creatorRelationship: {
                id: "relationship-001",
                lastAgentHandledAt: null,
              },
              collaboration: {
                id: "collab-001",
                workHandledUntil: "2026-05-11T00:01:00.000Z",
              },
            },
          ],
        };
      }
      if (query.includes("ResolveAffiliateWorkItem")) {
        return {
          resolveAffiliateWorkItem: {
            decision: "FAILED_OR_INCOMPLETE",
            stale: false,
            collaborationRecord: null,
          },
        };
      }
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    const workItem = createCreatorReplyWorkItem({
      versionAt: "2026-05-11T00:01:00.000Z",
      collaboration: {
        ...(createCreatorReplyWorkItem().collaboration as GQL.AffiliateCollaborationRecord),
        lastSignalAt: "2026-05-11T00:01:00.000Z",
      },
    });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
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
        expect.stringContaining("ResolveAffiliateWorkItem"),
        expect.objectContaining({
          input: expect.objectContaining({
            creatorRelationshipId: "relationship-001",
            handledSignalAt: "2026-05-11T00:01:00.000Z",
          }),
        }),
      );
    });
  });

  it("does not dispatch work items that are projection-only", async () => {
    const workItem = createSampleReviewWorkItem({
      agentDispatchRecommended: false,
      workKind: GQL.AffiliateWorkKind.ApprovalReview,
      processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.StaffRequired,
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });
    expect(request).toBeNull();
  });

  it("renders creator follow-up work as a temporal actionable delta", () => {
    const workItem = createCreatorReplyWorkItem({
      workKind: GQL.AffiliateWorkKind.CreatorFollowUp,
      workBundleKind: GQL.AffiliateWorkBundleKind.CreatorFollowUp,
      requiredAction: GQL.AffiliateCollaborationRequiredAction.FollowUpCreator,
      processReasons: [GQL.AffiliateCollaborationRecordProcessReason.CreatorActionFollowUpDue],
      versionAt: "2026-05-13T00:01:00.000Z",
      collaboration: {
        ...(createCreatorReplyWorkItem().collaboration as GQL.AffiliateCollaborationRecord),
        requiredAction: GQL.AffiliateCollaborationRequiredAction.FollowUpCreator,
        processReasons: [GQL.AffiliateCollaborationRecordProcessReason.CreatorActionFollowUpDue],
        lastSignalAt: "2026-05-11T00:01:00.000Z",
        workHandledUntil: "2026-05-11T00:01:00.000Z",
        nextSellerActionAt: "2026-05-13T00:01:00.000Z",
      } as GQL.AffiliateCollaborationRecord,
      recommendedActionTypes: [GQL.ActionProposalType.SendMessage],
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

    expect(request?.message).toContain("[Affiliate Work Item: Creator Follow-Up Due]");
    expect(request?.message).toContain("## Backend Actionable Delta");
    expect(request?.message).toContain("Sources: TEMPORAL");
    expect(request?.message).toContain("Temporal Interpretation");
    expect(request?.message).toContain("Set handledSignalAt to 2026-05-13T00:01:00.000Z");
  });

  it("renders sample content follow-up work as its own temporal actionable delta", () => {
    const workItem = createCreatorReplyWorkItem({
      workKind: GQL.AffiliateWorkKind.ContentFollowUp,
      workBundleKind: GQL.AffiliateWorkBundleKind.ContentFollowUp,
      requiredAction: GQL.AffiliateCollaborationRequiredAction.FollowUpCreator,
      processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SampleContentFollowUpDue],
      versionAt: "2026-05-14T00:01:00.000Z",
      collaboration: {
        ...(createCreatorReplyWorkItem().collaboration as GQL.AffiliateCollaborationRecord),
        requiredAction: GQL.AffiliateCollaborationRequiredAction.FollowUpCreator,
        processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SampleContentFollowUpDue],
        lastSignalAt: "2026-05-11T00:01:00.000Z",
        workHandledUntil: "2026-05-11T00:01:00.000Z",
        nextSellerActionAt: "2026-05-14T00:01:00.000Z",
      } as GQL.AffiliateCollaborationRecord,
      recommendedActionTypes: [GQL.ActionProposalType.SendMessage],
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

    expect(request?.idempotencyKey).toContain("CONTENT_FOLLOW_UP");
    expect(request?.message).toContain("[Affiliate Work Item: Creator Follow-Up Due]");
    expect(request?.message).toContain("Sources: TEMPORAL");
    expect(request?.message).toContain("Set handledSignalAt to 2026-05-14T00:01:00.000Z");
  });

  it("renders combined sample review and reply templates for bundled creator reply work", () => {
    const workItem = createCreatorReplyWorkItem({
      workBundleKind: GQL.AffiliateWorkBundleKind.CreatorReplyWithSampleReview,
      processReasons: [
        GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply,
        GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview,
      ],
      recommendedActionTypes: [
        GQL.ActionProposalType.ReviewSampleApplication,
      ],
      sampleApplicationRecord: createSampleReviewWorkItem().sampleApplicationRecord,
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

    expect(request?.message).toContain("CREATOR_REPLY_WITH_SAMPLE_REVIEW");
    expect(request?.message).toContain("Combined bundle requirement");
    expect(request?.message).toContain("\"type\": \"REVIEW_SAMPLE_APPLICATION\"");
    expect(request?.message).toContain("SEND_MESSAGE required fields");
    expect(request?.message).toContain("- type: SEND_MESSAGE");
    expect(request?.message).toContain("Do not treat expected-sales evidence, threshold evidence, or this field list as a default decision.");
    expect(request?.message).toContain("must handle the sample review and the creator reply in the same REQUEST_ACTION");
  });

  it("frames sample prediction as agent evidence instead of a deterministic decision rule", () => {
    const request = buildAffiliateAgentRunRequest({
      workItem: createSampleReviewWorkItem(),
      platform: "tiktok",
      decisionThresholds: { minExpectedSalesUnits: 1 },
      decisionThresholdSource: "shop default",
    });

    expect(request?.message).toContain(
      "Use affiliate prediction and decision thresholds as non-binding evidence only.",
    );
    expect(request?.message).toContain(
      "they must not automatically determine approve/reject by themselves",
    );
    expect(request?.message).toContain(
      "Do not convert this threshold into a deterministic approve/reject rule.",
    );
    expect(request?.message).toContain(
      "the decision still comes from your full-context judgment",
    );
  });
});
