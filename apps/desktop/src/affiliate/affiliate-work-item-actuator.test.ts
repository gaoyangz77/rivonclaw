import { beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import { rootStore } from "../app/store/desktop-store.js";
import { handleAffiliateWorkItemChanged } from "./affiliate-work-item-actuator.js";

const mockHandleAffiliateWorkItemChanged = vi.fn();

vi.mock("@rivonclaw/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@rivonclaw/logger")>();
  return {
    ...actual,
    createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  };
});

vi.mock("../gateway/connection.js", () => ({
  getCsBridge: () => ({
    handleAffiliateWorkItemChanged: mockHandleAffiliateWorkItemChanged,
  }),
}));

describe("affiliate work item actuator", () => {
  beforeEach(() => {
    mockHandleAffiliateWorkItemChanged.mockReset();
    rootStore.clearCloudEntities();
  });

  it("ingests the creator relationship owner from relationship work items", async () => {
    rootStore.ingestGraphQLResponse({
      shops: [{
        id: "shop-001",
        platform: "TIKTOK_SHOP",
        platformAppId: "app-001",
        platformShopId: "platform-shop-001",
        shopName: "Shop 1",
        alias: null,
        authStatus: "AUTHORIZED",
        region: "US",
        accessTokenExpiresAt: null,
        refreshTokenExpiresAt: null,
        services: {
          customerService: null,
          wms: null,
          affiliateService: {
            enabled: true,
            csDeviceId: "device-001",
            runProfileId: "AFFILIATE_OPERATOR",
            businessPrompt: null,
            modelUsageScope: "USER_LEVEL",
            decisionThresholds: null,
          },
        },
      }],
    });

    await handleAffiliateWorkItemChanged("device-001", {
      id: "work-001",
      shopId: "shop-001",
      platformShopId: "platform-shop-001",
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
      processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.AgentRequired,
      requiredAction: GQL.AffiliateCollaborationRequiredAction.ReviewSampleApplication,
      processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview],
      recommendedActionTypes: [GQL.ActionProposalType.ReviewSampleApplication],
      versionAt: "2026-05-11T00:01:00.000Z",
      creatorRelationship: {
        id: "relationship-001",
        userId: "user-001",
        creatorId: "creator-001",
        processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.AgentRequired,
        requiredAction: GQL.AffiliateCollaborationRequiredAction.ReviewSampleApplication,
        processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview],
        activeCollaborationRecordIds: ["collab-001"],
        pendingActionProposalId: null,
        shopStates: [],
        whatsappContacts: [],
        emailContacts: [],
        blocked: false,
        blockedShopIds: [],
        stateUpdatedAt: "2026-05-11T00:01:00.000Z",
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:01:00.000Z",
      } as any,
      collaboration: {
        id: "collab-001",
        userId: "user-001",
        shopId: "shop-001",
        creatorRelationshipId: "relationship-001",
        creatorId: "creator-001",
        lifecycleStage: "SAMPLE",
        processingStatus: GQL.AffiliateCollaborationRecordProcessingStatus.AgentRequired,
        requiredAction: GQL.AffiliateCollaborationRequiredAction.ReviewSampleApplication,
        processReasons: [GQL.AffiliateCollaborationRecordProcessReason.SamplePendingReview],
        stateUpdatedAt: "2026-05-11T00:01:00.000Z",
        startedAt: "2026-05-11T00:00:00.000Z",
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:01:00.000Z",
        predictionSnapshots: [],
      } as any,
      sampleApplicationRecord: null,
      latestPendingProposal: null,
      context: {
        creatorProfile: null,
        creatorRelation: null,
        activeCollaborations: [],
        ambiguousCollaborationCandidates: [],
        focusCollaboration: null,
        pendingProposals: [],
        recommendedActionTypes: [GQL.ActionProposalType.ReviewSampleApplication],
        relatedSampleApplications: [],
        missingContext: [],
      },
    } as any);

    expect(rootStore.affiliateWorkspace.getCreatorRelationship("relationship-001")?.creatorId)
      .toBe("creator-001");
    expect(rootStore.affiliateWorkspace.relationshipProjection("relationship-001")?.collaborationRecords)
      .toHaveLength(1);
    expect(mockHandleAffiliateWorkItemChanged).toHaveBeenCalledOnce();
  });
});
