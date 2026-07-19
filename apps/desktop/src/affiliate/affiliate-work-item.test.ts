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
import {
  __clearActiveAffiliateRunCheckpointsForTests,
  getActiveAffiliateRunCheckpoint,
} from "./affiliate-run-checkpoints.js";
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
    relationshipOperationalConfigRevision: 1,
    businessDeveloperIdSnapshot: null,
    businessDeveloperConfigRevision: null,
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
      aiEngagementStatus: GQL.AffiliateRelationshipAiEngagementStatus.Enabled,
      aiEngagementSource: GQL.AffiliateRelationshipAiEngagementSource.Staff,
      operationalConfigRevision: 1,
      shopStates: [],
      lastInboundAt: null,
      lastOutboundAt: null,
      lastAgentHandledAt: null,
      lastBlockedAt: null,
      lastPlatformSyncedAt: null,
      stateUpdatedAt: "2026-05-11T00:01:00.000Z",
      activeCollaborationRecordIds: ["collab-001"],
      pendingActionProposalId: null,
      agendaItems: [{
        key: "collaboration:collab-001:COMPLETE_COLLABORATION_TASK",
        owner: GQL.AffiliateRelationshipAgendaOwner.Agent,
        sourceType: GQL.AffiliateRelationshipAgendaSourceType.Collaboration,
        status: GQL.AffiliateRelationshipAgendaItemStatus.Open,
        workKind: GQL.AffiliateWorkKind.SampleApplicationDecision,
        requiredAction: GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask,
        shopId: "shop-001",
        collaborationRecordId: "collab-001",
        sampleApplicationRecordId: "sample-record-001",
        proposalId: null,
        reasons: [GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview],
        nextActionAt: null,
        boundaryEventCursor: 1,
        updatedAt: "2026-05-11T00:01:00.000Z",
      }],
      workSummary: {
        agentRequiredCount: 1,
        staffRequiredCount: 0,
        externalWaitingCount: 0,
        activeCollaborationCount: 1,
        nextActionAt: null,
      },
      committedCheckpointId: null,
      committedEventCursor: 0,
      lifecycleEventSequence: 1,
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
      sampleApplicationLookup: {
        status: GQL.AffiliateSampleApplicationLookupStatus.Found,
        queriedAt: "2026-05-11T00:01:00.000Z",
        providerFreshnessKnown: false,
        shopId: "shop-001",
        productIds: ["product-001"],
      },
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
      sampleApplicationLookup: {
        status: GQL.AffiliateSampleApplicationLookupStatus.NotFoundInWorkspace,
        queriedAt: "2026-05-11T00:01:00.000Z",
        providerFreshnessKnown: false,
        shopId: "shop-001",
        productIds: ["product-001"],
      },
      recommendedActionTypes: [
        GQL.ActionProposalType.SendMessage,
      ],
    },
    ...overrides,
  } as GQL.AffiliateWorkItem;
}

