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
import {
  AffiliateInbound,
  resolveMaxActiveAffiliateAgentRuns,
} from "./affiliate-inbound.js";
import {
  __clearActiveAffiliateRunCheckpointsForTests,
  getActiveAffiliateRunCheckpoint,
} from "./affiliate-run-checkpoints.js";
import { initLLMProviderManagerEnv, rootStore } from "../app/store/desktop-store.js";

describe("affiliate session identity", () => {
  it("uses the exact live-test cohort size as the default Agent pool", () => {
    expect(resolveMaxActiveAffiliateAgentRuns({
      RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS: "rel-1,rel-2,rel-3",
    })).toBe(3);
    expect(resolveMaxActiveAffiliateAgentRuns({
      RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS: "rel-1,rel-1,rel-2",
    })).toBe(2);
    expect(resolveMaxActiveAffiliateAgentRuns({})).toBe(1);
  });

  it("allows an explicit Affiliate Agent pool size to override the live-test cohort", () => {
    expect(resolveMaxActiveAffiliateAgentRuns({
      RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS: "rel-1,rel-2,rel-3",
      RIVONCLAW_MAX_ACTIVE_AFFILIATE_AGENT_RUNS: "7",
    })).toBe(7);
  });

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

function createWorkingAgendaPredictionEvidence(
  overrides: Partial<GQL.AffiliateActionProposalPredictionSnapshot> = {},
): GQL.AffiliateActionProposalPredictionSnapshot {
  return {
    sourceCacheId: "64f000000000000000000700",
    predictionType: GQL.AffiliatePredictionType.SalesUnitsForecast,
    captureMode: GQL.AffiliatePredictionCaptureMode.PromotedFromCache,
    scenario: GQL.AffiliateExpectedSalesPredictionScenario.SampleReview,
    subject: {
      sampleApplicationRecordId: "sample-record-001",
      creatorId: "creator-001",
      productId: "product-001",
    },
    status: GQL.AffiliatePredictionStatus.Ok,
    output: { expectedSalesUnits: 2.4 },
    model: { modelStage: "UNIFIED", effectiveTenantScope: "USER" },
    diagnostics: {},
    predictedAt: "2026-05-11T00:01:01.000Z",
    ...overrides,
  };
}

function createSampleReviewWorkItem(
  overrides: Partial<GQL.AffiliateWorkItem> = {},
): GQL.AffiliateWorkItem {
  const collaboration = {
    id: "collab-001",
    userId: "user-001",
    shopId: "shop-001",
    campaignId: null,
    creatorIds: ["creator-001"],
    creatorOpenIds: ["creator-open-001"],
    productIds: ["product-001"],
    type: GQL.AffiliateCollaborationType.Target,
    status: GQL.AffiliateCollaborationStatus.Active,
    platformCollaborationId: "platform-collaboration-001",
    commissionRate: null,
    effectiveTime: "2026-05-11T00:00:00.000Z",
    platformUpdatedAt: "2026-05-11T00:01:00.000Z",
    firstObservedAt: "2026-05-11T00:00:00.000Z",
    lastObservedAt: "2026-05-11T00:01:00.000Z",
    lastSyncSource: GQL.AffiliateProjectionSyncSource.AirflowReconcile,
    projectionRevision: 1,
    creatorId: "creator-001",
    creatorImId: "creator-im-001",
    productId: "product-001",
    sampleApplicationRecordId: "sample-record-001",
    sampleApplicationRecordIds: ["sample-record-001"],
    platformSampleApplicationStatus: "PENDING",
    lifecycleStage: "SAMPLE_PENDING",
    processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
    requiredAction: GQL.AffiliateRelationshipRequiredAction.ReviewSampleApplication,
    processReasons: [GQL.AffiliateWorkProcessReason.SamplePendingReview],
    lastCreatorMessageId: null,
    lastCreatorMessageAt: null,
    workHandledUntil: null,
    nextSellerActionAt: null,
    startedAt: "2026-05-11T00:00:00.000Z",
    endedAt: null,
    createdAt: "2026-05-11T00:00:00.000Z",
    updatedAt: "2026-05-11T00:01:00.000Z",
    stateUpdatedAt: "2026-05-11T00:01:00.000Z",
    affiliateCollaborationId: null,
    collaborationType: null,
    predictionSnapshots: [],
  } as unknown as GQL.AffiliateCollaboration;

  const sampleApplicationRecord: GQL.SampleApplicationRecord = {
    id: "sample-record-001",
    userId: "user-001",
    shopId: "shop-001",
    platformApplicationId: "platform-sample-001",
    creatorId: "creator-001",
    creatorRelationshipId: "relationship-001",
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
    affiliateCollaborationId: "collab-001",
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
    processReasons: [GQL.AffiliateWorkProcessReason.SamplePendingReview],
    recommendedActionTypes: [GQL.ActionProposalType.ReviewSampleApplication],
    versionAt: "2026-05-11T00:01:00.000Z",
    affiliateCollaboration: collaboration,
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
      activeAffiliateCollaborationIds: ["collab-001"],
      activeSampleApplicationRecordIds: ["sample-record-001"],
      agendaItems: [
        {
          key: "affiliateCollaboration:collab-001:COMPLETE_COLLABORATION_TASK",
          owner: GQL.AffiliateRelationshipAgendaOwner.Agent,
          sourceType: GQL.AffiliateRelationshipAgendaSourceType.PlatformCollaboration,
          workKind: GQL.AffiliateWorkKind.SampleApplicationDecision,
          requiredAction: GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask,
          shopId: "shop-001",
          affiliateCollaborationId: "collab-001",
          sampleApplicationRecordId: "sample-record-001",
          proposalId: null,
          reasons: [GQL.AffiliateWorkProcessReason.SamplePendingReview],
          nextActionAt: null,
          boundaryEventCursor: 1,
          updatedAt: "2026-05-11T00:01:00.000Z",
          predictionEvidence: createWorkingAgendaPredictionEvidence(),
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
  const affiliateCollaboration: GQL.AffiliateCollaboration = {
    ...(base.affiliateCollaboration as GQL.AffiliateCollaboration),
    sampleApplicationRecordId: null,
    lifecycleStage: "CONVERSATION",
    processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
    requiredAction: GQL.AffiliateRelationshipRequiredAction.HandleCreatorMessage,
    processReasons: [GQL.AffiliateWorkProcessReason.CreatorMessageNeedsHandling],
    lastCreatorMessageId: null,
    lastCreatorMessageAt: null,
  } as unknown as GQL.AffiliateCollaboration;

  return {
    ...base,
    workKind: GQL.AffiliateWorkKind.InboundMessageTriage,
    workBundleKind: GQL.AffiliateWorkBundleKind.CreatorReplyOnly,
    processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
    requiredAction: GQL.AffiliateRelationshipRequiredAction.HandleCreatorMessage,
    processReasons: [GQL.AffiliateWorkProcessReason.CreatorMessageNeedsHandling],
    recommendedActionTypes: [GQL.ActionProposalType.SendMessage],
    affiliateCollaboration,
    creatorRelationship: {
      ...base.creatorRelationship,
      processingStatus: GQL.AffiliateRelationshipProcessingStatus.AgentRequired,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.HandleCreatorMessage,
      processReasons: [GQL.AffiliateWorkProcessReason.CreatorMessageNeedsHandling],
      agendaItems: [
        {
          key: "relationship:relationship-001:HANDLE_CREATOR_MESSAGE",
          owner: GQL.AffiliateRelationshipAgendaOwner.Agent,
          sourceType: GQL.AffiliateRelationshipAgendaSourceType.Relationship,
          workKind: GQL.AffiliateWorkKind.InboundMessageTriage,
          requiredAction: GQL.AffiliateRelationshipRequiredAction.HandleCreatorMessage,
          shopId: "shop-001",
          affiliateCollaborationId: null,
          sampleApplicationRecordId: null,
          proposalId: null,
          reasons: [GQL.AffiliateWorkProcessReason.CreatorMessageNeedsHandling],
          nextActionAt: null,
          boundaryEventCursor: 1,
          updatedAt: "2026-05-11T00:01:00.000Z",
        },
      ],
    },
    sampleApplicationRecord: null,
    context: {
      ...base.context,
      activeCollaborations: [affiliateCollaboration],
      focusCollaboration: affiliateCollaboration,
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
    involvedShopInstructions?: GQL.AffiliateInvolvedShopInstruction[];
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
          involvedShopInstructions: options.involvedShopInstructions ?? [
            {
              shopId: "shop-001",
              shopName: "Affiliate Test Shop",
              businessPrompt: "Prefer creator-product fit over raw audience size.",
            },
          ],
          baseMatchesCommitted: true,
          truncated: false,
          events: [],
          workspace: {
            sampleApplicationRecords: [],
            affiliateCollaborations: [],
            actionProposals: [],
            approvalPolicies: [],
            creatorRelations: [],
            creatorTags: [],
            creatorProfiles: options.creatorProfiles ?? [],
            campaigns: [],
            campaignProducts: [],
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
                affiliateCollaborations: [],
                actionProposals: [],
                approvalPolicies: [],
                creatorRelations: [],
                creatorTags: [],
                creatorProfiles: [],
                campaigns: [],
                campaignProducts: [],
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
      activateAuthProfile: vi.fn(),
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
    const graphqlFetch = vi.fn(async () => ({ affiliateWorkItems: [workItem] }));
    mockGetAuthSession.mockReturnValue({ graphqlFetch });
    (inbound as any).runIndex.set("run-active", "affiliate-session-active");
    (inbound as any).sessions.set("affiliate-session-active", { onRunCompleted: vi.fn() });
    const dispatchSpy = vi.spyOn(inbound as any, "dispatchWorkItem").mockResolvedValue(true);

    await inbound.handleWorkItem(workItem);
    expect(dispatchSpy).not.toHaveBeenCalled();

    inbound.handleGatewayEvent({ payload: { runId: "run-active", state: "final" } } as any);
    await waitForCondition(() => dispatchSpy.mock.calls.length === 1);

    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.any(String),
      {
        input: {
          shopId: "shop-001",
          creatorRelationshipId: "relationship-001",
          agentDispatchRecommended: true,
          limit: 10,
        },
      },
    );
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
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
        creatorOpenId: "creator-open-001",
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
    expect(agentCall?.[1]).not.toHaveProperty("allowEmptyAssistantReplyAsSilent");
    expect(agentCall?.[1]?.message).toContain("[Agent Working Agenda]");
    expect(agentCall?.[1]?.message).toContain("Work Kind: SAMPLE_APPLICATION_DECISION");
    expect(agentCall?.[1]?.message).toContain("Reasons: SAMPLE_PENDING_REVIEW");
    expect(agentCall?.[1]?.message).toContain("Shop ID: shop-001");
    expect(agentCall?.[1]?.message).toContain("Sample Application Record ID: sample-record-001");
    expect(agentCall?.[1]?.message).not.toContain("Current Authoritative Workspace Snapshot");
    expect(agentCall?.[1]?.message).not.toContain("Authoritative Sample Application State");
    expect(agentCall?.[1]?.message).toContain("Backend Prediction Evidence");
    expect(agentCall?.[1]?.message).not.toContain("thresholdProbabilities");
    expect(agentCall?.[1]?.message).not.toContain("handledSignalAt");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("Keep creator outreach concise and warm.");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "### Affiliate Test Shop (Shop ID: shop-001)",
    );
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "Prefer creator-product fit over raw audience size.",
    );
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "the Business Developer instructions override the shop instructions",
    );
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
      bioDescription: null,
      profileTtUri: null,
      firstObservedAt: "2026-05-01T00:00:00.000Z",
      lastObservedAt: "2026-05-02T00:00:00.000Z",
      currentPerformance: [
        {
          id: "performance-001",
          sourceShopId: "shop-001",
          market: "US",
          observedAt: "2026-05-02T00:00:00.000Z",
          sourceType: "PERFORMANCE_DETAIL",
          preciseDataAuthorized: true,
          followerCount: 3454,
          categoryIds: ["category-1"],
          gmv: {
            amount: 1214.34,
            currency: "USD",
            minimumAmount: null,
            maximumAmount: null,
            window: "UNSPECIFIED",
            precision: "EXACT",
          },
          videoGmv: null,
          liveGmv: null,
          gpm: null,
          unitsSold: null,
          videoCount: 17,
          liveCount: null,
          averageVideoViews: null,
          engagementRate: null,
          pps: null,
          ratingScore: null,
          contentWindow: "UNSPECIFIED",
        },
      ],
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
        affiliateCollaborationId: "collab-001",
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
          predictionCacheIds: ["64f000000000000000000700"],
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
        affiliateCollaborationId: "collab-001",
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
        affiliateCollaborationId: "collab-001",
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

  it("uses a fresh transcript admission key when deliberately replaying the same work version", async () => {
    const workItem = createSampleReviewWorkItem();
    let runCount = 0;
    mockRpcRequest.mockImplementation(async (method: string) => {
      if (method === "agent") return { runId: `run-replay-${++runCount}` };
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
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    const first = await session.handleWorkItem(workItem);
    session.onRunCompleted(first.runId!);
    const second = await session.handleWorkItem(workItem);

    const agentCalls = mockRpcRequest.mock.calls.filter((call) => call[0] === "agent");
    expect(agentCalls).toHaveLength(2);
    const firstKey = agentCalls[0]?.[1]?.idempotencyKey as string;
    const secondKey = agentCalls[1]?.[1]?.idempotencyKey as string;
    const semanticKey = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" })?.idempotencyKey;
    expect(firstKey).toMatch(new RegExp(`^${semanticKey}:attempt:`));
    expect(secondKey).toMatch(new RegExp(`^${semanticKey}:attempt:`));
    expect(secondKey).not.toBe(firstKey);
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
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "Once this run is dispatched, reconcile every listed agenda item",
    );
    expect(agentCall?.[1]?.extraSystemPrompt).not.toContain(
      "Never send a second outbound Affiliate message",
    );
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("affiliate_resolve_work_item");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "/test/workspace-affiliate/skills/affiliate-workflow/SKILL.md",
    );
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "final assistant response exactly NO_REPLY",
    );
    expect(agentCall?.[1]?.extraSystemPrompt).toContain(
      "Never select FAILED_OR_INCOMPLETE",
    );
    expect(agentCall?.[1]?.message).toContain("[Agent Working Agenda]");
    expect(agentCall?.[1]?.message).toContain("Required Action: HANDLE_CREATOR_MESSAGE");
    expect(agentCall?.[1]?.message).toContain("Reasons: CREATOR_MESSAGE_NEEDS_HANDLING");
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
          decision: "FAILED_OR_INCOMPLETE",
        });
        expect(variables?.input?.operatorSummary).toContain("creator-video.mp4");
        return {
          resolveAffiliateWorkItem: {
            decision: "FAILED_OR_INCOMPLETE",
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
      affiliateCollaborationId: "collab-expected-001",
      affiliateCollaboration: {
        ...(createCreatorReplyWorkItem().affiliateCollaboration as GQL.AffiliateCollaboration),
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
        affiliateCollaborationId: "collab-expected-001",
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
        affiliateCollaborationId: "collab-001",
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

  it("does not read prediction evidence from canonical Collaboration state", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
    const workItem = createSampleReviewWorkItem({
      id: "collab-with-snapshot",
      affiliateCollaborationId: "collab-with-snapshot",
      affiliateCollaboration: {
        ...(createSampleReviewWorkItem().affiliateCollaboration as GQL.AffiliateCollaboration),
        id: "collab-with-snapshot",
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
        affiliateCollaborationId: "collab-with-snapshot",
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

  it("dispatches sample review with Backend prediction evidence and no Agent-side prefetch", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
    const baseWorkItem = createSampleReviewWorkItem();
    const workItem = createSampleReviewWorkItem({
      id: "collab-sample-agent-001",
      affiliateCollaborationId: "collab-sample-agent-001",
      agentDispatchRecommended: true,
      staffReviewRequired: false,
      affiliateCollaboration: {
        ...(baseWorkItem.affiliateCollaboration as GQL.AffiliateCollaboration),
        id: "collab-sample-agent-001",
      },
      agentWorkingAgendaItems: [{
        ...(baseWorkItem.creatorRelationship?.agendaItems ?? [])[0]!,
        predictionEvidence: {
          sourceCacheId: "64f000000000000000000777",
          predictionType: GQL.AffiliatePredictionType.SalesUnitsForecast,
          captureMode: GQL.AffiliatePredictionCaptureMode.PromotedFromCache,
          scenario: GQL.AffiliateExpectedSalesPredictionScenario.SampleReview,
          subject: {
            sampleApplicationRecordId: "sample-record-001",
            creatorId: "creator-001",
            productId: "product-001",
          },
          status: GQL.AffiliatePredictionStatus.Ok,
          output: {
            expectedSalesUnits: 2.4,
            thresholdProbabilities: { unitsGe1: 0.81 },
            humanDecision: { wouldApprove: true, humanApprovalProbability: 0.74 },
            featureTemporalBasis: "BEST_AVAILABLE",
          },
          model: {
            modelStage: "UNIFIED",
            effectiveTenantScope: "USER",
            modelVersion: "affiliate-unified-v4",
          },
          diagnostics: {},
          predictedAt: "2026-05-11T00:01:01.000Z",
        },
      }],
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
        affiliateCollaborationId: "collab-sample-agent-001",
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
    expect(agentCall?.[1]?.message).toContain("Backend Prediction Evidence");
    expect(agentCall?.[1]?.message).toContain('"expectedSalesUnits":2.4');
    expect(agentCall?.[1]?.message).toContain(
      "Treat Expected Sales as the primary commercial-value estimate",
    );
    expect(agentCall?.[1]?.message).not.toContain("thresholdProbabilities");
    expect(agentCall?.[1]?.message).not.toContain("unitsGe1");
    expect(agentCall?.[1]?.message).not.toContain("humanDecision");
    expect(agentCall?.[1]?.message).not.toContain("humanApprovalProbability");
    expect(getActiveAffiliateRunCheckpoint("relationship-001")?.predictionCacheIds).toEqual([
      "64f000000000000000000777",
    ]);
    expect(agentCall?.[1]?.message).not.toContain(
      "before submitting a REVIEW_SAMPLE_APPLICATION action",
    );
  });

  it("renders relationship-level sample pending work as a sample review agent run", () => {
    const workItem = createSampleReviewWorkItem({
      workKind: GQL.AffiliateWorkKind.ManualReview,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask,
      processReasons: [GQL.AffiliateWorkProcessReason.SamplePendingReview],
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
    expect(request?.message).toContain("Platform Collaboration ID: collab-001");
    expect(request?.message).not.toContain("Lifecycle Stage");
    expect(request?.message).not.toContain("Backend Work Context");
  });

  it("renders the producing shop for every agenda item in a cross-shop Relationship bundle", () => {
    const base = createSampleReviewWorkItem();
    const firstAgenda = {
      ...(base.creatorRelationship?.agendaItems ?? [])[0]!,
      shopRegion: "US",
    };
    const secondAgenda = {
      ...firstAgenda,
      key: "affiliateCollaboration:collab-002:COMPLETE_COLLABORATION_TASK",
      shopId: "shop-002",
      shopRegion: "FR",
      affiliateCollaborationId: "collab-002",
      sampleApplicationRecordId: "sample-record-002",
      predictionEvidence: createWorkingAgendaPredictionEvidence({
        sourceCacheId: "64f000000000000000000701",
        subject: {
          sampleApplicationRecordId: "sample-record-002",
          creatorId: "creator-001",
          productId: "product-002",
        },
      }),
    };
    const request = buildAffiliateAgentRunRequest({
      workItem: createSampleReviewWorkItem({
        agentWorkingAgendaItems: [firstAgenda, secondAgenda],
      }),
      platform: "tiktok",
    });

    expect(request?.message).toContain("1. Agenda Item:");
    expect(request?.message).toContain("2. Agenda Item:");
    expect(request?.message).toContain("Shop ID: shop-001");
    expect(request?.message).toContain("Shop ID: shop-002");
    expect(request?.message).toContain("Shop Region: US");
    expect(request?.message).toContain("Shop Region: FR");
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
            bioDescription: null,
            profileTtUri: null,
            firstObservedAt: "2026-05-01T00:00:00.000Z",
            lastObservedAt: "2026-05-02T00:00:00.000Z",
            currentPerformance: [
              {
                id: "performance-001",
                sourceShopId: "shop-001",
                market: "US",
                observedAt: "2026-05-02T00:00:00.000Z",
                sourceType: "PERFORMANCE_DETAIL",
                preciseDataAuthorized: true,
                followerCount: 3454,
                categoryIds: ["category-1", "category-2"],
                gmv: {
                  amount: 1214.34,
                  currency: "USD",
                  minimumAmount: null,
                  maximumAmount: null,
                  window: "UNSPECIFIED",
                  precision: "EXACT",
                },
                videoGmv: null,
                liveGmv: null,
                gpm: null,
                unitsSold: null,
                videoCount: 17,
                liveCount: null,
                averageVideoViews: 336,
                engagementRate: null,
                pps: null,
                ratingScore: null,
                contentWindow: "UNSPECIFIED",
              },
            ],
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
    expect(request?.message).toContain(
      "The Creator Relationship and Creator identity are trusted run constants",
    );
    expect(request?.message).toContain(
      "Read profile or performance facts only through affiliate_get_creator_profile",
    );
    expect(request?.message).toContain("The trigger shop is event provenance only");
    expect(request?.message).not.toContain("Creator Name");
    expect(request?.message).not.toContain("Follower Count");
    expect(request?.message).not.toContain('"ecVideoCount":17');
    expect(request?.message).not.toContain('"creator_gmv_30d":1214.34');
  });

  it("does not inject ambiguous collaboration candidates beyond the agenda", () => {
    const base = createCreatorReplyWorkItem();
    const firstCollaboration = {
      ...(base.affiliateCollaboration as GQL.AffiliateCollaboration),
      id: "collab-ambiguous-001",
      productId: "product-ambiguous-001",
      sampleApplicationRecordId: "sample-ambiguous-001",
    } as GQL.AffiliateCollaboration;
    const secondCollaboration = {
      ...(base.affiliateCollaboration as GQL.AffiliateCollaboration),
      id: "collab-ambiguous-002",
      productId: "product-ambiguous-002",
      sampleApplicationRecordId: null,
    } as GQL.AffiliateCollaboration;
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({
        affiliateCollaborationId: null,
        affiliateCollaboration: null,
        sampleApplicationRecord: null,
        processReasons: [
          GQL.AffiliateWorkProcessReason.CollaborationContextAmbiguous,
          GQL.AffiliateWorkProcessReason.CreatorMessageNeedsHandling,
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

  it("rejects a formal sample review work item when Backend prediction evidence is missing", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
      throw new Error(`Unexpected GraphQL call: ${query}`);
    });
    mockGetAuthSession.mockReturnValue({ graphqlFetch: withCheckpointContext(graphqlFetch) });
    const baseWorkItem = createSampleReviewWorkItem();
    const workItem = createSampleReviewWorkItem({
      agentWorkingAgendaItems: [{
        ...(baseWorkItem.creatorRelationship?.agendaItems ?? [])[0]!,
        predictionEvidence: null,
      }],
    });
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
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
        productId: "product-001",
      },
    );

    await expect(session.handleWorkItem(workItem)).rejects.toThrow(
      "is missing Backend prediction evidence",
    );
    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(mockRpcRequest).not.toHaveBeenCalledWith("agent", expect.anything());
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
        affiliateCollaborationId: "collab-001",
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
        affiliateCollaborationId: "collab-001",
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
              affiliateCollaborationId: "collab-001",
              versionAt: "2026-05-11T00:01:00.000Z",
              creatorRelationship: {
                id: "relationship-001",
                lastAgentHandledAt: "2026-05-11T00:01:00.000Z",
              },
              affiliateCollaboration: {
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
      affiliateCollaboration: {
        ...(createCreatorReplyWorkItem().affiliateCollaboration as GQL.AffiliateCollaboration),
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
        affiliateCollaborationId: "collab-001",
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
              affiliateCollaborationId: "collab-001",
              versionAt: "2026-05-11T00:01:00.000Z",
              agentDispatchRecommended: false,
              creatorRelationship: {
                id: "relationship-001",
                lastAgentHandledAt: null,
              },
              affiliateCollaboration: {
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
      affiliateCollaboration: {
        ...(createCreatorReplyWorkItem().affiliateCollaboration as GQL.AffiliateCollaboration),
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
        affiliateCollaborationId: "collab-001",
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

  it("leaves an unresolved relationship work boundary retryable", async () => {
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
              affiliateCollaborationId: "collab-001",
              versionAt: "2026-05-11T00:01:00.000Z",
              creatorRelationship: {
                id: "relationship-001",
                lastAgentHandledAt: null,
              },
              affiliateCollaboration: {
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
      versionAt: "2026-05-11T00:01:00.000Z",
      affiliateCollaboration: {
        ...(createCreatorReplyWorkItem().affiliateCollaboration as GQL.AffiliateCollaboration),
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
        affiliateCollaborationId: "collab-001",
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
      processingStatus: GQL.AffiliateRelationshipProcessingStatus.StaffRequired,
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
      requiredAction: GQL.AffiliateRelationshipRequiredAction.FollowUpCreator,
      processReasons: [GQL.AffiliateWorkProcessReason.CreatorActionFollowUpDue],
      versionAt: "2026-05-13T00:01:00.000Z",
      affiliateCollaboration: {
        ...(createCreatorReplyWorkItem().affiliateCollaboration as GQL.AffiliateCollaboration),
        requiredAction: GQL.AffiliateRelationshipRequiredAction.FollowUpCreator,
        processReasons: [GQL.AffiliateWorkProcessReason.CreatorActionFollowUpDue],
        workHandledUntil: "2026-05-11T00:01:00.000Z",
        nextSellerActionAt: "2026-05-13T00:01:00.000Z",
      } as GQL.AffiliateCollaboration,
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
      requiredAction: GQL.AffiliateRelationshipRequiredAction.FollowUpCreator,
      processReasons: [GQL.AffiliateWorkProcessReason.SampleContentFollowUpDue],
      versionAt: "2026-05-14T00:01:00.000Z",
      affiliateCollaboration: {
        ...(createCreatorReplyWorkItem().affiliateCollaboration as GQL.AffiliateCollaboration),
        requiredAction: GQL.AffiliateRelationshipRequiredAction.FollowUpCreator,
        processReasons: [GQL.AffiliateWorkProcessReason.SampleContentFollowUpDue],
        workHandledUntil: "2026-05-11T00:01:00.000Z",
        nextSellerActionAt: "2026-05-14T00:01:00.000Z",
      } as GQL.AffiliateCollaboration,
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
        GQL.AffiliateWorkProcessReason.CreatorMessageNeedsHandling,
        GQL.AffiliateWorkProcessReason.SamplePendingReview,
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
      "Reasons: CREATOR_MESSAGE_NEEDS_HANDLING, SAMPLE_PENDING_REVIEW",
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
