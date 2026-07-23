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

vi.mock("./affiliate-workflow-skill.js", () => ({
  buildAffiliateWorkflowSkillCatalog: vi
    .fn()
    .mockResolvedValue(
      [
        "## Skills",
        "<available_skills>",
        "<skill>",
        "<name>affiliate-workflow</name>",
        "<version>1.0.0</version>",
        "<location>/test/workspace-affiliate/skills/affiliate-workflow/SKILL.md</location>",
        "</skill>",
        "</available_skills>",
      ].join("\n"),
    ),
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
    ).toBe("agent:affiliate:affiliate:user-1:rel-1");
    expect(
      AffiliateSession.buildScopeKey("whatsapp", {
        userId: "user-1",
        shopId: "shop-1",
        platformShopId: "platform-shop-1",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "wa-message-1",
        creatorRelationshipId: "rel-1",
      }),
    ).toBe("agent:affiliate:affiliate:user-1:rel-1");
  });

  it("accepts a later trigger from another seller shop in the same Relationship session", () => {
    const session = new AffiliateSession(
      {
        objectId: "shop-1",
        userId: "user-1",
        platformShopId: "platform-shop-1",
        shopName: "Shop 1",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      {
        userId: "user-1",
        shopId: "shop-1",
        platformShopId: "platform-shop-1",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "message-1",
        creatorRelationshipId: "rel-1",
      },
    );
    (session as any).activeRunId = "run-in-progress";

    expect(() => {
      session.updateShopContext({
        objectId: "shop-2",
        userId: "user-1",
        platformShopId: "platform-shop-2",
        shopName: "Shop 2",
        platform: "tiktok",
        runProfileId: "AFFILIATE_OPERATOR",
      });
      session.updateAffiliateContext({
        userId: "user-1",
        shopId: "shop-2",
        platformShopId: "platform-shop-2",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-2",
        creatorRelationshipId: "rel-1",
      });
    }).not.toThrow();

    expect(session.scopeKey).toBe("agent:affiliate:affiliate:user-1:rel-1");
    expect(session.affiliateContext).toMatchObject({
      shopId: "shop-2",
      platformShopId: "platform-shop-2",
      creatorRelationshipId: "rel-1",
    });
    expect((session as any).shop.objectId).toBe("shop-2");
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

  it("derives trusted Creator identity constants from the dispatched work item profile", () => {
    const inbound = new AffiliateInbound("en");
    const base = createSampleReviewWorkItem();
    const workItem = createSampleReviewWorkItem({
      context: {
        ...base.context,
        creatorProfile: {
          id: "creator-canonical-001",
          platform: GQL.ShopPlatform.TiktokShop,
          creatorOpenId: "creator-open-001",
          creatorImId: "creator-im-profile-001",
          username: "creator_handle",
        } as GQL.AffiliateCreatorIdentity,
      },
    });

    const context = (inbound as any).buildContextFromWorkItem(
      {
        objectId: "shop-001",
        userId: "user-001",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
      },
      workItem,
    );

    expect(context).toMatchObject({
      shopId: "shop-001",
      creatorRelationshipId: "relationship-001",
      creatorId: "creator-canonical-001",
      creatorOpenId: "creator-open-001",
      creatorUsername: "creator_handle",
      creatorImUserId: "creator-im-profile-001",
    });
  });

  it("refuses to route a work item through a shop other than its trigger shop", () => {
    const inbound = new AffiliateInbound("en");
    inbound.syncFromShops([
      {
        id: "shop-001",
        userId: "user-001",
        platform: "tiktok",
        platformShopId: "platform-shop-001",
        shopName: "Wrong Shop",
      },
    ]);
    const workItem = createSampleReviewWorkItem({
      triggerShopId: "shop-002",
      triggerPlatformShopId: "platform-shop-002",
      routingShopIds: ["shop-001", "shop-002"],
      routingPlatformShopIds: ["platform-shop-001", "platform-shop-002"],
    });
    const wrongShop = {
      objectId: "shop-001",
      userId: "user-001",
      platformShopId: "platform-shop-001",
      shopName: "Wrong Shop",
    };

    expect((inbound as any).findRoutedShopContext(workItem)).toBeUndefined();
    expect((inbound as any).buildContextFromWorkItem(wrongShop, workItem)).toBeNull();
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

function createSampleReviewWorkItem(
  overrides: Partial<GQL.AffiliateWorkItem> = {},
): GQL.AffiliateWorkItem {
  const collaboration = {
    id: "collab-001",
    userId: "user-001",
    shopId: "shop-001",
    creatorId: "creator-001",
    creatorImId: "creator-im-001",
    productId: "product-001",
    sampleApplicationRecordId: "sample-record-001",
    sampleApplicationRecordIds: ["sample-record-001"],
    platformSampleApplicationStatus: "PENDING",
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
    firstObservedAt: "2026-05-11T00:00:00.000Z",
    lastObservedAt: "2026-05-11T00:01:00.000Z",
    lastSyncSource: GQL.AffiliateProjectionSyncSource.AirflowReconcile,
    projectionRevision: 1,
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
    triggerShopId: "shop-001",
    triggerPlatformShopId: "platform-shop-001",
    routingShopIds: ["shop-001"],
    routingPlatformShopIds: ["platform-shop-001"],
    subjectType: GQL.AffiliateWorkItemSubjectType.CreatorRelationship,
    creatorRelationshipId: "relationship-001",
    collaborationRecordId: "collab-001",
    workKind: GQL.AffiliateWorkKind.SampleApplicationDecision,
    workBundleKind: GQL.AffiliateWorkBundleKind.SampleReviewOnly,
    agentWorkingAgendaItems: [],
    agentDispatchRecommended: true,
    creatorProtected: false,
    agentEligibilityReason: GQL.AffiliateAgentEligibilityReason.Eligible,
    staffReviewRequired: false,
    relationshipOperationalConfigRevision: 1,
    businessDeveloperIdSnapshot: null,
    businessDeveloperConfigRevision: null,
    processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
    requiredAction: GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask,
    processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview],
    recommendedActionTypes: [GQL.ActionProposalType.ReviewSampleApplication],
    versionAt: "2026-05-11T00:01:00.000Z",
    collaboration,
    creatorRelationship: {
      id: "relationship-001",
      userId: "user-001",
      creatorId: "creator-001",
      operationalConfigRevision: 1,
      shopStates: [],
      lastInboundAt: null,
      lastOutboundAt: null,
      lastAgentHandledAt: null,
      lastBlockedAt: null,
      lastPlatformSyncedAt: null,
      stateUpdatedAt: "2026-05-11T00:01:00.000Z",
      activeCollaborationRecordIds: ["collab-001"],
      agendaItems: [
        {
          key: "collaboration:collab-001:COMPLETE_COLLABORATION_TASK",
          owner: GQL.AffiliateRelationshipAgendaOwner.Agent,
          sourceType: GQL.AffiliateRelationshipAgendaSourceType.Collaboration,
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
        },
      ],
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
    context: {
      activeCollaborations: [collaboration],
      affiliateCollaboration: null,
      ambiguousCollaborationCandidates: [],
      creatorProfile: null,
      creatorRelation: null,
      focusCollaboration: collaboration,
      missingContext: [],
      primarySampleApplication: sampleApplicationRecord,
      productContext: null,
      recommendedActionTypes: [GQL.ActionProposalType.ReviewSampleApplication],
      relatedSampleApplications: [sampleApplicationRecord],
      sampleApplicationLookup: {
        status: GQL.AffiliateSampleApplicationLookupStatus.ConfirmedPresent,
        queriedAt: "2026-05-11T00:01:00.000Z",
        shopId: "shop-001",
        productIds: ["product-001"],
      },
    },
    ...overrides,
  };
}

function createCreatorReplyWorkItem(
  overrides: Partial<GQL.AffiliateWorkItem> = {},
): GQL.AffiliateWorkItem {
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
    recommendedActionTypes: [GQL.ActionProposalType.SendMessage],
    collaboration,
    creatorRelationship: {
      ...base.creatorRelationship,
      processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.ReplyToCreator,
      processReasons: [GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply],
      agendaItems: [
        {
          key: "relationship:relationship-001:REPLY_TO_CREATOR",
          owner: GQL.AffiliateRelationshipAgendaOwner.Agent,
          sourceType: GQL.AffiliateRelationshipAgendaSourceType.Relationship,
          workKind: GQL.AffiliateWorkKind.InboundMessageTriage,
          requiredAction: GQL.AffiliateRelationshipRequiredAction.ReplyToCreator,
          shopId: "shop-001",
          collaborationRecordId: null,
          sampleApplicationRecordId: null,
          proposalId: null,
          reasons: [GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply],
          nextActionAt: null,
          boundaryEventCursor: 1,
          updatedAt: "2026-05-11T00:01:00.000Z",
        },
      ],
    },
    sampleApplicationRecord: null,
    context: {
      ...base.context,
      activeCollaborations: [collaboration],
      focusCollaboration: collaboration,
      primarySampleApplication: null,
      relatedSampleApplications: [],
      sampleApplicationLookup: {
        status: GQL.AffiliateSampleApplicationLookupStatus.Unverified,
        queriedAt: "2026-05-11T00:01:00.000Z",
        shopId: "shop-001",
        productIds: ["product-001"],
      },
      recommendedActionTypes: [GQL.ActionProposalType.SendMessage],
    },
    ...overrides,
  } as GQL.AffiliateWorkItem;
}

function withCheckpointContext(
  graphqlFetch: (query: string, variables?: unknown) => unknown | Promise<unknown>,
  options: {
    preflightItems?: GQL.AffiliateCreatorMessageHistoryItem[];
    creatorProfiles?: GQL.AffiliateCreatorIdentity[];
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
            creatorProfiles: options.creatorProfiles ?? [],
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
          items: options.preflightItems ?? [
            {
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
            },
          ],
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
    vi.unstubAllEnvs();
    __clearActiveAffiliateRunCheckpointsForTests();
    mockGetAuthSession.mockReturnValue({
      graphqlFetch: vi.fn(
        withCheckpointContext(async (query: string) => {
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
        }),
      ),
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
      getRpcClient: () => ({ request: (...args: unknown[]) => mockRpcRequest(...args) }) as any,
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
    inbound.syncFromShops([
      {
        id: "shop-001",
        userId: "user-001",
        platform: "tiktok",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
      },
    ]);
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
    inbound.syncFromShops([
      {
        id: "shop-001",
        userId: "user-001",
        platform: "tiktok",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
      },
    ]);
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
    inbound.syncFromShops([
      {
        id: "shop-001",
        userId: "user-001",
        platform: "tiktok",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
      },
    ]);
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
      "relationship-queued:shop-001:SAMPLE_APPLICATION_DECISION",
      workItem.versionAt,
    );
  });

  it("drops queued work that became non-actionable before capacity was released", async () => {
    const inbound = new AffiliateInbound("en");
    inbound.syncFromShops([
      {
        id: "shop-001",
        userId: "user-001",
        platform: "tiktok",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
      },
    ]);
    const queuedWorkItem = createSampleReviewWorkItem({ id: "relationship-protected" });
    const protectedWorkItem = createSampleReviewWorkItem({
      id: "relationship-protected",
      agentDispatchRecommended: false,
      creatorProtected: true,
      agentEligibilityReason: GQL.AffiliateAgentEligibilityReason.CreatorProtected,
      staffReviewRequired: false,
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
    inbound.syncFromShops([
      {
        id: "shop-001",
        userId: "user-001",
        platform: "tiktok",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
      },
    ]);
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

  it("fetches only checkpoint metadata before a work-item dispatch", async () => {
    const graphqlFetch = vi.fn(
      withCheckpointContext(async (query: string) => {
        throw new Error(`Unexpected GraphQL call: ${query}`);
      }),
    );
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
        sampleApplicationRecordId: "sample-record-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    await session.handleWorkItem(createSampleReviewWorkItem());

    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("affiliateContextBuilder"),
      expect.objectContaining({
        input: expect.objectContaining({
          shopId: "shop-001",
          creatorRelationshipId: "relationship-001",
          includeWorkspace: false,
          includeEventDelta: false,
          limit: 1,
        }),
      }),
    );
    expect(
      graphqlFetch.mock.calls.some(([query]) => String(query).includes("affiliateWorkspace")),
    ).toBe(false);
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
        sampleApplicationRecordId: "sample-record-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        creatorOpenId: "creator-open-001",
        creatorUsername: "creator_handle",
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
    expect(agentCall?.[1]?.message).toContain("[Agent Working Agenda]");
    expect(agentCall?.[1]?.message).toContain("Work Kind: SAMPLE_APPLICATION_DECISION");
    expect(agentCall?.[1]?.message).toContain("Reasons: SAMPLE_PENDING_REVIEW");
    expect(agentCall?.[1]?.message).toContain("Sample Application Record ID: sample-record-001");
    expect(agentCall?.[1]?.message).not.toContain("Current Authoritative Workspace Snapshot");
    expect(agentCall?.[1]?.message).not.toContain("Authoritative Sample Application State");
    expect(agentCall?.[1]?.message).not.toContain("prediction");
    expect(agentCall?.[1]?.message).not.toContain("handledSignalAt");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("Keep creator outreach concise and warm.");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "/test/workspace-affiliate/skills/affiliate-workflow/SKILL.md",
    );
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("<name>affiliate-workflow</name>");
    expect(agentCall?.[1]?.extraSystemPrompt).not.toContain(
      "affiliate_list_creator_collaborations",
    );
    expect(agentCall?.[1]?.extraSystemPrompt).not.toContain("affiliate_get_workspace");
    expect(agentCall?.[1]?.extraSystemPrompt).not.toContain(
      "affiliate_get_creator_collaboration_history",
    );
    expect(mockRpcRequest).toHaveBeenCalledWith("tool_register_session", {
      sessionKey: "agent:affiliate:affiliate:user-001:relationship-001",
      toolContext: {
        kind: "AFFILIATE",
        shopId: "shop-001",
        creatorRelationshipId: "relationship-001",
        creatorId: "creator-001",
        creatorOpenId: "creator-open-001",
        creatorUsername: "creator_handle",
      },
    });
    expect(mockRpcRequest.mock.calls.some((call) => call[0] === "sessions.patch")).toBe(false);
  });

  it("does not inject creator commerce snapshots into the working agenda", async () => {
    const creatorProfile = {
      id: "creator-001",
      platform: GQL.ShopPlatform.TiktokShop,
      creatorOpenId: "creator-open-001",
      creatorImId: "creator-im-001",
      username: "creator_handle",
      nickname: "Creator Name",
      avatarUrl: "https://cdn.example.com/private-avatar.jpg",
      followerCount: 3454,
      categoryIds: ["category-1"],
      marketplaceSnapshotJson: JSON.stringify({
        gmv: { currency: "USD", amount: 1214.34 },
        ecVideoCount: 17,
        avatarUri: "https://cdn.example.com/raw-marketplace-avatar.jpg",
        lowValueProviderField: "do-not-inject",
      }),
      aggregatedSignalsSnapshotJson: JSON.stringify({
        creator_gmv_30d: 1214.34,
        internalDebugRecord: "do-not-inject",
      }),
      createdAt: "2026-05-01T00:00:00.000Z",
      updatedAt: "2026-05-02T00:00:00.000Z",
    } as GQL.AffiliateCreatorIdentity;
    mockGetAuthSession.mockReturnValue({
      graphqlFetch: withCheckpointContext(
        async (query: string) => {
          throw new Error(`Unexpected GraphQL call: ${query}`);
        },
        { creatorProfiles: [creatorProfile] },
      ),
    });
    const workItem = createSampleReviewWorkItem();
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
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
      },
    );

    await session.handleWorkItem(workItem);

    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.message).toContain("[Agent Working Agenda]");
    expect(agentCall?.[1]?.message).not.toContain('"marketplaceCommerceSummary"');
    expect(agentCall?.[1]?.message).not.toContain('"ecVideoCount": 17');
    expect(agentCall?.[1]?.message).not.toContain('"creator_gmv_30d": 1214.34');
    expect(agentCall?.[1]?.message).not.toContain("private-avatar.jpg");
    expect(agentCall?.[1]?.message).not.toContain("raw-marketplace-avatar.jpg");
    expect(agentCall?.[1]?.message).not.toContain("lowValueProviderField");
    expect(agentCall?.[1]?.message).not.toContain("internalDebugRecord");
  });

  it("starts affiliate work runs from a brand-new checkpoint session when no checkpoint is committed", async () => {
    const workItem = createSampleReviewWorkItem();
    let activeCheckpointSeenDuringAgentRequest:
      | ReturnType<typeof getActiveAffiliateRunCheckpoint>
      | undefined;
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "agent") {
        activeCheckpointSeenDuringAgentRequest =
          getActiveAffiliateRunCheckpoint("relationship-001");
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
        sampleApplicationRecordId: "sample-record-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);

    expect(result.runId).toBe("run-affiliate-001");
    expect(activeCheckpointSeenDuringAgentRequest).toEqual(
      expect.objectContaining({
        creatorRelationshipId: "relationship-001",
        sessionKey: "agent:affiliate:affiliate:user-001:relationship-001",
        runId: expect.any(String),
        baseCheckpointId: null,
        candidateCheckpointId: expect.any(String),
      }),
    );
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "sessions.create",
      expect.objectContaining({
        key: "agent:affiliate:affiliate:user-001:relationship-001",
      }),
    );
    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.reset", {
      key: "agent:affiliate:affiliate:user-001:relationship-001",
      reason: "new",
    });
    const pluginPatchCall = mockRpcRequest.mock.calls.find(
      (call) => call[0] === "sessions.pluginPatch",
    );
    expect(pluginPatchCall?.[1]).toEqual(
      expect.objectContaining({
        key: "agent:affiliate:affiliate:user-001:relationship-001",
        pluginId: "rivonclaw-capability-manager",
        namespace: "affiliateCheckpoint",
        value: {
          baseCheckpointId: null,
          baseEventCursor: 0,
          candidateCheckpointId: expect.any(String),
          targetEventCursor: 1,
        },
      }),
    );

    session.onRunCompleted("run-affiliate-001");

    await waitForCondition(() =>
      mockRpcRequest.mock.calls.some((call) => call[0] === "sessions.checkpoint.create"),
    );
    const checkpointCall = mockRpcRequest.mock.calls.find(
      (call) => call[0] === "sessions.checkpoint.create",
    );
    expect(checkpointCall?.[1]).toEqual(
      expect.objectContaining({
        key: "agent:affiliate:affiliate:user-001:relationship-001",
        checkpointId: pluginPatchCall?.[1]?.value?.candidateCheckpointId,
      }),
    );
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
        sampleApplicationRecordId: "sample-record-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    await session.handleWorkItem(workItem);

    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.compaction.restore", {
      key: "agent:affiliate:affiliate:user-001:relationship-001",
      checkpointId: "checkpoint-committed-001",
    });
    expect(mockRpcRequest.mock.calls.some((call) => call[0] === "sessions.reset")).toBe(false);
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "sessions.pluginPatch",
      expect.objectContaining({
        value: expect.objectContaining({
          baseCheckpointId: "checkpoint-committed-001",
          candidateCheckpointId: expect.any(String),
        }),
      }),
    );
  });

  it("resets and continues when the committed checkpoint no longer exists locally", async () => {
    const workItem = createSampleReviewWorkItem({
      creatorRelationship: {
        ...(createSampleReviewWorkItem().creatorRelationship as GQL.AffiliateCreatorRelationship),
        committedCheckpointId: "checkpoint-missing-001",
      },
    });
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "sessions.compaction.restore") {
        throw new Error("checkpoint not found: checkpoint-missing-001");
      }
      if (method === "agent") return { runId: "run-after-reset-001" };
      return {};
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
        triggerId: "platform-sample-001",
        sampleApplicationRecordId: "sample-record-001",
        collaborationRecordId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const result = await session.handleWorkItem(workItem);

    expect(result.runId).toBe("run-after-reset-001");
    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.compaction.restore", {
      key: "agent:affiliate:affiliate:user-001:relationship-001",
      checkpointId: "checkpoint-missing-001",
    });
    expect(mockRpcRequest).toHaveBeenCalledWith("sessions.reset", {
      key: "agent:affiliate:affiliate:user-001:relationship-001",
      reason: "new",
    });
    expect(mockRpcRequest).toHaveBeenCalledWith(
      "sessions.pluginPatch",
      expect.objectContaining({
        value: expect.objectContaining({
          baseCheckpointId: "checkpoint-missing-001",
        }),
      }),
    );
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

  it("skips startup catch-up while an exact Affiliate live-test cohort is active", async () => {
    vi.stubEnv(
      "RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS",
      "relationship-001,relationship-002",
    );
    const graphqlFetch = vi.fn(async () => ({ affiliateWorkItems: [] }));
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

    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
  });

  it("ignores subscription work outside an exact Affiliate live-test cohort", async () => {
    vi.stubEnv("RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS", "relationship-allowed");
    const inbound = new AffiliateInbound("en");
    const result = await inbound.handleWorkItem(
      createSampleReviewWorkItem({
        creatorRelationshipId: "relationship-outside-cohort",
      }),
    );

    expect(result).toBe(true);
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
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
      triggerShopId: "shop-001",
      triggerPlatformShopId: "platform-shop-001",
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

  it("uses the agenda sample record as the stable trigger when the top-level snapshot is omitted", () => {
    const workItem = createSampleReviewWorkItem({
      sampleApplicationRecord: null,
      context: {
        ...createSampleReviewWorkItem().context,
        primarySampleApplication: null,
      },
    });
    const inbound = new AffiliateInbound("en");
    const context = (inbound as any).buildContextFromWorkItem(
      {
        objectId: "shop-001",
        userId: "user-001",
        platform: "tiktok",
        platformShopId: "platform-shop-001",
        shopName: "Affiliate Test Shop",
        runProfileId: "AFFILIATE_OPERATOR",
      },
      workItem,
    ) as { triggerId?: string; sampleApplicationRecordId?: string } | null;

    expect(context).toMatchObject({
      triggerId: "sample-record-001",
      sampleApplicationRecordId: "sample-record-001",
    });
    expect(
      buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" })?.idempotencyKey,
    ).toContain("sample-record-001");
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
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "TikTok Shop platform chat, WhatsApp, and Outlook email",
    );
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("affiliate_resolve_work_item");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "/test/workspace-affiliate/skills/affiliate-workflow/SKILL.md",
    );
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "final assistant response exactly NO_REPLY",
    );
    expect(agentCall?.[1]?.message).toContain("[Agent Working Agenda]");
    expect(agentCall?.[1]?.message).toContain("Required Action: REPLY_TO_CREATOR");
    expect(agentCall?.[1]?.message).toContain("Reasons: CREATOR_MESSAGE_NEEDS_REPLY");
    expect(agentCall?.[1]?.message).not.toContain("Current Trigger Channel");
    expect(agentCall?.[1]?.message).not.toContain("lifecycle-message-001");

    expect(
      session.handleAgentEvent({
        runId: result.runId,
        stream: "assistant",
        data: { text: "This text must remain internal and must not be forwarded." },
      }),
    ).toBe(false);
    expect(
      graphqlFetch.mock.calls.some(([query]) =>
        String(query).includes("DeliverAffiliateCreatorText"),
      ),
    ).toBe(false);
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
        preflightItems: [
          createPreflightMessage([
            {
              kind: GQL.AffiliateHistoryPartKind.Attachment,
              fileName: "creator-video.mp4",
              mimeType: "video/mp4",
              sizeBytes: 1024,
              agentReadable: false,
            },
          ]),
        ],
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

    await expect(session.handleWorkItem(createCreatorReplyWorkItem())).resolves.toEqual({
      runId: undefined,
    });
    expect(mockRpcRequest.mock.calls.some((call) => call[0] === "agent")).toBe(false);
    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("ResolveAffiliateWorkItem"),
      expect.anything(),
    );
  });

  it("dispatches a staff-requested proposal revision without re-running inbound attachment preflight", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({
      graphqlFetch: withCheckpointContext(graphqlFetch, {
        preflightItems: [
          createPreflightMessage([
            {
              kind: GQL.AffiliateHistoryPartKind.Attachment,
              fileName: "old-creator-video.mp4",
              mimeType: "video/mp4",
              sizeBytes: 1024,
              agentReadable: false,
            },
          ]),
        ],
      }),
    });
    const base = createCreatorReplyWorkItem();
    const revision = {
      id: "proposal-revision-001",
      type: GQL.ActionProposalType.SendMessage,
      status: GQL.ActionProposalStatus.RevisionRequested,
      operatorSummary: "Original reply proposal",
      decision: {
        note: "Make the reply shorter.",
        decidedAt: "2026-05-11T01:00:00.000Z",
        actorType: "STAFF",
        actorId: "user-001",
      },
      messageIntent: {
        creatorId: "creator-001",
        preferredChannel: null,
        emailSubject: null,
        parts: [
          {
            kind: GQL.AffiliateMessagePartKind.Text,
            text: "Thank you. We will follow up soon.",
          },
        ],
      },
      steps: [],
    } as unknown as GQL.AffiliateRevisionRequestedProposalContext;
    const agenda = {
      ...((base.creatorRelationship?.agendaItems ?? [])[0] as GQL.AffiliateRelationshipAgendaItem),
      proposalId: revision.id,
      revisionRequestedProposal: revision,
    };
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
        triggerId: "message-revision-001",
      },
    );

    await expect(
      session.handleWorkItem(
        createCreatorReplyWorkItem({
          agentWorkingAgendaItems: [agenda],
        }),
      ),
    ).resolves.toMatchObject({ runId: expect.any(String) });
    expect(mockRpcRequest.mock.calls.some((call) => call[0] === "agent")).toBe(true);
    expect(
      graphqlFetch.mock.calls.some(([query]) =>
        String(query).includes("AffiliateCreatorMessagePreflight"),
      ),
    ).toBe(false);
  });

  it("allows PDF creator attachments through the pre-run attachment gate", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({
      graphqlFetch: withCheckpointContext(graphqlFetch, {
        preflightItems: [
          createPreflightMessage([
            {
              kind: GQL.AffiliateHistoryPartKind.Attachment,
              fileName: "creator-brief.pdf",
              mimeType: "application/pdf",
              sizeBytes: 2048,
              agentReadable: true,
            },
          ]),
        ],
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
    expect(
      () =>
        new AffiliateSession(
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
        ),
    ).toThrow("creatorRelationshipId is required");
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
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "assistant output is internal/operator-facing",
    );
    expect(agentCall?.[1]?.message).toContain("[Agent Working Agenda]");
    expect(agentCall?.[1]?.message).not.toContain("Status: NOT_PREFETCHED");
    expect(agentCall?.[1]?.message).not.toContain("Affiliate Prediction");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("<name>affiliate-workflow</name>");
    expect(agentCall?.[1]?.extraSystemPrompt).not.toContain(
      "ecom_get_product resolves a known product",
    );
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

    expect(
      session.handleAgentEvent({
        runId: result.runId,
        stream: "assistant",
        data: { text: "Internal operator summary that must never be sent." },
      }),
    ).toBe(false);
    expect(
      session.handleAgentEvent({
        runId: result.runId,
        stream: "lifecycle",
        data: { phase: "end" },
      }),
    ).toBe(false);
    await Promise.resolve();

    expect(
      graphqlFetch.mock.calls.some(([query]) =>
        String(query).includes("DeliverAffiliateCreatorText"),
      ),
    ).toBe(false);
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
        predictionSnapshots: [
          {
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
          },
        ],
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
        sampleApplicationRecordId: "sample-record-001",
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
    expect(agentCall?.[1]?.message).toContain("[Agent Working Agenda]");
    expect(agentCall?.[1]?.message).not.toContain("prediction-cache-from-snapshot");
    expect(agentCall?.[1]?.message).not.toContain("persisted prediction snapshot");
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
        sampleApplicationRecordId: "sample-record-001",
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
    expect(agentCall?.[1]?.message).toContain("[Agent Working Agenda]");
    expect(agentCall?.[1]?.message).not.toContain("prediction evidence");
    expect(agentCall?.[1]?.message).not.toContain("evidence snapshot");
    expect(agentCall?.[1]?.message).not.toContain(
      "before submitting a REVIEW_SAMPLE_APPLICATION action",
    );
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

    expect(request?.message).toContain("[Agent Working Agenda]");
    expect(request?.message).toContain("Work Kind: SAMPLE_APPLICATION_DECISION");
    expect(request?.message).toContain("Required Action: COMPLETE_COLLABORATION_TASK");
    expect(request?.message).not.toContain("workspace");
  });

  it("does not build a sample review agent run when backend has already handled that work boundary", () => {
    const workItem = createSampleReviewWorkItem({
      agentDispatchRecommended: false,
      staffReviewRequired: false,
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });
    expect(request).toBeNull();
  });

  it("exposes only agenda target references instead of collaboration snapshots", () => {
    const request = buildAffiliateAgentRunRequest({
      workItem: createSampleReviewWorkItem(),
      platform: "tiktok",
    });

    expect(request?.message).toContain("[Agent Working Agenda]");
    expect(request?.message).toContain("Creator Relationship ID: relationship-001");
    expect(request?.message).toContain("Collaboration Record ID: collab-001");
    expect(request?.message).not.toContain("Lifecycle Stage");
    expect(request?.message).not.toContain("Backend Work Context");
  });

  it("renders a revision-requested proposal only from the dispatching working agenda", () => {
    const base = createCreatorReplyWorkItem();
    const revision = {
      id: "proposal-revision-001",
      type: GQL.ActionProposalType.SendMessage,
      status: GQL.ActionProposalStatus.RevisionRequested,
      operatorSummary: "Reply with the original formal wording",
      decision: {
        note: "Make the reply warmer and mention the creator's prior video.",
        decidedAt: "2026-05-11T01:00:00.000Z",
        actorType: "STAFF",
        actorId: "user-001",
      },
      messageIntent: {
        creatorId: "creator-001",
        preferredChannel: null,
        emailSubject: null,
        parts: [
          {
            kind: GQL.AffiliateMessagePartKind.Text,
            text: "Thank you. Please send the draft when it is ready.",
          },
        ],
      },
      steps: [],
    } as unknown as GQL.AffiliateRevisionRequestedProposalContext;
    const agenda = {
      ...((base.creatorRelationship?.agendaItems ?? [])[0] as GQL.AffiliateRelationshipAgendaItem),
      proposalId: revision.id,
      revisionRequestedProposal: revision,
    };
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({
        agentWorkingAgendaItems: [agenda],
      }),
      platform: "tiktok",
    });

    expect(request?.message).toContain("Dispatch Source: STAFF_PROPOSAL_REVISION_REQUEST");
    expect(request?.message).toContain("Make the reply warmer");
    expect(request?.message).toContain("Thank you. Please send the draft when it is ready.");
    expect(request?.message).not.toContain("This staff-only pending proposal must stay hidden.");
  });

  it("injects only trusted Creator identity constants, not commerce snapshots, into the run context", () => {
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

    expect(request?.message).toContain("[Bound Affiliate Run Context]");
    expect(request?.message).toContain("[Agent Working Agenda]");
    expect(request?.message).toContain("Creator ID: creator-001");
    expect(request?.message).toContain("TikTok Creator Open ID: creator-open-001");
    expect(request?.message).toContain("TikTok Creator Username: creator_handle");
    expect(request?.message).toContain(
      "The Creator Relationship and Creator identity are trusted run constants",
    );
    expect(request?.message).toContain(
      "The trigger shop is event provenance only",
    );
    expect(request?.message).not.toContain("Creator Name");
    expect(request?.message).not.toContain("Follower Count");
    expect(request?.message).not.toContain('"ecVideoCount":17');
    expect(request?.message).not.toContain('"creator_gmv_30d":1214.34');
  });

  it("does not inject ambiguous collaboration candidates beyond the agenda", () => {
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

    expect(request?.message).toContain("[Agent Working Agenda]");
    expect(request?.message).not.toContain("Active Collaborations");
    expect(request?.message).not.toContain("Ambiguous Collaboration Candidates");
    expect(request?.message).not.toContain("collab-ambiguous-001");
    expect(request?.message).not.toContain("collab-ambiguous-002");
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
        sampleApplicationRecordId: "sample-record-001",
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
    expect(agentCall?.[1]?.message).toContain("[Agent Working Agenda]");
    expect(agentCall?.[1]?.message).not.toContain("Status: NOT_PREFETCHED");
    expect(agentCall?.[1]?.message).not.toContain("prediction cache id");
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
    expect(
      session.handleAgentEvent({
        runId: "run-affiliate-001",
        stream: "assistant",
        data: { text: "ResourceExhausted: Worker local total request limit reached (24/16)" },
      }),
    ).toBe(false);

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

  it("does not mark a run failed when a pending proposal gates the unchanged source agenda", async () => {
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
              agentDispatchRecommended: false,
              creatorRelationship: {
                id: "relationship-001",
                lastAgentHandledAt: null,
              },
              collaboration: {
                id: "collab-001",
                workHandledUntil: null,
              },
            },
          ],
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
      workKind: GQL.AffiliateWorkKind.ManualReview,
      processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.StaffRequired,
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });
    expect(request).toBeNull();
  });

  it("builds a generic relationship run for any other Agent-owned agenda", () => {
    const workItem = createSampleReviewWorkItem({
      agentDispatchRecommended: true,
      workKind: GQL.AffiliateWorkKind.ManualReview,
      workBundleKind: GQL.AffiliateWorkBundleKind.GeneralReview,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask,
      processReasons: [],
      recommendedActionTypes: [],
      creatorRelationship: {
        ...(createSampleReviewWorkItem().creatorRelationship as GQL.AffiliateCreatorRelationship),
        agendaItems: [],
      },
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

    expect(request?.message).toContain("[Agent Working Agenda]");
    expect(request?.message).toContain("Work Kind: MANUAL_REVIEW");
    expect(request?.message).not.toContain("affiliate_resolve_work_item");
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
      creatorRelationship: {
        ...(createCreatorReplyWorkItem().creatorRelationship as GQL.AffiliateCreatorRelationship),
        agendaItems: [],
      },
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

    expect(request?.message).toContain("[Agent Working Agenda]");
    expect(request?.message).toContain("Work Kind: CREATOR_FOLLOW_UP");
    expect(request?.message).toContain("Reasons: CREATOR_ACTION_FOLLOW_UP_DUE");
    expect(request?.message).not.toContain("handledSignalAt");
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
      creatorRelationship: {
        ...(createCreatorReplyWorkItem().creatorRelationship as GQL.AffiliateCreatorRelationship),
        agendaItems: [],
      },
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

    expect(request?.idempotencyKey).toContain("CONTENT_FOLLOW_UP");
    expect(request?.message).toContain("[Agent Working Agenda]");
    expect(request?.message).toContain("Work Kind: CONTENT_FOLLOW_UP");
    expect(request?.message).toContain("Reasons: SAMPLE_CONTENT_FOLLOW_UP_DUE");
    expect(request?.message).not.toContain("2026-05-14T00:01:00.000Z");
  });

  it("renders combined sample review and reply templates for bundled creator reply work", () => {
    const workItem = createCreatorReplyWorkItem({
      workBundleKind: GQL.AffiliateWorkBundleKind.CreatorReplyWithSampleReview,
      processReasons: [
        GQL.AffiliateCollaborationRecordProcessReason.CreatorMessageNeedsReply,
        GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview,
      ],
      recommendedActionTypes: [GQL.ActionProposalType.ReviewSampleApplication],
      sampleApplicationRecord: createSampleReviewWorkItem().sampleApplicationRecord,
      creatorRelationship: {
        ...(createCreatorReplyWorkItem().creatorRelationship as GQL.AffiliateCreatorRelationship),
        agendaItems: [],
      },
    });

    const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

    expect(request?.message).toContain("[Agent Working Agenda]");
    expect(request?.message).toContain(
      "Reasons: CREATOR_MESSAGE_NEEDS_REPLY, SAMPLE_PENDING_REVIEW",
    );
    expect(request?.message).not.toContain("Combined bundle requirement");
    expect(request?.message).not.toContain("REQUEST_ACTION");
  });

  it("does not inject merchant prediction thresholds into the working agenda", () => {
    const request = buildAffiliateAgentRunRequest({
      workItem: createSampleReviewWorkItem(),
      platform: "tiktok",
    });

    expect(request?.message).toContain("[Agent Working Agenda]");
    expect(request?.message).not.toContain("shop default");
    expect(request?.message).not.toContain("minExpectedSalesUnits");
    expect(request?.message).not.toContain("If expectedSalesUnits is below");
    expect(request?.message).not.toContain("If expectedSalesUnits meets or exceeds");
  });
});