function withCheckpointContext(
  graphqlFetch: (query: string, variables?: unknown) => unknown | Promise<unknown>,
  options: {
    preflightItems?: GQL.AffiliateCreatorMessageHistoryItem[];
  } = {},
): (query: string, variables?: unknown) => Promise<unknown> {
  return async (query, variables) => {
    if (query.includes("affiliateContextBuilder")) {
      return {
        affiliateContextBuilder: {
          creatorRelationship: createSampleReviewWorkItem().creatorRelationship,
          businessDeveloper: {
            id: "bd-001",
            userId: "user-001",
            displayName: "Maria",
            regions: [GQL.ShopRegion.Us],
            acceptingCreators: true,
            agentAssistanceMode: GQL.AffiliateAgentAssistanceMode.AiAssisted,
            businessPrompt: "Keep creator outreach concise and warm.",
            configRevision: 3,
            createdAt: "2026-05-11T00:00:00.000Z",
            updatedAt: "2026-05-11T00:00:00.000Z",
          },
          baseCheckpointId: null,
          baseEventCursor: 0,
          targetEventCursor: 1,
          relationshipOperationalConfigRevision: 2,
          businessDeveloperIdSnapshot: "bd-001",
          businessDeveloperConfigRevision: 3,
          baseMatchesCommitted: true,
          truncated: false,
          events: [],
          workspace: {
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
        },
        affiliateCreatorContactState: {
          creatorRelationship: createSampleReviewWorkItem().creatorRelationship,
          preferredChannel: GQL.AffiliateMessageChannel.Whatsapp,
          hasUsableWhatsAppContact: true,
          hasUsableEmailContact: true,
          defaultOutboundChannel: GQL.AffiliateMessageChannel.Whatsapp,
          preferredWhatsAppAccount: {
            id: "wa-bd-001",
            businessDeveloperId: "bd-001",
            displayName: "Maria WhatsApp",
            phoneNumber: "+1 555 0100",
            status: GQL.WhatsAppAccountStatus.Connected,
          },
          preferredEmailAccount: {
            id: "email-bd-001",
            businessDeveloperId: "bd-001",
            displayName: "Maria",
            emailAddress: "maria@example.com",
            sharedMailboxAddress: null,
            mailboxType: GQL.EmailMailboxType.Personal,
            status: GQL.EmailAccountStatus.Connected,
          },
          channelContacts: [],
          whatsAppAccounts: [
            {
              id: "wa-bd-001",
              businessDeveloperId: "bd-001",
              displayName: "Maria WhatsApp",
              phoneNumber: "+1 555 0100",
              status: GQL.WhatsAppAccountStatus.Connected,
            },
            {
              id: "wa-other-bd",
              businessDeveloperId: "bd-002",
              displayName: "Other BD WhatsApp",
              phoneNumber: "+1 555 9999",
              status: GQL.WhatsAppAccountStatus.Connected,
            },
          ],
          emailAccounts: [
            {
              id: "email-bd-001",
              businessDeveloperId: "bd-001",
              displayName: "Maria",
              emailAddress: "maria@example.com",
              sharedMailboxAddress: null,
              mailboxType: GQL.EmailMailboxType.Personal,
              status: GQL.EmailAccountStatus.Connected,
            },
          ],
        },
      };
    }
    if (query.includes("AffiliateCreatorMessagePreflight")) {
      expect(variables).toMatchObject({
        input: {
          limit: 20,
        },
      });
      return {
        affiliateCreatorMessageHistory: {
          items: options.preflightItems ?? [{
            channel: GQL.AffiliateMessageChannel.Whatsapp,
            direction: GQL.AffiliateCreatorMessageDirection.Creator,
            messageRef: "message-ref-001",
            parts: [{ kind: GQL.AffiliateHistoryPartKind.Text }],
            messageType: "TEXT",
            deliveryStatus: null,
            createdAt: "2026-05-11T00:01:00.000Z",
            subject: null,
            channelLabel: "WhatsApp",
            shopId: "shop-001",
            shopName: "Affiliate Test Shop",
            accountLabel: "Maria WhatsApp",
            source: "WHATSAPP",
          }],
        },
      };
    }
    return graphqlFetch(query, variables);
  };
}

function createPreflightMessage(
  parts: GQL.AffiliateHistoryPart[],
): GQL.AffiliateCreatorMessageHistoryItem {
  return {
    channel: GQL.AffiliateMessageChannel.Whatsapp,
    direction: GQL.AffiliateCreatorMessageDirection.Creator,
    messageRef: "message-ref-preflight",
    parts,
    messageType: "ATTACHMENT",
    deliveryStatus: null,
    createdAt: "2026-05-11T00:01:00.000Z",
    subject: null,
    channelLabel: "WhatsApp",
    shopId: "shop-001",
    shopName: "Affiliate Test Shop",
    accountLabel: "Maria WhatsApp",
    source: "WHATSAPP",
  };
}

describe("affiliate work item dispatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __clearActiveAffiliateRunCheckpointsForTests();
    mockGetAuthSession.mockReturnValue({
      graphqlFetch: vi.fn(withCheckpointContext(async (query: string) => {
        if (query.includes("affiliateWorkItems")) return { affiliateWorkItems: [] };
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
        throw new Error(`Unexpected GraphQL call: ${query}`);
      })),
    });
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

  it("does not redispatch the same work item version after a successful agent run", async () => {
    const inbound = new AffiliateInbound("en");
    inbound.syncFromShops([{
      id: "shop-001",
      userId: "user-001",
      platform: "tiktok",
      platformShopId: "platform-shop-001",
      shopName: "Affiliate Test Shop",
    }]);
    const session = {
      scopeKey: "affiliate-session-001",
      handleWorkItem: vi.fn(async () => ({ runId: "run-affiliate-queue-001" })),
      onRunCompleted: vi.fn(),
    };
    vi.spyOn(inbound as any, "getOrCreateSession").mockReturnValue(session);
    const workItem = createSampleReviewWorkItem();

    await inbound.handleWorkItem(workItem);
    inbound.handleGatewayEvent({
      payload: { runId: "run-affiliate-queue-001", state: "final" },
    } as any);
    await inbound.handleWorkItem(workItem);

    expect(session.handleWorkItem).toHaveBeenCalledTimes(1);
  });

  it("allows the same work item version to retry after a gateway error", async () => {
    const inbound = new AffiliateInbound("en");
    inbound.syncFromShops([{
      id: "shop-001",
      userId: "user-001",
      platform: "tiktok",
      platformShopId: "platform-shop-001",
      shopName: "Affiliate Test Shop",
    }]);
    const session = {
      scopeKey: "affiliate-session-001",
      handleWorkItem: vi.fn(async () => ({ runId: "run-affiliate-queue-001" })),
      onRunCompleted: vi.fn(),
    };
    vi.spyOn(inbound as any, "getOrCreateSession").mockReturnValue(session);
    const workItem = createSampleReviewWorkItem();

    await inbound.handleWorkItem(workItem);
    inbound.handleGatewayEvent({
      payload: { runId: "run-affiliate-queue-001", state: "error" },
    } as any);
    await inbound.handleWorkItem(workItem);

    expect(session.handleWorkItem).toHaveBeenCalledTimes(2);
  });

  it("drains the next queued work item after active affiliate capacity is released", async () => {
    const inbound = new AffiliateInbound("en");
    inbound.syncFromShops([{
      id: "shop-001",
      userId: "user-001",
      platform: "tiktok",
      platformShopId: "platform-shop-001",
      shopName: "Affiliate Test Shop",
    }]);
    const workItem = createSampleReviewWorkItem({ id: "relationship-queued" });
    mockGetAuthSession.mockReturnValue({
      graphqlFetch: vi.fn(async () => ({ affiliateWorkItems: [workItem] })),
    });
    (inbound as any).runIndex.set("run-active", "affiliate-session-active");
    (inbound as any).sessions.set("affiliate-session-active", { onRunCompleted: vi.fn() });
    const dispatchSpy = vi.spyOn(inbound as any, "dispatchWorkItem").mockResolvedValue(true);

    await inbound.handleWorkItem(workItem);
    expect(dispatchSpy).not.toHaveBeenCalled();

    inbound.handleGatewayEvent({ payload: { runId: "run-active", state: "final" } } as any);
    await waitForCondition(() => dispatchSpy.mock.calls.length === 1);

    expect(dispatchSpy).toHaveBeenCalledWith(
      workItem,
      "relationship-queued:SAMPLE_APPLICATION_DECISION",
      workItem.versionAt,
    );
  });

  it("drops queued work that became non-actionable before capacity was released", async () => {
    const inbound = new AffiliateInbound("en");
    inbound.syncFromShops([{
      id: "shop-001",
      userId: "user-001",
      platform: "tiktok",
      platformShopId: "platform-shop-001",
      shopName: "Affiliate Test Shop",
    }]);
    const queuedWorkItem = createSampleReviewWorkItem({ id: "relationship-protected" });
    const protectedWorkItem = createSampleReviewWorkItem({
      id: "relationship-protected",
      agentDispatchRecommended: false,
      staffReviewRequired: true,
      creatorRelationship: {
        ...createSampleReviewWorkItem().creatorRelationship,
        aiEngagementStatus: GQL.AffiliateRelationshipAiEngagementStatus.Protected,
      },
    });
    mockGetAuthSession.mockReturnValue({
      graphqlFetch: vi.fn(async () => ({ affiliateWorkItems: [protectedWorkItem] })),
    });
    (inbound as any).runIndex.set("run-active", "affiliate-session-active");
    (inbound as any).sessions.set("affiliate-session-active", { onRunCompleted: vi.fn() });
    const dispatchSpy = vi.spyOn(inbound as any, "dispatchWorkItem").mockResolvedValue(true);

    await inbound.handleWorkItem(queuedWorkItem);
    inbound.handleGatewayEvent({ payload: { runId: "run-active", state: "final" } } as any);
    await waitForCondition(() => (inbound as any).pendingWorkItems.size === 0);

    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("keeps queued work without busy-looping when authoritative refresh fails", async () => {
    const inbound = new AffiliateInbound("en");
    inbound.syncFromShops([{
      id: "shop-001",
      userId: "user-001",
      platform: "tiktok",
      platformShopId: "platform-shop-001",
      shopName: "Affiliate Test Shop",
    }]);
    const workItem = createSampleReviewWorkItem({ id: "relationship-refresh-failure" });
    const graphqlFetch = vi.fn(async () => {
      throw new Error("temporary backend failure");
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    (inbound as any).runIndex.set("run-active", "affiliate-session-active");
    (inbound as any).sessions.set("affiliate-session-active", { onRunCompleted: vi.fn() });
    const dispatchSpy = vi.spyOn(inbound as any, "dispatchWorkItem").mockResolvedValue(true);

    await inbound.handleWorkItem(workItem);
    inbound.handleGatewayEvent({ payload: { runId: "run-active", state: "final" } } as any);
    await waitForCondition(() => graphqlFetch.mock.calls.length === 1);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(graphqlFetch).toHaveBeenCalledTimes(1);
    expect((inbound as any).pendingWorkItems.size).toBe(1);
    expect(dispatchSpy).not.toHaveBeenCalled();
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
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
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
    expect(agentCall?.[1]).toMatchObject({
      provider: "openai",
      model: "gpt-5-test",
    });
    expect(agentCall?.[1]?.message).toContain("[Affiliate Work Item: Sample Application Review]");
    expect(agentCall?.[1]?.message).toContain("available when prediction evidence is useful");
    expect(agentCall?.[1]?.message).toContain(
      "Provider/Workspace Sample Application Lookup: status=FOUND queriedAt=2026-05-11T00:01:00.000Z providerFreshnessKnown=false",
    );
    expect(agentCall?.[1]?.message).toContain(
      "Creator-Reported Sample Information: statements in Provider message history are Creator reports",
    );
    expect(agentCall?.[1]?.message).toContain("## Current Authoritative Workspace Snapshot");
    expect(agentCall?.[1]?.message).toContain("Keep creator outreach concise and warm.");
    expect(agentCall?.[1]?.message).toContain("## Assigned BD Outreach Routing");
    expect(agentCall?.[1]?.message).toContain("Maria WhatsApp");
    expect(agentCall?.[1]?.message).toContain("phone=+1 555 0100");
    expect(agentCall?.[1]?.message).toContain("address=maria@example.com");
    expect(agentCall?.[1]?.message).not.toContain("Other BD WhatsApp");
    expect(agentCall?.[1]?.message).not.toContain("wa-bd-001");
    expect(mockRpcRequest).toHaveBeenCalledWith("tool_register_session", {
      sessionKey: "agent:main:affiliate:user-001:relationship-001",
      toolContext: {
        kind: "AFFILIATE",
        shopId: "shop-001",
        creatorRelationshipId: "relationship-001",
      },
    });
    expect(mockRpcRequest.mock.calls.some((call) => call[0] === "sessions.patch")).toBe(false);
  });

  it("starts affiliate work runs from a brand-new checkpoint session when no checkpoint is committed", async () => {
    const workItem = createSampleReviewWorkItem();
    let activeCheckpointSeenDuringAgentRequest:
      | ReturnType<typeof getActiveAffiliateRunCheckpoint>
      | undefined;
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "agent") {
        activeCheckpointSeenDuringAgentRequest = getActiveAffiliateRunCheckpoint("relationship-001");
        return { runId: "run-affiliate-001" };
      }
      return { runId: "run-affiliate-001" };
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

    const result = await session.handleWorkItem(workItem);

    expect(result.runId).toBe("run-affiliate-001");
    expect(activeCheckpointSeenDuringAgentRequest).toEqual(expect.objectContaining({
      creatorRelationshipId: "relationship-001",
      sessionKey: "agent:main:affiliate:user-001:relationship-001",
      runId: expect.any(String),
      baseCheckpointId: null,
      candidateCheckpointId: expect.any(String),
    }));
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
        baseEventCursor: 0,
        candidateCheckpointId: expect.any(String),
        targetEventCursor: 1,
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

  it.each([
    {
      name: "the checkpoint and event cursor base is stale",
      baseMatchesCommitted: false,
      truncated: false,
    },
    {
      name: "the event delta is truncated",
      baseMatchesCommitted: true,
      truncated: true,
    },
  ])("does not dispatch affiliate work when $name", async ({ baseMatchesCommitted, truncated }) => {
    const workItem = createSampleReviewWorkItem();
    mockGetAuthSession.mockReturnValue({
      graphqlFetch: vi.fn(async () => ({
        affiliateContextBuilder: {
          creatorRelationship: workItem.creatorRelationship,
          baseCheckpointId: null,
          baseEventCursor: 0,
          targetEventCursor: 1,
          baseMatchesCommitted,
          truncated,
          events: [],
          workspace: null,
        },
      })),
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
      },
    );

    await expect(session.handleWorkItem(workItem)).resolves.toEqual({ runId: undefined });
    expect(mockRpcRequest.mock.calls.some((call) => call[0] === "agent")).toBe(false);
  });

  it("only catches up work items the backend recommends for Agent dispatch", async () => {
    const graphqlFetch = vi.fn(async (_query: string, variables: any) => {
      if (variables?.input?.agentDispatchRecommended === true) {
        return { affiliateWorkItems: [] };
      }
      throw new Error(`Unexpected GraphQL variables: ${JSON.stringify(variables)}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
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
    expect(graphqlFetch).toHaveBeenCalledTimes(1);
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

  it("dispatches creator replies as internal work with a structured SEND_MESSAGE contract", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
    const workItem = createCreatorReplyWorkItem({
      triggerChannel: GQL.AffiliateMessageChannel.Whatsapp,
      triggerLifecycleEventId: "lifecycle-message-001",
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
      },
    );

    const result = await session.handleWorkItem(workItem);
    expect(result.runMode).toBe("OPERATOR_REASONING");
    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("OPERATOR_REASONING");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("## Affiliate Business Context");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("Commerce Program: TikTok Shop Affiliate");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("TikTok shoppable video, TikTok LIVE");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("Communication Transports: TikTok Shop platform chat, WhatsApp, and Outlook email");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("affiliate_resolve_work_item");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("Omit preferredChannel to reply on the trigger channel");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("final assistant response exactly NO_REPLY");
    expect(agentCall?.[1]?.message).toContain("Current Trigger Channel: WHATSAPP");
    expect(agentCall?.[1]?.message).toContain("Current Signal ID: lifecycle-message-001");

    expect(session.handleAgentEvent({
      runId: result.runId,
      stream: "assistant",
      data: { text: "This text must remain internal and must not be forwarded." },
    })).toBe(false);
    expect(graphqlFetch.mock.calls.some(([query]) => String(query).includes("DeliverAffiliateCreatorText"))).toBe(false);
  });

  it("routes unreadable creator attachments to staff before creating an Agent run", async () => {
    const graphqlFetch = vi.fn(async (query: string, variables?: any) => {
      if (query.includes("ResolveAffiliateWorkItem")) {
        expect(variables?.input).toMatchObject({
          creatorRelationshipId: "relationship-001",
          decision: "NEEDS_STAFF_REVIEW",
        });
        expect(variables?.input?.operatorSummary).toContain("creator-video.mp4");
        return {
          resolveAffiliateWorkItem: {
            decision: "NEEDS_STAFF_REVIEW",
            stale: false,
          },
        };
      }
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({
      graphqlFetch: withCheckpointContext(graphqlFetch, {
        preflightItems: [createPreflightMessage([{
          kind: GQL.AffiliateHistoryPartKind.Attachment,
          fileName: "creator-video.mp4",
          mimeType: "video/mp4",
          sizeBytes: 1024,
          agentReadable: false,
        }])],
      }),
    });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "message-video-001",
      },
    );

    await expect(session.handleWorkItem(createCreatorReplyWorkItem())).resolves.toEqual({ runId: undefined });
    expect(mockRpcRequest.mock.calls.some((call) => call[0] === "agent")).toBe(false);
    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("ResolveAffiliateWorkItem"),
      expect.anything(),
    );
  });

  it("allows PDF creator attachments through the pre-run attachment gate", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({
      graphqlFetch: withCheckpointContext(graphqlFetch, {
        preflightItems: [createPreflightMessage([{
          kind: GQL.AffiliateHistoryPartKind.Attachment,
          fileName: "creator-brief.pdf",
          mimeType: "application/pdf",
          sizeBytes: 2048,
          agentReadable: true,
        }])],
      }),
    });
    const session = new AffiliateSession(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        platform: "tiktok",
      },
      {
        shopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "message-pdf-001",
      },
    );

    await expect(session.handleWorkItem(createCreatorReplyWorkItem())).resolves.toMatchObject({
      runId: "run-affiliate-001",
    });
    expect(mockRpcRequest.mock.calls.some((call) => call[0] === "agent")).toBe(true);
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
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
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
    expect(agentCall?.[1]?.message).toContain("available as optional evidence");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("ecom_get_product resolves product details");
    expect(agentCall?.[1]?.message).not.toContain("call ecom_get_product");
    expect(agentCall?.[1]?.message).not.toContain("Do not ask the creator which product they mean");
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
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
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
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
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
    expect(agentCall?.[1]?.message).toContain("already has a persisted prediction snapshot");
  });

  it("dispatches sample review to the agent without prefetching prediction evidence", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
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
    expect(agentCall?.[1]?.message).toContain("available when prediction evidence is useful");
    expect(agentCall?.[1]?.message).toContain("identifies the exact evidence snapshot");
    expect(agentCall?.[1]?.message).not.toContain("before submitting a REVIEW_SAMPLE_APPLICATION action");
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
    expect(request?.message).toContain("available when prediction evidence is useful");
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

  it("projects the available creator commerce profile into the Agent work context", () => {
    const base = createCreatorReplyWorkItem();
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({
        context: {
          ...base.context,
          creatorProfile: {
            id: "creator-001",
            platform: GQL.ShopPlatform.TiktokShop,
            creatorOpenId: "creator-open-001",
            creatorImId: "creator-im-001",
            username: "creator_handle",
            nickname: "Creator Name",
            avatarUrl: null,
            followerCount: 3454,
            categoryIds: ["category-1", "category-2"],
            marketplaceSnapshotJson: JSON.stringify({
              gmv: { currency: "USD", amount: 1214.34 },
              ecVideoCount: 17,
              avgEcVideoViewCount: 336,
            }),
            aggregatedSignalsSnapshotJson: JSON.stringify({
              creator_gmv_30d: 1214.34,
              creator_content_count_30d: 17,
            }),
            createdAt: "2026-05-01T00:00:00.000Z",
            updatedAt: "2026-05-02T00:00:00.000Z",
          },
        },
      }),
      platform: "tiktok",
    });

    expect(request?.message).toContain("Display Name: Creator Name");
    expect(request?.message).toContain("TikTok Creator Open ID: creator-open-001");
    expect(request?.message).toContain(
      "Identity Note: these fields identify the CreatorRelationship participant; they do not classify the intent of the current message.",
    );
    expect(request?.message).toContain("Follower Count: 3454");
    expect(request?.message).toContain("Creator Category IDs: category-1, category-2");
    expect(request?.message).toContain('"ecVideoCount":17');
    expect(request?.message).toContain('"creator_gmv_30d":1214.34');
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
    expect(request?.message).not.toContain("Ambiguity Instruction");
    expect(request?.message).not.toContain("This collaboration is context under the CreatorRelationship");
  });

  it("dispatches sample review to the agent even when prediction evidence was not prefetched", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
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
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
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
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
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

  it("does not submit fallback failure after a structured resolution removes the work item", async () => {
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
        return { affiliateWorkItems: [] };
      }
      if (query.includes("ResolveAffiliateWorkItem")) {
        throw new Error("Fallback resolution must not run after the work item is gone");
      }
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
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
        creatorId: "creator-001",
      },
    );

    await session.handleWorkItem(createCreatorReplyWorkItem());
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

  it("presents merchant prediction thresholds as context without prescribing a decision", () => {
    const request = buildAffiliateAgentRunRequest({
      workItem: createSampleReviewWorkItem(),
      platform: "tiktok",
      decisionThresholds: { minExpectedSalesUnits: 1 },
      decisionThresholdSource: "shop default",
    });

    expect(request?.message).toContain("- Source: shop default");
    expect(request?.message).toContain("- minExpectedSalesUnits: 1");
    expect(request?.message).toContain(
      "merchant-configured decision context, not an automatic approve/reject rule",
    );
    expect(request?.message).not.toContain("If expectedSalesUnits is below");
    expect(request?.message).not.toContain("If expectedSalesUnits meets or exceeds");
  });
});
