import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";

/**
 * Loggers are memoized per name so assertions survive `vi.resetModules()`, which
 * re-runs module-scope `createLogger(...)` calls in the module under test.
 */
const loggerMocks = vi.hoisted(() => {
  const loggers = new Map<
    string,
    { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> }
  >();
  return {
    get(name: string) {
      let logger = loggers.get(name);
      if (!logger) {
        logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
        loggers.set(name, logger);
      }
      return logger;
    },
    clear() {
      for (const logger of loggers.values()) {
        logger.info.mockClear();
        logger.warn.mockClear();
        logger.error.mockClear();
      }
    },
  };
});

vi.mock("@rivonclaw/logger", () => ({
  createLogger: (name: string) => loggerMocks.get(name),
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

import {
  AffiliateAgentRunMode,
  AffiliateSession,
  AffiliateTriggerKind,
  buildBusinessDeveloperPromptSection,
  redactBusinessDeveloperContactDetails,
} from "./affiliate-session.js";
import { buildAffiliateAgentRunRequest } from "./affiliate-agent-run-factory.js";
import { AffiliateInbound, resolveMaxActiveAffiliateAgentRuns } from "./affiliate-inbound.js";
import {
  __clearActiveAffiliateRunCheckpointsForTests,
  getActiveAffiliateRunCheckpoint,
} from "./affiliate-run-checkpoints.js";
import { initLLMProviderManagerEnv, rootStore } from "../app/store/desktop-store.js";

describe("affiliate session identity", () => {
  it("renders only the available frozen BD prompt fields", () => {
    expect(buildBusinessDeveloperPromptSection(null)).toEqual([]);

    const nameOnly = buildBusinessDeveloperPromptSection({ creatorDisplayName: "Mia" });
    expect(nameOnly.join("\n")).toContain("Creator-facing name: Mia");
    expect(nameOnly.join("\n")).not.toContain("(none configured)");
    expect(nameOnly.join("\n")).not.toContain("WhatsApp:");
    expect(nameOnly.join("\n")).not.toContain("Email:");
    expect(nameOnly.join("\n")).not.toContain("Business Developer Instructions");

    const promptAndEmail = buildBusinessDeveloperPromptSection({
      creatorDisplayName: "Mia",
      businessPrompt: "Move qualified Creators to email.",
      email: { displayName: "Mia Sales", emailAddress: "mia@example.com" },
    });
    expect(promptAndEmail.join("\n")).toContain("Move qualified Creators to email.");
    expect(promptAndEmail.join("\n")).toContain("Email: Mia Sales — mia@example.com");
    expect(promptAndEmail.join("\n")).not.toContain("WhatsApp:");
  });

  it("omits the Creator-facing name line when the BD has no Creator-facing name", () => {
    for (const context of [
      {},
      { creatorDisplayName: null },
      { creatorDisplayName: "   " },
    ] as GQL.AffiliateBusinessDeveloperDispatchContext[]) {
      const rendered = buildBusinessDeveloperPromptSection({
        ...context,
        businessPrompt: "Keep replies short.",
        email: { displayName: "Mia Sales", emailAddress: "mia@example.com" },
      }).join("\n");

      expect(rendered).not.toContain("Creator-facing name");
      expect(rendered).not.toContain("undefined");
      expect(rendered).not.toContain("null");
      expect(rendered).toContain("## Assigned Business Developer");
      expect(rendered).toContain("Email: Mia Sales — mia@example.com");
      expect(rendered).toContain("Keep replies short.");
    }
  });

  it("redacts frozen BD contact details from full-prompt diagnostics", () => {
    const context = {
      creatorDisplayName: "Mia",
      whatsApp: { phoneNumber: "+1 555 0101" },
      email: { emailAddress: "mia@example.com" },
    } as GQL.AffiliateBusinessDeveloperDispatchContext;

    expect(
      redactBusinessDeveloperContactDetails(
        "WhatsApp +1 555 0101 and email mia@example.com",
        context,
      ),
    ).toBe("WhatsApp [REDACTED_BD_CONTACT] and email [REDACTED_BD_CONTACT]");
  });

  it("uses the exact live-test cohort size as the default Agent pool", () => {
    expect(
      resolveMaxActiveAffiliateAgentRuns({
        RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS: "rel-1,rel-2,rel-3",
      }),
    ).toBe(3);
    expect(
      resolveMaxActiveAffiliateAgentRuns({
        RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS: "rel-1,rel-1,rel-2",
      }),
    ).toBe(2);
    expect(resolveMaxActiveAffiliateAgentRuns({})).toBe(1);
  });

  it("allows an explicit Affiliate Agent pool size to override the live-test cohort", () => {
    expect(
      resolveMaxActiveAffiliateAgentRuns({
        RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS: "rel-1,rel-2,rel-3",
        RIVONCLAW_MAX_ACTIVE_AFFILIATE_AGENT_RUNS: "7",
      }),
    ).toBe(7);
  });

  it("uses user id and creator relationship id as the long-lived affiliate session key", () => {
    expect(
      AffiliateSession.buildScopeKey("tiktok", {
        userId: "user-1",
        routingShopId: "shop-1",
        platformShopId: "platform-shop-1",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conv-1",
        creatorRelationshipId: "rel-1",
      }),
    ).toBe("agent:affiliate:affiliate:user-1:rel-1");
    expect(
      AffiliateSession.buildScopeKey("whatsapp", {
        userId: "user-1",
        routingShopId: "shop-1",
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
        routingShopId: "shop-1",
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
        routingShopId: "shop-2",
        platformShopId: "platform-shop-2",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-2",
        creatorRelationshipId: "rel-1",
      });
    }).not.toThrow();

    expect(session.scopeKey).toBe("agent:affiliate:affiliate:user-1:rel-1");
    expect(session.affiliateContext).toMatchObject({
      routingShopId: "shop-2",
      platformShopId: "platform-shop-2",
      creatorRelationshipId: "rel-1",
    });
    expect((session as any).shop.objectId).toBe("shop-2");
  });

  it("rejects affiliate session keys without a user id", () => {
    expect(() =>
      AffiliateSession.buildScopeKey("tiktok", {
        routingShopId: "shop-1",
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
      routingShopId: "shop-001",
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

function createCanonicalPredictionEvidence(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    evidenceMode: "EXPECTED_SALES_TRUSTED",
    expectedSales: {
      family: "EXPECTED_SALES",
      status: "READY",
      selection: {
        requestedScope: "SHOP",
        effectiveScope: "USER",
        modelVersion: "affiliate-unified-v4:USER:7",
        evaluatedScopes: [],
      },
      error: null,
      value: { units: 2.4, reliability: "TRUSTED", reliabilityReasons: [] },
    },
    humanDecision: {
      family: "HUMAN_DECISION",
      status: "NOT_AVAILABLE",
      selection: null,
      error: null,
      value: null,
    },
    ...overrides,
  };
}

function createWorkingAgendaPredictionEvidence(
  overrides: Record<string, unknown> = {},
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
    output: {},
    model: {},
    diagnostics: {},
    predictedAt: "2026-05-11T00:01:01.000Z",
    predictionEvidence: createCanonicalPredictionEvidence(),
    ...overrides,
  } as unknown as GQL.AffiliateActionProposalPredictionSnapshot;
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
    publishedContentCount: 0,
    hasPublishedContent: false,
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
    agentWorkingAgendaItems: [
      {
        key: "affiliateCollaboration:collab-001:COMPLETE_COLLABORATION_TASK",
        owner: GQL.AffiliateRelationshipAgendaOwner.Agent,
        sourceType: GQL.AffiliateRelationshipAgendaSourceType.PlatformCollaboration,
        workKind: GQL.AffiliateWorkKind.SampleApplicationDecision,
        requiredAction: GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask,
        shopId: "shop-001",
        productId: "product-001",
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
    versionKey: "relationship-001:version-1",
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
    agentWorkingAgendaItems: [
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
    omitBusinessDeveloperContext?: boolean;
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
            creatorDisplayName: "Maria Chen",
            regions: [GQL.ShopRegion.Us],
            acceptingCreators: true,
            agentAssistanceMode: GQL.AffiliateAgentAssistanceMode.AiAssisted,
            businessPrompt: "Keep creator outreach concise and warm.",
            configRevision: 3,
            createdAt: "2026-05-11T00:00:00.000Z",
            updatedAt: "2026-05-11T00:00:00.000Z",
          },
          businessDeveloperDispatchContext: options.omitBusinessDeveloperContext
            ? null
            : {
                creatorDisplayName: "Maria Chen",
                businessPrompt: "Keep creator outreach concise and warm.",
                whatsApp: {
                  displayName: "Maria WhatsApp",
                  phoneNumber: "+1 555 0100",
                },
                email: {
                  displayName: "Maria",
                  emailAddress: "maria@example.com",
                },
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

    expect(graphqlFetch).toHaveBeenCalledWith(expect.any(String), {
      input: {
        shopId: "shop-001",
        creatorRelationshipId: "relationship-001",
        agentDispatchRecommended: true,
        limit: 10,
      },
    });
    expect(dispatchSpy).toHaveBeenCalledWith(workItem, workItem.versionKey, workItem.versionAt);
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

  it("fetches only checkpoint metadata and keeps the frozen Agenda boundary", async () => {
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationRecordId: "sample-record-001",
        creatorId: "creator-001",
      },
    );

    const baseWorkItem = createSampleReviewWorkItem();
    await session.handleWorkItem(
      createSampleReviewWorkItem({
        creatorRelationship: {
          ...baseWorkItem.creatorRelationship!,
          // Simulate a newer Creator fact arriving after this WorkItem was frozen.
          lifecycleEventSequence: 9,
        },
      }),
    );

    expect(graphqlFetch).toHaveBeenCalledWith(
      expect.stringContaining("affiliateContextBuilder"),
      expect.objectContaining({
        input: expect.objectContaining({
          shopId: "shop-001",
          creatorRelationshipId: "relationship-001",
          targetEventCursor: 1,
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

  it("omits the complete Business Developer section when no BD context is assigned", async () => {
    const graphqlFetch = vi.fn(
      withCheckpointContext(
        async (query: string) => {
          throw new Error(`Unexpected GraphQL call: ${query}`);
        },
        { omitBusinessDeveloperContext: true },
      ),
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
      },
    );

    await session.handleWorkItem(createSampleReviewWorkItem());

    const agentCall = mockRpcRequest.mock.calls.find((call) => call[0] === "agent");
    expect(agentCall?.[1]?.extraSystemPrompt).not.toContain("## Assigned Business Developer");
    expect(agentCall?.[1]?.extraSystemPrompt).not.toContain("## Business Instruction Precedence");
    expect(agentCall?.[1]?.extraSystemPrompt).not.toContain("(none configured)");
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationRecordId: "sample-record-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
        creatorOpenId: "creator-open-001",
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
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("Creator-facing name: Maria Chen");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("Maria WhatsApp — +1 555 0100");
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("Maria — maria@example.com");
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
        routingShopId: "shop-001",
        creatorRelationshipId: "relationship-001",
        frozenAgendaProductShopPairsJson: "[]",
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
        routingShopId: "shop-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationRecordId: "sample-record-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationRecordId: "sample-record-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "platform-sample-001",
        sampleApplicationRecordId: "sample-record-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "platform-sample-001",
        sampleApplicationRecordId: "sample-record-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
      },
    );

    const first = await session.handleWorkItem(workItem);
    session.onRunCompleted(first.runId!);
    await session.handleWorkItem(workItem);

    const agentCalls = mockRpcRequest.mock.calls.filter((call) => call[0] === "agent");
    expect(agentCalls).toHaveLength(2);
    const firstKey = agentCalls[0]?.[1]?.idempotencyKey as string;
    const secondKey = agentCalls[1]?.[1]?.idempotencyKey as string;
    const semanticKey = buildAffiliateAgentRunRequest({
      workItem,
      platform: "tiktok",
    })?.idempotencyKey;
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
        routingShopId: "shop-001",
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
        routingShopId: "shop-001",
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
    expect(agentCall?.[1]?.extraSystemPrompt).toContain("Never select FAILED_OR_INCOMPLETE");
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

  it("dispatches unreadable Creator attachments without a legacy hydration preflight", async () => {
    const graphqlFetch = vi.fn(async (query: string) => {
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "message-video-001",
      },
    );

    await expect(session.handleWorkItem(createCreatorReplyWorkItem())).resolves.toEqual({
      runId: "run-affiliate-001",
      runMode: AffiliateAgentRunMode.OPERATOR_REASONING,
    });
    expect(mockRpcRequest.mock.calls.some((call) => call[0] === "agent")).toBe(true);
    expect(
      graphqlFetch.mock.calls.some(([query]) =>
        String(query).includes("AffiliateCreatorMessagePreflight"),
      ),
    ).toBe(false);
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
        routingShopId: "shop-001",
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
        routingShopId: "shop-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        affiliateCollaborationId: "collab-expected-001",
        creatorId: "creator-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        creatorRelationshipId: "relationship-operator-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationRecordId: "sample-record-001",
        affiliateCollaborationId: "collab-with-snapshot",
        creatorId: "creator-001",
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
      agentWorkingAgendaItems: [
        {
          ...(baseWorkItem.creatorRelationship?.agendaItems ?? [])[0]!,
          predictionEvidence: createWorkingAgendaPredictionEvidence({
            sourceCacheId: "64f000000000000000000777",
            // Raw frozen output stays snapshot-only; the factory must never
            // read it under the canonical cutover.
            output: {
              thresholdProbabilities: { unitsGe1: 0.81 },
            },
            predictionEvidence: createCanonicalPredictionEvidence({
              humanDecision: {
                family: "HUMAN_DECISION",
                status: "READY",
                selection: { effectiveScope: "USER", modelVersion: "affiliate-unified-v4:USER:7" },
                error: null,
                value: { wouldApprove: true, approvalProbability: 0.74 },
              },
            }),
          }),
        },
      ],
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationRecordId: "sample-record-001",
        affiliateCollaborationId: "collab-sample-agent-001",
        creatorId: "creator-001",
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
    expect(agentCall?.[1]?.message).toContain('"units":2.4');
    expect(agentCall?.[1]?.message).toContain(
      "Treat Expected Sales as the primary commercial-value estimate",
    );
    expect(agentCall?.[1]?.message).toContain('"evidenceMode":"EXPECTED_SALES_TRUSTED"');
    expect(agentCall?.[1]?.message).toContain('"reliability":"TRUSTED"');
    expect(agentCall?.[1]?.message).not.toContain("thresholdProbabilities");
    expect(agentCall?.[1]?.message).not.toContain("unitsGe1");
    expect(agentCall?.[1]?.message).not.toContain("humanDecision");
    expect(agentCall?.[1]?.message).not.toContain("approvalProbability");
    expect(agentCall?.[1]?.message).not.toContain("wouldApprove");
    expect(agentCall?.[1]?.message).not.toContain("merchantApprovalTendency");
    expect(getActiveAffiliateRunCheckpoint("relationship-001")?.predictionCacheIds).toEqual([
      "64f000000000000000000777",
    ]);
    expect(agentCall?.[1]?.message).not.toContain(
      "before submitting a REVIEW_SAMPLE_APPLICATION action",
    );
  });

  describe("canonical prediction evidence injection (ADR-058 cutover)", () => {
    function createSampleReviewWorkItemWithEvidence(
      evidence: GQL.AffiliateActionProposalPredictionSnapshot,
    ): GQL.AffiliateWorkItem {
      const base = createSampleReviewWorkItem();
      return createSampleReviewWorkItem({
        agentWorkingAgendaItems: [
          {
            ...(base.agentWorkingAgendaItems ?? [])[0]!,
            predictionEvidence: evidence,
          },
        ],
      });
    }

    it("injects the frozen trusted Expected Sales value without any Human Decision output", () => {
      const workItem = createSampleReviewWorkItemWithEvidence(
        createWorkingAgendaPredictionEvidence({
          predictionEvidence: createCanonicalPredictionEvidence({
            expectedSales: {
              family: "EXPECTED_SALES",
              status: "READY",
              selection: {
                requestedScope: "SHOP",
                effectiveScope: "USER",
                modelVersion: "affiliate-unified-v4:USER:7",
                evaluatedScopes: [{ scope: "SHOP", tenantId: "tenant-scope-shop-001" }],
              },
              error: null,
              value: {
                units: 2.4,
                percentile: 61,
                quality: { level: "HIGH" },
                reliability: "TRUSTED",
                reliabilityReasons: [],
              },
            },
            humanDecision: {
              family: "HUMAN_DECISION",
              status: "READY",
              selection: { effectiveScope: "USER", modelVersion: "affiliate-unified-v4:USER:7" },
              error: null,
              value: { wouldApprove: true, approvalProbability: 0.74, cutoff: 0.5 },
            },
          }),
        }),
      );

      const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

      expect(request?.message).toContain('"evidenceMode":"EXPECTED_SALES_TRUSTED"');
      expect(request?.message).toContain('"units":2.4');
      expect(request?.message).toContain('"percentile":61');
      expect(request?.message).toContain('"reliability":"TRUSTED"');
      expect(request?.message).toContain(
        '"selection":{"effectiveScope":"USER","modelVersion":"affiliate-unified-v4:USER:7"}',
      );
      expect(request?.message).toContain(
        "Treat Expected Sales as the primary commercial-value estimate",
      );
      expect(request?.message).not.toContain("humanDecision");
      expect(request?.message).not.toContain("wouldApprove");
      expect(request?.message).not.toContain("approvalProbability");
      expect(request?.message).not.toContain("merchantApprovalTendency");
      expect(request?.message).not.toContain("evaluatedScopes");
      expect(request?.message).not.toContain("requestedScope");
      expect(request?.message).not.toContain("tenant-scope-shop-001");
    });

    it("injects the frozen merchant approval tendency without Expected Sales numerics", () => {
      const workItem = createSampleReviewWorkItemWithEvidence(
        createWorkingAgendaPredictionEvidence({
          predictionEvidence: createCanonicalPredictionEvidence({
            evidenceMode: "MERCHANT_APPROVAL_TENDENCY",
            expectedSales: {
              family: "EXPECTED_SALES",
              status: "READY",
              selection: { effectiveScope: "SHOP", modelVersion: "affiliate-unified-v4:SHOP:3" },
              error: null,
              value: {
                units: 2.4,
                reliability: "DEGRADED",
                reliabilityReasons: [
                  "NESTED_CREATOR_CALIBRATION_MISSING",
                  "STATISTICAL_MAE_INFERIOR",
                ],
              },
            },
            humanDecision: {
              family: "HUMAN_DECISION",
              status: "READY",
              selection: { effectiveScope: "USER", modelVersion: "affiliate-hd-v2:USER:4" },
              error: null,
              value: {
                wouldApprove: true,
                approvalProbability: 0.74,
                approvalPercentile: 66,
                cutoff: 0.5,
                historicalApprovalRate: 0.68,
              },
            },
          }),
        }),
      );

      const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

      expect(request?.message).toContain('"evidenceMode":"MERCHANT_APPROVAL_TENDENCY"');
      expect(request?.message).toContain('"expectedSalesWithheld":true');
      expect(request?.message).toContain('"reliability":"DEGRADED"');
      expect(request?.message).toContain("NESTED_CREATOR_CALIBRATION_MISSING");
      expect(request?.message).toContain(
        '"merchantApprovalTendency":{"wouldApprove":true,"approvalProbability":0.74,"approvalPercentile":66,"cutoff":0.5,"historicalApprovalRate":0.68,"selection":{"effectiveScope":"USER","modelVersion":"affiliate-hd-v2:USER:4"}}',
      );
      expect(request?.message).toContain("商家历史审批倾向");
      expect(request?.message).toContain("NOT a sales prediction");
      expect(request?.message).toContain(
        "shop minimum Expected Sales reference does not apply",
      );
      expect(request?.message).not.toContain('"units"');
      expect(request?.message).not.toContain('"percentile"');
      expect(request?.message).not.toContain(
        "Treat Expected Sales as the primary commercial-value estimate",
      );
    });

    it("renders the frozen NO_MODEL_SIGNAL disclosure and still builds the run (cold start included)", () => {
      const workItem = createSampleReviewWorkItemWithEvidence(
        createWorkingAgendaPredictionEvidence({
          predictionEvidence: createCanonicalPredictionEvidence({
            evidenceMode: "NO_MODEL_SIGNAL",
            expectedSales: {
              family: "EXPECTED_SALES",
              status: "NOT_AVAILABLE",
              selection: null,
              error: null,
              value: null,
            },
            humanDecision: {
              family: "HUMAN_DECISION",
              status: "NOT_AVAILABLE",
              selection: null,
              error: null,
              value: null,
            },
          }),
        }),
      );

      const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

      expect(request).not.toBeNull();
      expect(request?.message).toContain('"evidenceMode":"NO_MODEL_SIGNAL"');
      expect(request?.message).toContain('"expectedSales":{"status":"NOT_AVAILABLE"}');
      expect(request?.message).toContain('"humanDecision":{"status":"NOT_AVAILABLE"}');
      expect(request?.message).toContain(
        "No prediction model signal is available for this evidence",
      );
      expect(request?.message).toContain("This is normal operation");
      expect(request?.message).toContain(
        "not by itself a reason to request staff review",
      );
      expect(request?.message).not.toContain('"units"');
      expect(request?.message).not.toContain("merchantApprovalTendency");
    });

    it("quotes the real recorded error code in MODEL_SIGNAL_ERROR and withholds all numerics", () => {
      const workItem = createSampleReviewWorkItemWithEvidence(
        createWorkingAgendaPredictionEvidence({
          predictionEvidence: createCanonicalPredictionEvidence({
            evidenceMode: "MODEL_SIGNAL_ERROR",
            expectedSales: {
              family: "EXPECTED_SALES",
              status: "READY",
              selection: { effectiveScope: "SHOP", modelVersion: "affiliate-unified-v4:SHOP:3" },
              error: null,
              value: {
                units: 2.4,
                reliability: "DEGRADED",
                reliabilityReasons: ["STATISTICAL_MAE_INFERIOR"],
              },
            },
            humanDecision: {
              family: "HUMAN_DECISION",
              status: "ERROR",
              selection: null,
              error: {
                code: "FEATURE_CONTRACT_ERROR",
                message: "HD feature contract hash mismatch.",
              },
              value: null,
            },
          }),
        }),
      );

      const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

      expect(request).not.toBeNull();
      expect(request?.message).toContain('"evidenceMode":"MODEL_SIGNAL_ERROR"');
      expect(request?.message).toContain('"expectedSalesWithheld":true');
      expect(request?.message).toContain('"code":"FEATURE_CONTRACT_ERROR"');
      expect(request?.message).toContain("HD feature contract hash mismatch.");
      expect(request?.message).toContain(
        "HUMAN_DECISION FEATURE_CONTRACT_ERROR: HD feature contract hash mismatch.",
      );
      expect(request?.message).toContain(
        "failed with the recorded error code shown in the evidence block",
      );
      expect(request?.message).not.toContain('"units"');
      expect(request?.message).not.toContain("normal operation");
      expect(request?.message).not.toContain("not an error");
      expect(request?.message).not.toContain(
        "not by itself a reason to request staff review",
      );
      expect(request?.message).not.toContain("merchantApprovalTendency");
    });

    it("fails fast when a status-OK snapshot has no canonical predictionEvidence", () => {
      const workItem = createSampleReviewWorkItemWithEvidence(
        createWorkingAgendaPredictionEvidence({ predictionEvidence: undefined }),
      );

      expect(() => buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" })).toThrow(
        /has no canonical predictionEvidence\.evidenceMode/,
      );
    });

    it("fails fast on an unknown frozen evidenceMode instead of re-deriving", () => {
      const workItem = createSampleReviewWorkItemWithEvidence(
        createWorkingAgendaPredictionEvidence({
          predictionEvidence: createCanonicalPredictionEvidence({
            evidenceMode: "SOME_FUTURE_MODE",
          }),
        }),
      );

      expect(() => buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" })).toThrow(
        /has no canonical predictionEvidence\.evidenceMode/,
      );
    });

    it("fails fast when MODEL_SIGNAL_ERROR carries no recorded family error", () => {
      const workItem = createSampleReviewWorkItemWithEvidence(
        createWorkingAgendaPredictionEvidence({
          predictionEvidence: createCanonicalPredictionEvidence({
            evidenceMode: "MODEL_SIGNAL_ERROR",
            expectedSales: {
              family: "EXPECTED_SALES",
              status: "NOT_AVAILABLE",
              selection: null,
              error: null,
              value: null,
            },
            humanDecision: {
              family: "HUMAN_DECISION",
              status: "NOT_AVAILABLE",
              selection: null,
              error: null,
              value: null,
            },
          }),
        }),
      );

      expect(() => buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" })).toThrow(
        /without any recorded family error/,
      );
    });

    it("keeps DATA_PATH_PASSTHROUGH for top-level request failures without requiring canonical evidence", () => {
      const workItem = createSampleReviewWorkItemWithEvidence(
        createWorkingAgendaPredictionEvidence({
          status: GQL.AffiliatePredictionStatus.DataNotReady,
          predictionEvidence: undefined,
          message: "Creator performance observation not ready.",
        }),
      );

      const request = buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" });

      expect(request?.message).toContain('"status":"DATA_NOT_READY"');
      expect(request?.message).toContain("Creator performance observation not ready.");
      expect(request?.message).not.toContain("evidenceMode");
      expect(request?.message).toContain(
        "unavailable because of a data-path, context, or service error",
      );
      expect(request?.message).toContain(
        "shop minimum Expected Sales reference does not apply",
      );
      expect(request?.message).not.toContain('"units"');
      expect(request?.message).not.toContain("merchantApprovalTendency");
      expect(request?.message).not.toContain(
        "Treat Expected Sales as the primary commercial-value estimate",
      );
    });

    it("never leaks scope-chain internals from canonical selections in any mode", () => {
      const chainSelection = {
        requestedScope: "SHOP",
        effectiveScope: "USER",
        modelVersion: {
          modelVersionKey: "affiliate-unified-v4:USER:7",
          bentomlTag: "affiliate_unified:abc123",
          trainingRunId: "training-run-001",
          contractHash: "hash-001",
          tenantId: "tenant-model-001",
        },
        evaluatedScopes: [
          {
            scope: "SHOP",
            tenantId: "tenant-scope-shop-001",
            artifactFound: true,
            reliability: "DEGRADED",
            reason: "SHOP_ARTIFACT_DEGRADED",
          },
          { scope: "USER", tenantId: "tenant-scope-user-001", artifactFound: true },
        ],
      };
      const evidenceByMode = [
        createWorkingAgendaPredictionEvidence({
          predictionEvidence: createCanonicalPredictionEvidence({
            expectedSales: {
              family: "EXPECTED_SALES",
              status: "READY",
              selection: chainSelection,
              error: null,
              value: { units: 2.4, reliability: "TRUSTED", reliabilityReasons: [] },
            },
          }),
        }),
        createWorkingAgendaPredictionEvidence({
          predictionEvidence: createCanonicalPredictionEvidence({
            evidenceMode: "MERCHANT_APPROVAL_TENDENCY",
            expectedSales: {
              family: "EXPECTED_SALES",
              status: "READY",
              selection: chainSelection,
              error: null,
              value: { reliability: "DEGRADED", reliabilityReasons: [] },
            },
            humanDecision: {
              family: "HUMAN_DECISION",
              status: "READY",
              selection: chainSelection,
              error: null,
              value: { wouldApprove: true, approvalProbability: 0.74 },
            },
          }),
        }),
        createWorkingAgendaPredictionEvidence({
          predictionEvidence: createCanonicalPredictionEvidence({
            evidenceMode: "MODEL_SIGNAL_ERROR",
            expectedSales: {
              family: "EXPECTED_SALES",
              status: "ERROR",
              selection: chainSelection,
              error: { code: "SERVICE_ERROR", message: "ES scoring service failed." },
              value: null,
            },
            humanDecision: {
              family: "HUMAN_DECISION",
              status: "ERROR",
              selection: chainSelection,
              error: { code: "SERVICE_ERROR", message: "HD scoring service failed." },
              value: null,
            },
          }),
        }),
      ];

      for (const evidence of evidenceByMode) {
        const request = buildAffiliateAgentRunRequest({
          workItem: createSampleReviewWorkItemWithEvidence(evidence),
          platform: "tiktok",
        });

        expect(request?.message).not.toContain("evaluatedScopes");
        expect(request?.message).not.toContain("requestedScope");
        expect(request?.message).not.toContain("tenant-scope-shop-001");
        expect(request?.message).not.toContain("tenant-scope-user-001");
        expect(request?.message).not.toContain("tenant-model-001");
        expect(request?.message).not.toContain("bentomlTag");
        expect(request?.message).not.toContain("trainingRunId");
        expect(request?.message).not.toContain("contractHash");
        expect(request?.message).not.toContain("artifactFound");
        expect(request?.message).not.toContain("SHOP_ARTIFACT_DEGRADED");
      }

      const trustedRequest = buildAffiliateAgentRunRequest({
        workItem: createSampleReviewWorkItemWithEvidence(evidenceByMode[0]!),
        platform: "tiktok",
      });
      expect(trustedRequest?.message).toContain(
        '"selection":{"effectiveScope":"USER","modelVersion":"affiliate-unified-v4:USER:7"}',
      );

      const errorRequest = buildAffiliateAgentRunRequest({
        workItem: createSampleReviewWorkItemWithEvidence(evidenceByMode[2]!),
        platform: "tiktok",
      });
      expect(errorRequest?.message).toContain(
        "EXPECTED_SALES SERVICE_ERROR: ES scoring service failed.; HUMAN_DECISION SERVICE_ERROR: HD scoring service failed.",
      );
    });
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
      productId: "product-001",
    };
    const secondAgenda = {
      ...firstAgenda,
      key: "affiliateCollaboration:collab-002:COMPLETE_COLLABORATION_TASK",
      shopId: "shop-002",
      shopRegion: "FR",
      productId: "product-002",
      campaignId: "campaign-002",
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
    expect(request?.message).toContain("Product ID: product-001");
    expect(request?.message).toContain("Product ID: product-002");
    expect(request?.message).toContain("Campaign ID: campaign-002");
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

  it("renders the frozen retryability of the last failed execution on the re-dispatched agenda", () => {
    const base = createCreatorReplyWorkItem();
    const agenda = {
      ...((base.creatorRelationship?.agendaItems ?? [])[0] as GQL.AffiliateRelationshipAgendaItem),
      lastFailedExecution: {
        proposalId: "proposal-failed-001",
        proposalType: GQL.ActionProposalType.ReviewSampleApplication,
        operatorSummary: "Approve sample application 123",
        failedAt: "2026-08-15T00:00:00.000Z",
        errorMessage: "TikTok API error 16022004: Create Trade Order Error",
        errorRetryability: GQL.TikTokPlatformErrorRetryability.NonRetryable,
        consecutiveFailureCount: 1,
        consecutiveFailureCountTruncated: false,
      } satisfies GQL.AffiliateFailedExecutionContext,
    };
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({ agentWorkingAgendaItems: [agenda] }),
      platform: "tiktok",
    });

    expect(request?.message).toContain("Previous Attempt On This Boundary: FAILED");
    expect(request?.message).toContain("Previous Attempt Proposal ID: proposal-failed-001");
    expect(request?.message).toContain("Previous Attempt Retryability: NON_RETRYABLE");
    expect(request?.message).toContain("16022004");
    expect(request?.message).toContain("Consecutive Failed Attempts On This Boundary: 1");
  });

  it("renders the spent attempt budget so the boundary retry bound is checkable", () => {
    const base = createCreatorReplyWorkItem();
    const agenda = {
      ...((base.creatorRelationship?.agendaItems ?? [])[0] as GQL.AffiliateRelationshipAgendaItem),
      lastFailedExecution: {
        proposalId: "proposal-failed-003",
        proposalType: GQL.ActionProposalType.ReviewSampleApplication,
        operatorSummary: "Approve sample application 123",
        failedAt: "2026-08-15T00:00:00.000Z",
        errorMessage: "TikTok API error 16032001: rate limited",
        errorRetryability: GQL.TikTokPlatformErrorRetryability.Retryable,
        consecutiveFailureCount: 3,
        consecutiveFailureCountTruncated: false,
      } satisfies GQL.AffiliateFailedExecutionContext,
    };
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({ agentWorkingAgendaItems: [agenda] }),
      platform: "tiktok",
    });

    expect(request?.message).toContain("Consecutive Failed Attempts On This Boundary: 3");
  });

  it("renders a scan-truncated attempt count as a floor, never as an exact figure", () => {
    const base = createCreatorReplyWorkItem();
    const agenda = {
      ...((base.creatorRelationship?.agendaItems ?? [])[0] as GQL.AffiliateRelationshipAgendaItem),
      lastFailedExecution: {
        proposalId: "proposal-failed-004",
        proposalType: GQL.ActionProposalType.ReviewSampleApplication,
        operatorSummary: "Approve sample application 123",
        failedAt: "2026-08-15T00:00:00.000Z",
        errorMessage: "TikTok API error 16032001: rate limited",
        errorRetryability: GQL.TikTokPlatformErrorRetryability.Retryable,
        consecutiveFailureCount: 20,
        consecutiveFailureCountTruncated: true,
      } satisfies GQL.AffiliateFailedExecutionContext,
    };
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({ agentWorkingAgendaItems: [agenda] }),
      platform: "tiktok",
    });

    expect(request?.message).toContain(
      "Consecutive Failed Attempts On This Boundary: at least 20",
    );
  });

  it("says plainly when a Backend older than the attempt count sent no number", () => {
    const base = createCreatorReplyWorkItem();
    const agenda = {
      ...((base.creatorRelationship?.agendaItems ?? [])[0] as GQL.AffiliateRelationshipAgendaItem),
      lastFailedExecution: {
        proposalId: "proposal-failed-005",
        proposalType: GQL.ActionProposalType.SendMessage,
        operatorSummary: "Reply to the creator",
        failedAt: "2026-08-15T00:00:00.000Z",
        errorMessage: "Message delivery failed",
        errorRetryability: GQL.TikTokPlatformErrorRetryability.Retryable,
        consecutiveFailureCount: null,
      } satisfies GQL.AffiliateFailedExecutionContext,
    };
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({ agentWorkingAgendaItems: [agenda] }),
      platform: "tiktok",
    });

    expect(request?.message).toContain(
      "Consecutive Failed Attempts On This Boundary: (attempt count unavailable)",
    );
  });

  it("says plainly when a failed attempt carries no producer-side classification", () => {
    const base = createCreatorReplyWorkItem();
    const agenda = {
      ...((base.creatorRelationship?.agendaItems ?? [])[0] as GQL.AffiliateRelationshipAgendaItem),
      lastFailedExecution: {
        proposalId: "proposal-failed-002",
        proposalType: GQL.ActionProposalType.SendMessage,
        operatorSummary: "Reply to the creator",
        failedAt: "2026-08-15T00:00:00.000Z",
        errorMessage: "Message delivery failed",
        errorRetryability: null,
      } satisfies GQL.AffiliateFailedExecutionContext,
    };
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({ agentWorkingAgendaItems: [agenda] }),
      platform: "tiktok",
    });

    expect(request?.message).toContain(
      "Previous Attempt Retryability: (no platform error was classified)",
    );
    expect(request?.message).not.toContain("Previous Attempt Retryability: UNKNOWN");
  });

  /**
   * The exact `sampleTerminalState` values the Backend freezes for these
   * endings, each transcribed from the assertion in
   * `AffiliateSampleTerminalFollowUp.test.ts` that pins it against the real
   * producer — the forced rejection from an APPROVE that TikTok refused
   * non-retryably, the other two from the Provider observation writer. Nothing
   * here is a triple this file invented: a fact statement is only worth
   * anything if it is attached to a shape a writer actually produces.
   *
   * A forced rejection and a Creator withdrawal share `CANCELLED`, so the work
   * status cannot tell the Agent them apart and only the cause can.
   */
  const PRODUCER_VERIFIED_TERMINAL_STATES = {
    [GQL.AffiliateSampleTerminalCause.PlatformForcedRejection]: {
      cause: GQL.AffiliateSampleTerminalCause.PlatformForcedRejection,
      sampleWorkStatus: GQL.SampleWorkStatus.Cancelled,
      platformStatus: "REJECT_CANCELLED",
    },
    [GQL.AffiliateSampleTerminalCause.ApprovalWindowExpired]: {
      cause: GQL.AffiliateSampleTerminalCause.ApprovalWindowExpired,
      sampleWorkStatus: GQL.SampleWorkStatus.Expired,
      platformStatus: "OVERDUE_CANCELLED",
    },
    [GQL.AffiliateSampleTerminalCause.CreatorWithdrew]: {
      cause: GQL.AffiliateSampleTerminalCause.CreatorWithdrew,
      sampleWorkStatus: GQL.SampleWorkStatus.Cancelled,
      platformStatus: "WITHDRAW_CANCELLED",
    },
  } as const satisfies Partial<
    Record<GQL.AffiliateSampleTerminalCause, GQL.AffiliateSampleTerminalStateContext>
  >;

  function terminalAgenda(
    sampleTerminalState: GQL.AffiliateSampleTerminalStateContext,
  ): GQL.AffiliateRelationshipAgendaItem {
    const base = createCreatorReplyWorkItem();
    return {
      ...((base.creatorRelationship?.agendaItems ?? [])[0] as GQL.AffiliateRelationshipAgendaItem),
      workKind: GQL.AffiliateWorkKind.SamplePlatformTerminalFollowUp,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.HandleSampleTerminalState,
      sampleApplicationRecordId: "sample-terminal-001",
      // A Sample-scoped agenda item always carries Backend evidence, and
      // dispatch refuses to start without it.
      predictionEvidence: createWorkingAgendaPredictionEvidence(),
      sampleTerminalState,
    };
  }

  function renderTerminalAgenda(
    sampleTerminalState: GQL.AffiliateSampleTerminalStateContext,
  ): string {
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({
        agentWorkingAgendaItems: [terminalAgenda(sampleTerminalState)],
      }),
      platform: "tiktok",
    });
    return request?.message ?? "";
  }

  /** The prose line for one layer, so two causes can be compared as text. */
  function terminalLine(message: string, label: string): string {
    const line = message.split("\n").find((candidate) => candidate.includes(`   ${label}: `));
    return line?.slice(line.indexOf(`${label}: `) + label.length + 2).trim() ?? "";
  }

  it("tells a rejection the platform forced apart from a Creator withdrawal", () => {
    const forced = renderTerminalAgenda(
      PRODUCER_VERIFIED_TERMINAL_STATES.PLATFORM_FORCED_REJECTION,
    );
    const withdrawn = renderTerminalAgenda(PRODUCER_VERIFIED_TERMINAL_STATES.CREATOR_WITHDREW);

    expect(forced).toContain("Sample Terminal Cause: PLATFORM_FORCED_REJECTION");
    expect(forced).toContain("Sample Terminal Work Status: CANCELLED");
    expect(forced).toContain("Sample Terminal Platform Status: REJECT_CANCELLED");
    expect(withdrawn).toContain("Sample Terminal Cause: CREATOR_WITHDREW");
    expect(withdrawn).not.toContain("PLATFORM_FORCED_REJECTION");
    // Both carry the same terminal work status; the cause is the whole signal.
    expect(withdrawn).toContain("Sample Terminal Work Status: CANCELLED");
  });

  /**
   * The defect this pair exists for. A live run given only
   * `HANDLE_SAMPLE_TERMINAL_STATE` and `SAMPLE_PLATFORM_TERMINAL_STATE`
   * contacted neither Creator: both lines name a state, and doing nothing is a
   * defensible way to handle a state. So the item has to say what happened and
   * what we suggest doing — and the two endings that share the least must not
   * share either sentence.
   */
  it("states a different fact and a different next step for a forced rejection than for an expiry", () => {
    const forced = renderTerminalAgenda(
      PRODUCER_VERIFIED_TERMINAL_STATES.PLATFORM_FORCED_REJECTION,
    );
    const expired = renderTerminalAgenda(
      PRODUCER_VERIFIED_TERMINAL_STATES.APPROVAL_WINDOW_EXPIRED,
    );

    const forcedFact = terminalLine(forced, "Sample Terminal Fact");
    const expiredFact = terminalLine(expired, "Sample Terminal Fact");
    const forcedStep = terminalLine(forced, "Sample Terminal Suggested Next Step");
    const expiredStep = terminalLine(expired, "Sample Terminal Suggested Next Step");

    for (const prose of [forcedFact, expiredFact, forcedStep, expiredStep]) {
      expect(prose.length).toBeGreaterThan(0);
    }
    expect(forcedFact).not.toBe(expiredFact);
    expect(forcedStep).not.toBe(expiredStep);

    // The facts, stated rather than left to be inferred from the enum name.
    expect(forcedFact).toContain("refused the review call");
    expect(forcedFact).toContain("not a judgement");
    expect(expiredFact).toContain("approval window lapsed");
    expect(expiredFact).toContain("never judged");
    // Neither fact may claim we had approved: the frozen record does not carry
    // which decision the platform blocked.
    expect(forcedFact).toContain("do not tell the Creator we had approved them");

    // The suggestions, phrased as suggestions.
    expect(forcedStep).toContain("Contact the Creator");
    expect(expiredStep).toContain("Contact the Creator");
    expect(forcedStep).toContain("error on our side");
    expect(expiredStep).toContain("acknowledge the lapse");
  });

  it("says so explicitly when it does not suggest contacting the Creator", () => {
    const withdrawn = renderTerminalAgenda(PRODUCER_VERIFIED_TERMINAL_STATES.CREATOR_WITHDREW);

    expect(terminalLine(withdrawn, "Sample Terminal Fact")).toContain(
      "withdrew this application themselves",
    );
    // An absent action layer would read as an oversight and put the Agent back
    // to inferring, so silence has to be stated.
    expect(terminalLine(withdrawn, "Sample Terminal Suggested Next Step")).toContain(
      "No outreach about this application",
    );
  });

  it("tells an expiry apart from a rejection the platform forced", () => {
    const expired = renderTerminalAgenda(
      PRODUCER_VERIFIED_TERMINAL_STATES.APPROVAL_WINDOW_EXPIRED,
    );

    expect(expired).toContain("Sample Terminal Cause: APPROVAL_WINDOW_EXPIRED");
    expect(expired).toContain("Sample Terminal Work Status: EXPIRED");
    expect(expired).toContain("Sample Terminal Platform Status: OVERDUE_CANCELLED");
    expect(expired).not.toContain("PLATFORM_FORCED_REJECTION");
  });

  /**
   * Coverage is read from the Backend's own schema artifact rather than from a
   * list kept here, because a cause added there and missed here is exactly the
   * regression this asserts against: the Agent would receive a bare identifier
   * and be back to inferring its next step for that ending. The same artifact
   * already backs `affiliate-graphql-contract.test.ts`.
   */
  it("states a distinct fact and next step for every cause the Backend can freeze", () => {
    const schema = readFileSync(
      new URL("../../../../server/backend/schema.graphql", import.meta.url),
      "utf8",
    );
    const block = /enum AffiliateSampleTerminalCause \{([^}]*)\}/.exec(schema);
    const schemaCauses = (block?.[1] ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    expect(schemaCauses.length).toBeGreaterThan(0);
    expect([...schemaCauses].sort()).toEqual(
      [...Object.values(GQL.AffiliateSampleTerminalCause)].sort(),
    );

    const facts = new Map<string, string>();
    const steps = new Map<string, string>();
    for (const cause of schemaCauses as GQL.AffiliateSampleTerminalCause[]) {
      const message = renderTerminalAgenda({
        cause,
        // Provenance only; the prose is keyed off the cause alone.
        sampleWorkStatus: GQL.SampleWorkStatus.Cancelled,
        platformStatus: null,
      });
      const fact = terminalLine(message, "Sample Terminal Fact");
      const step = terminalLine(message, "Sample Terminal Suggested Next Step");
      expect(fact, `${cause} states no fact`).not.toBe("");
      expect(step, `${cause} suggests no next step`).not.toBe("");
      facts.set(cause, fact);
      steps.set(cause, step);
    }

    // Shared prose would mean one of the causes is being described by another
    // cause's ending, which is the failure the fact layer exists to prevent.
    expect(new Set(facts.values()).size).toBe(facts.size);
    expect(new Set(steps.values()).size).toBe(steps.size);
  });

  it("forbids inventing a reason when the platform did not record one", () => {
    const undetermined = renderTerminalAgenda({
      cause: GQL.AffiliateSampleTerminalCause.Undetermined,
      sampleWorkStatus: GQL.SampleWorkStatus.Cancelled,
      platformStatus: "CONTENT_PENDING",
    });

    expect(undetermined).toContain("Sample Terminal Cause: UNDETERMINED");
    expect(undetermined).toContain(
      "Never state or imply a reason to the Creator.",
    );
    // The disclosure belongs to UNDETERMINED alone; a known cause must not
    // carry an instruction telling the Agent to withhold it.
    expect(
      renderTerminalAgenda({
        cause: GQL.AffiliateSampleTerminalCause.ApprovalWindowExpired,
        sampleWorkStatus: GQL.SampleWorkStatus.Expired,
        platformStatus: "OVERDUE_CANCELLED",
      }),
    ).not.toContain("Terminal Cause Disclosure");
  });

  it("says the platform status is unavailable rather than omitting the line", () => {
    const message = renderTerminalAgenda({
      cause: GQL.AffiliateSampleTerminalCause.ApprovalWindowExpired,
      sampleWorkStatus: GQL.SampleWorkStatus.Expired,
      platformStatus: null,
    });

    expect(message).toContain("Sample Terminal Platform Status: (unavailable)");
  });

  it("renders no terminal lines on agenda work that is not a terminal follow-up", () => {
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem(),
      platform: "tiktok",
    });

    expect(request?.message).not.toContain("Sample Terminal Cause:");
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
    expect(request?.message).toContain("The routing shop selects a device/session only");
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
      agentWorkingAgendaItems: [
        {
          ...(baseWorkItem.creatorRelationship?.agendaItems ?? [])[0]!,
          predictionEvidence: null,
        },
      ],
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
        triggerId: "sample-record-001",
        sampleApplicationRecordId: "sample-record-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
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
        routingShopId: "shop-001",
        platformShopId: "platform-shop-001",
        creatorRelationshipId: "relationship-001",
        triggerKind: AffiliateTriggerKind.CREATOR_MESSAGE,
        triggerId: "conversation-001",
        affiliateCollaborationId: "collab-001",
        creatorId: "creator-001",
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
        routingShopId: "shop-001",
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

  it("refuses to synthesize a legacy agenda for an actionable WorkItem", () => {
    const workItem = createSampleReviewWorkItem({ agentWorkingAgendaItems: [] });

    expect(() => buildAffiliateAgentRunRequest({ workItem, platform: "tiktok" })).toThrow(
      "refuse legacy context synthesis",
    );
  });

  it("builds a generic relationship run for any other Agent-owned agenda", () => {
    const workItem = createSampleReviewWorkItem({
      agentDispatchRecommended: true,
      workKind: GQL.AffiliateWorkKind.ManualReview,
      workBundleKind: GQL.AffiliateWorkBundleKind.GeneralReview,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.CompleteCollaborationTask,
      processReasons: [],
      recommendedActionTypes: [],
      agentWorkingAgendaItems: createSampleReviewWorkItem().agentWorkingAgendaItems.map((item) => ({
        ...item,
        workKind: GQL.AffiliateWorkKind.ManualReview,
        reasons: [],
      })),
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
      agentWorkingAgendaItems: createCreatorReplyWorkItem().agentWorkingAgendaItems.map((item) => ({
        ...item,
        workKind: GQL.AffiliateWorkKind.CreatorFollowUp,
        requiredAction: GQL.AffiliateRelationshipRequiredAction.FollowUpCreator,
        reasons: [GQL.AffiliateWorkProcessReason.CreatorActionFollowUpDue],
      })),
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
      agentWorkingAgendaItems: createCreatorReplyWorkItem().agentWorkingAgendaItems.map((item) => ({
        ...item,
        workKind: GQL.AffiliateWorkKind.ContentFollowUp,
        requiredAction: GQL.AffiliateRelationshipRequiredAction.FollowUpCreator,
        reasons: [GQL.AffiliateWorkProcessReason.SampleContentFollowUpDue],
      })),
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
      agentWorkingAgendaItems: createCreatorReplyWorkItem().agentWorkingAgendaItems.map((item) => ({
        ...item,
        reasons: [
          GQL.AffiliateWorkProcessReason.CreatorMessageNeedsHandling,
          GQL.AffiliateWorkProcessReason.SamplePendingReview,
        ],
      })),
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

describe("affiliate containment startup proof", () => {
  /**
   * The containment filter, the concurrency ceiling and the prompt-debug flag are
   * all resolved once at module load, so each case re-imports the module under a
   * fresh environment. That also proves the value survived into the process
   * rather than merely existing in the launching shell.
   */
  async function captureContainmentStartupLog(): Promise<{
    level: "info" | "warn";
    line: string;
  }> {
    vi.resetModules();
    loggerMocks.clear();
    const { AffiliateInbound: FreshAffiliateInbound } = await import("./affiliate-inbound.js");
    const logger = loggerMocks.get("affiliate-inbound");

    new FreshAffiliateInbound("en");

    const lines = [
      ...logger.info.mock.calls.map((call) => ({ level: "info" as const, line: String(call[0]) })),
      ...logger.warn.mock.calls.map((call) => ({ level: "warn" as const, line: String(call[0]) })),
    ].filter((entry) => entry.line.startsWith("Affiliate containment startup"));

    expect(lines).toHaveLength(1);
    return lines[0];
  }

  beforeEach(() => {
    vi.stubEnv("RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS", undefined);
    vi.stubEnv("RIVONCLAW_MAX_ACTIVE_AFFILIATE_AGENT_RUNS", undefined);
    vi.stubEnv("DEBUG_AFFILIATE_PROMPT", undefined);
    vi.stubEnv("RIVONCLAW_DEBUG_AFFILIATE_PROMPT", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("proves the exact live-test cohort and derived concurrency the process applied", async () => {
    vi.stubEnv(
      "RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS",
      " relationship-b , relationship-a ,relationship-b",
    );

    const { level, line } = await captureContainmentStartupLog();

    expect(level).toBe("info");
    expect(line).toContain("liveTestFilter=active");
    expect(line).toContain("relationshipIdCount=2");
    expect(line).toContain("relationshipIds=relationship-a,relationship-b");
    expect(line).toContain("maxActiveAffiliateAgentRuns=2");
    expect(line).toContain("debugFullPrompt=false");
  });

  it("reports an explicit Agent pool override alongside the cohort", async () => {
    vi.stubEnv("RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS", "relationship-a");
    vi.stubEnv("RIVONCLAW_MAX_ACTIVE_AFFILIATE_AGENT_RUNS", "5");

    const { line } = await captureContainmentStartupLog();

    expect(line).toContain("relationshipIdCount=1");
    expect(line).toContain("relationshipIds=relationship-a");
    expect(line).toContain("maxActiveAffiliateAgentRuns=5");
  });

  it("warns loudly when no live-test containment filter reached the process", async () => {
    const { level, line } = await captureContainmentStartupLog();

    expect(level).toBe("warn");
    expect(line).toContain("liveTestFilter=absent");
    expect(line).toContain("relationshipIdCount=0");
    expect(line).toContain("maxActiveAffiliateAgentRuns=1");
    expect(line).toContain("RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS is not set");
    expect(line).toContain("every Affiliate work item is dispatchable");
    expect(line).not.toContain("liveTestFilter=active");
  });

  it("treats a blank containment filter as absent rather than active", async () => {
    vi.stubEnv("RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS", " , ");

    const { level, line } = await captureContainmentStartupLog();

    expect(level).toBe("warn");
    expect(line).toContain("liveTestFilter=absent");
  });

  it("reports the resolved full-prompt debug state", async () => {
    vi.stubEnv("RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS", "relationship-a");
    vi.stubEnv("DEBUG_AFFILIATE_PROMPT", "1");

    expect((await captureContainmentStartupLog()).line).toContain("debugFullPrompt=true");

    vi.stubEnv("DEBUG_AFFILIATE_PROMPT", undefined);
    vi.stubEnv("RIVONCLAW_DEBUG_AFFILIATE_PROMPT", "1");

    expect((await captureContainmentStartupLog()).line).toContain("debugFullPrompt=true");
  });

  it("emits the containment proof on a single greppable line", async () => {
    vi.stubEnv("RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS", "relationship-a,relationship-b");

    expect((await captureContainmentStartupLog()).line).not.toContain("\n");
    vi.stubEnv("RIVONCLAW_AFFILIATE_LIVE_TEST_RELATIONSHIP_IDS", undefined);
    expect((await captureContainmentStartupLog()).line).not.toContain("\n");
  });
});

describe("Provider-terminal sample follow-up dispatch mapping", () => {
  function createTerminalFollowUpWorkItem(): GQL.AffiliateWorkItem {
    const base = createSampleReviewWorkItem();
    return {
      ...base,
      workKind: GQL.AffiliateWorkKind.SamplePlatformTerminalFollowUp,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.HandleSampleTerminalState,
      processReasons: [GQL.AffiliateWorkProcessReason.SamplePlatformTerminalState],
      agentWorkingAgendaItems: (base.agentWorkingAgendaItems ?? []).map((item) => ({
        ...item,
        workKind: GQL.AffiliateWorkKind.SamplePlatformTerminalFollowUp,
        requiredAction: GQL.AffiliateRelationshipRequiredAction.HandleSampleTerminalState,
        reasons: [GQL.AffiliateWorkProcessReason.SamplePlatformTerminalState],
      })),
    };
  }

  function buildContext(workItem: GQL.AffiliateWorkItem) {
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
    const shop = (inbound as any).shopContexts.get("platform-shop-001");
    return (inbound as any).buildContextFromWorkItem(shop, workItem);
  }

  it("anchors the run on the closed Sample Application", () => {
    expect(buildContext(createTerminalFollowUpWorkItem())).toMatchObject({
      triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
      triggerId: "sample-record-001",
      sampleApplicationRecordId: "sample-record-001",
      creatorRelationshipId: "relationship-001",
    });
  });

  it("still anchors on the Sample Application when only the work kind is known", () => {
    const workItem = {
      ...createTerminalFollowUpWorkItem(),
      requiredAction: GQL.AffiliateRelationshipRequiredAction.NoAction,
    };
    expect(buildContext(workItem)).toMatchObject({
      triggerKind: AffiliateTriggerKind.SAMPLE_APPLICATION,
      triggerId: "sample-record-001",
    });
  });
});

/**
 * The seller-commitment line on Sample work.
 *
 * It replaced `workSummary.activeCollaborationCount`, a Relationship-level
 * number that summed active Samples and active Collaborations and reported the
 * total as a Collaboration count. A live run was shown `1` beside an empty
 * collaboration id list, correctly called it a contradiction, and escalated a
 * Sample it could have decided.
 *
 * Backend decides the three states; that the producer actually emits all three
 * is proved against real writers in
 * `server/backend/src/ecommerce/affiliate/services/AffiliateTargetCollaborationCoverage.test.ts`.
 * What is at stake here is only that Desktop renders them apart — above all
 * that null is not shown to the Agent as "no".
 */
describe("Target Collaboration coverage in the Working Agenda", () => {
  function renderCoverage(
    hasTargetCollaboration: boolean | null,
    itemOverrides: Partial<GQL.AffiliateRelationshipAgendaItem> = {},
  ): string {
    const base = createCreatorReplyWorkItem();
    const agendaItem = (base.creatorRelationship?.agendaItems ?? [])[0] as
      GQL.AffiliateRelationshipAgendaItem;
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({
        agentWorkingAgendaItems: [{
          ...agendaItem,
          workKind: GQL.AffiliateWorkKind.SampleApplicationDecision,
          requiredAction:
            GQL.AffiliateRelationshipRequiredAction.ReviewSampleApplication,
          sampleApplicationRecordId: "sample-coverage-001",
          productId: "product-under-review",
          predictionEvidence: createWorkingAgendaPredictionEvidence(),
          hasTargetCollaboration,
          ...itemOverrides,
        }],
      }),
      platform: "tiktok",
    });
    return request?.message ?? "";
  }

  const LABEL = "Seller Target Collaboration For This Product";

  it("states the commitment as present when the Backend answered yes", () => {
    const message = renderCoverage(true);

    expect(message).toContain(`${LABEL}: YES`);
    expect(message).toContain("active Target Collaboration covers this shop, this Creator and this product");
    expect(message).not.toContain(`${LABEL}: NO`);
    expect(message).not.toContain(`${LABEL}: UNKNOWN`);
  });

  /**
   * A "no" here rules out the structured invitation only. A seller who invited
   * the Creator in conversation leaves no Collaboration behind, so the line
   * must not read as "the seller never invited them".
   */
  it("scopes a no to the structured invitation", () => {
    const message = renderCoverage(false);

    expect(message).toContain(`${LABEL}: NO`);
    expect(message).toContain("rules out only the structured invitation");
    expect(message).not.toContain(`${LABEL}: YES`);
  });

  /**
   * The whole point of the field being nullable. The seller rule keys on a
   * commitment being PRESENT, so an unanswered question rendered as "no" would
   * push the Agent toward wrongly refusing — the same class of error as the
   * count it replaced.
   */
  it("renders an unanswered question as its own state and never as a no", () => {
    const message = renderCoverage(null, { productId: null });

    expect(message).toContain(`${LABEL}: UNKNOWN`);
    expect(message).toContain("UNKNOWN is not NO");
    expect(message).not.toContain(`${LABEL}: NO`);
    expect(message).not.toContain(`${LABEL}: YES`);
  });

  it("stays silent on non-Sample work the Backend did not answer for", () => {
    const message = renderCoverage(null, {
      workKind: GQL.AffiliateWorkKind.InboundMessageTriage,
      requiredAction: GQL.AffiliateRelationshipRequiredAction.HandleCreatorMessage,
      sampleApplicationRecordId: null,
      productId: null,
      predictionEvidence: null,
    });

    expect(message).toContain("[Agent Working Agenda]");
    expect(message).not.toContain(LABEL);
  });
});

/**
 * The shop's own minimum expected-sales reference on Sample review work.
 *
 * The workflow requires a decision that turns on a low estimate to state the
 * estimate, the reference and the gap. The reference had no path to the Agent
 * at all: a live run was handed an agenda without it, correctly refused to
 * assert a shortfall it could not cite, and escalated to a human.
 *
 * Backend freezes which of the three states applies, and that the real
 * producers emit them per owning shop is proved in
 * `server/backend/src/ecommerce/affiliate/services/AffiliateShopMinExpectedSalesReference.test.ts`.
 * What is at stake here is that Desktop renders them apart — above all that an
 * absent reference never reaches the Agent as a number, and that a shop with no
 * standard is never confused with a reference we failed to read.
 */
describe("Shop minimum expected sales reference in the Working Agenda", () => {
  function renderReference(
    minExpectedSalesReference: GQL.AffiliateMinExpectedSalesReference | null,
    itemOverrides: Partial<GQL.AffiliateRelationshipAgendaItem> = {},
  ): string {
    const base = createCreatorReplyWorkItem();
    const agendaItem = (base.creatorRelationship?.agendaItems ?? [])[0] as
      GQL.AffiliateRelationshipAgendaItem;
    const request = buildAffiliateAgentRunRequest({
      workItem: createCreatorReplyWorkItem({
        agentWorkingAgendaItems: [{
          ...agendaItem,
          workKind: GQL.AffiliateWorkKind.SampleApplicationDecision,
          requiredAction:
            GQL.AffiliateRelationshipRequiredAction.ReviewSampleApplication,
          sampleApplicationRecordId: "sample-reference-001",
          productId: "product-under-review",
          predictionEvidence: createWorkingAgendaPredictionEvidence(),
          minExpectedSalesReference,
          ...itemOverrides,
        }],
      }),
      platform: "tiktok",
    });
    return request?.message ?? "";
  }

  const LABEL = "Shop Minimum Expected Sales Reference";

  it("states the configured reference as a number the Agent can compare against", () => {
    const message = renderReference({
      availability: GQL.AffiliateShopReferenceAvailability.Configured,
      units: 2.5,
    });

    expect(message).toContain(`${LABEL}: 2.5 units`);
    expect(message).toContain("configured reference for this agenda item's own shop");
    expect(message).not.toContain(`${LABEL}: NOT CONFIGURED`);
    expect(message).not.toContain(`${LABEL}: UNAVAILABLE`);
  });

  /**
   * The unconfigured shop — 63 of 64 in production today. It has to arrive as
   * an answer in its own words, not as a missing line and not as a number: a
   * substituted default would drive real Sample rejections against a figure the
   * seller never set.
   */
  it("renders an unconfigured shop as an explicit answer carrying no number", () => {
    const message = renderReference({
      availability: GQL.AffiliateShopReferenceAvailability.NotConfigured,
      units: null,
    });

    expect(message).toContain(`${LABEL}: NOT CONFIGURED`);
    expect(message).toContain("no minimum expected sales reference set by the seller");
    expect(message).toContain("Never substitute a default");
    expect(message).not.toContain(`${LABEL}: UNAVAILABLE`);
    expect(message).not.toMatch(new RegExp(`${LABEL}: [0-9]`));
  });

  /**
   * The distinction the whole field exists for. An unread shop is a missing
   * fact; a shop without a standard is a business answer. Collapsing them is
   * what left the earlier run unable to tell whether the seller had no rule or
   * the number simply had not arrived.
   */
  it("keeps an unresolved shop apart from a shop that set no standard", () => {
    const message = renderReference({
      availability: GQL.AffiliateShopReferenceAvailability.ShopUnresolved,
      units: null,
    });

    expect(message).toContain(`${LABEL}: UNAVAILABLE`);
    expect(message).toContain("missing fact, not a shop without a standard");
    expect(message).toContain("Do not treat it as NOT CONFIGURED");
    expect(message).not.toContain(`${LABEL}: NOT CONFIGURED`);
    expect(message).not.toMatch(new RegExp(`${LABEL}: [0-9]`));
  });

  /**
   * A Backend that predates the field. Silence would read as "no reference
   * exists", which is a claim this Desktop cannot make.
   */
  it("says the reference never arrived when the Backend sent none", () => {
    const message = renderReference(null);

    expect(message).toContain(`${LABEL}: UNAVAILABLE`);
    expect(message).toContain("did not send the shop reference at all");
    expect(message).not.toContain(`${LABEL}: NOT CONFIGURED`);
  });

  it("refuses to render a configured reference that carries no units", () => {
    expect(() => renderReference({
      availability: GQL.AffiliateShopReferenceAvailability.Configured,
      units: null,
    })).toThrow(/CONFIGURED shop minimum expected sales reference with no units/);
  });

  it("stays silent on work that is not a Sample review", () => {
    const message = renderReference(
      {
        availability: GQL.AffiliateShopReferenceAvailability.NotConfigured,
        units: null,
      },
      {
        workKind: GQL.AffiliateWorkKind.InboundMessageTriage,
        requiredAction: GQL.AffiliateRelationshipRequiredAction.HandleCreatorMessage,
        sampleApplicationRecordId: null,
        productId: null,
        predictionEvidence: null,
      },
    );

    expect(message).toContain("[Agent Working Agenda]");
    expect(message).not.toContain(LABEL);
  });
});
