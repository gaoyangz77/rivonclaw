import { describe, expect, it } from "vitest";
import { AffiliateWorkspaceModel } from "./Affiliate.js";

const NOW = "2026-08-02T00:00:00.000Z";

function relationship(overrides: Record<string, unknown> = {}) {
  return {
    id: "relationship-1",
    userId: "user-1",
    creatorId: "creator-1",
    blocked: false,
    blockedShopIds: [],
    activeAffiliateCollaborationIds: ["collaboration-1"],
    activeSampleApplicationRecordIds: ["sample-1"],
    shopStates: [{ shopId: "shop-1", tagIds: [] }],
    operationalConfigRevision: 1,
    stateUpdatedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function collaboration(overrides: Record<string, unknown> = {}) {
  return {
    id: "collaboration-1",
    userId: "user-1",
    shopId: "shop-1",
    creatorIds: ["creator-1"],
    creatorOpenIds: ["open-1"],
    productIds: ["product-1"],
    type: "TARGET",
    status: "ACTIVE",
    platformCollaborationId: "platform-collaboration-1",
    firstObservedAt: NOW,
    lastObservedAt: NOW,
    lastSyncSource: "AIRFLOW_RECONCILE",
    projectionRevision: 1,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function sample(overrides: Record<string, unknown> = {}) {
  return {
    id: "sample-1",
    userId: "user-1",
    shopId: "shop-1",
    creatorId: "creator-1",
    creatorRelationshipId: "relationship-1",
    productId: "product-1",
    affiliateCollaborationId: "collaboration-1",
    platformApplicationId: "application-1",
    platformCollaborationId: "platform-collaboration-1",
    sampleWorkStatus: "REQUEST_PENDING_REVIEW",
    observedContentCount: 0,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("AffiliateWorkspaceModel", () => {
  it("stores canonical platform collaborations without creator-expanded records", () => {
    const workspace = AffiliateWorkspaceModel.create({});
    workspace.ingestAffiliateWorkspace({
      creatorRelations: [relationship()],
      creatorProfiles: [{ id: "creator-1", nickname: "Creator", createdAt: NOW, updatedAt: NOW }],
      affiliateCollaborations: [collaboration()],
      sampleApplicationRecords: [sample()],
      actionProposals: [],
    } as any);

    expect(workspace.affiliateCollaborations).toHaveLength(1);
    expect(workspace.getCollaboration("collaboration-1")?.platformCollaborationId)
      .toBe("platform-collaboration-1");
    expect("collaborationRecords" in workspace).toBe(false);
  });

  it("projects relationship context from canonical active ids", () => {
    const workspace = AffiliateWorkspaceModel.create({});
    workspace.ingestAffiliateWorkspace({
      creatorRelations: [relationship()],
      creatorProfiles: [{ id: "creator-1", nickname: "Creator", createdAt: NOW, updatedAt: NOW }],
      affiliateCollaborations: [collaboration()],
      sampleApplicationRecords: [sample()],
      actionProposals: [],
    } as any);

    const projection = workspace.relationshipProjection("relationship-1");
    expect(projection?.affiliateCollaborations.map((item) => item.id)).toEqual(["collaboration-1"]);
    expect(projection?.sampleApplications.map((item) => item.id)).toEqual(["sample-1"]);
    expect(projection?.creatorProfile?.nickname).toBe("Creator");
  });

  it("hydrates proposal display context from canonical entities", () => {
    const workspace = AffiliateWorkspaceModel.create({});
    workspace.ingestAffiliateWorkspace({
      creatorRelations: [relationship()],
      creatorProfiles: [{ id: "creator-1", nickname: "Creator", createdAt: NOW, updatedAt: NOW }],
      affiliateCollaborations: [collaboration()],
      sampleApplicationRecords: [sample()],
      actionProposals: [{
        id: "proposal-1",
        userId: "user-1",
        focusShopId: "shop-1",
        creatorId: "creator-1",
        creatorRelationshipId: "relationship-1",
        affiliateCollaborationId: "collaboration-1",
        sampleApplicationRecordId: "sample-1",
        productId: "product-1",
        type: "REVIEW_SAMPLE_APPLICATION",
        status: "PENDING",
        operatorSummary: "Review sample",
        steps: [],
        createdAt: NOW,
        updatedAt: NOW,
      }],
    } as any);

    const projection = workspace.proposalProjection("proposal-1");
    expect(projection?.affiliateCollaboration?.id).toBe("collaboration-1");
    expect(projection?.sampleApplicationRecord?.id).toBe("sample-1");
    expect(projection?.creatorRelationship?.id).toBe("relationship-1");
  });

  it("merges partial proposal updates without dropping display context", () => {
    const workspace = AffiliateWorkspaceModel.create({});
    workspace.upsertAffiliateActionProposal({
      id: "proposal-1",
      userId: "user-1",
      focusShopId: "shop-1",
      creatorRelationshipId: "relationship-1",
      type: "SEND_MESSAGE",
      status: "PENDING",
      operatorSummary: "Send a reply",
      steps: [],
      affiliateCollaboration: collaboration(),
      creatorRelationship: relationship(),
      creatorProfile: { id: "creator-1", nickname: "Creator", createdAt: NOW, updatedAt: NOW },
      createdAt: NOW,
      updatedAt: NOW,
    } as any);
    workspace.upsertAffiliateActionProposal({
      id: "proposal-1",
      status: "APPROVED",
      updatedAt: "2026-08-02T00:01:00.000Z",
    } as any);

    const projection = workspace.proposalProjection("proposal-1");
    expect(projection?.proposal.status).toBe("APPROVED");
    expect(projection?.proposal.operatorSummary).toBe("Send a reply");
    expect(projection?.affiliateCollaboration?.id).toBe("collaboration-1");
  });

  it("retains compact Creator metrics on Agent work proposals", () => {
    const workspace = AffiliateWorkspaceModel.create({});
    workspace.upsertAffiliateActionProposal({
      id: "proposal-1",
      creatorFollowerCount: 105_800,
      creatorAverageVideoViews: 835,
      creatorEngagementRate: 0.0166,
      creatorShoppableVideoCount: 14,
      createdAt: NOW,
      updatedAt: NOW,
    } as any);

    const proposal = workspace.proposalProjection("proposal-1")?.proposal;
    expect(proposal?.creatorFollowerCount).toBe(105_800);
    expect(proposal?.creatorAverageVideoViews).toBe(835);
    expect(proposal?.creatorEngagementRate).toBe(0.0166);
    expect(proposal?.creatorShoppableVideoCount).toBe(14);
  });

  it("normalizes BD ownership, operational settings, and outreach accounts", () => {
    const workspace = AffiliateWorkspaceModel.create({});
    workspace.replaceAffiliateBusinessDevelopers([{
      id: "bd-1", userId: "user-1", displayName: "Maria Internal",
      creatorDisplayName: "Maria", regions: ["US"],
      acceptingCreators: true, agentAssistanceMode: "AI_ASSISTED", configRevision: 2,
      createdAt: NOW, updatedAt: NOW,
    }] as any);
    workspace.setAffiliateOperationalSettings({
      id: "settings-1", userId: "user-1", onboardingCompletedAt: NOW,
    } as any);

    expect(workspace.getBusinessDeveloper("bd-1")?.displayName).toBe("Maria Internal");
    expect(workspace.getBusinessDeveloper("bd-1")?.creatorDisplayName).toBe("Maria");
    expect(workspace.operationalSettings?.onboardingCompletedAt).toBe(NOW);
  });

  it("keeps the delivered message on a closed proposal", () => {
    // A proposal's review draft is scrubbed at terminal state, so the delivered
    // content is the only body a closed card can still show. An undeclared prop
    // is dropped on ingestion, which would blank that card silently.
    const workspace = AffiliateWorkspaceModel.create({});
    workspace.upsertAffiliateActionProposal({
      id: "proposal-1",
      type: "SEND_MESSAGE",
      status: "EXECUTED",
      executionResult: { deliveryId: "delivery-1", deliveryStatus: "SENT" },
      deliveredMessage: {
        deliveryId: "delivery-1",
        status: "SENT",
        channel: "PLATFORM_CHAT",
        parts: [{ sequence: 0, kind: "TEXT", text: "Hola, gracias por avisarnos." }],
      },
      createdAt: NOW,
      updatedAt: NOW,
    } as any);

    const projection = workspace.proposalProjection("proposal-1");
    expect(projection?.proposal.deliveredMessage?.parts?.[0]?.text)
      .toBe("Hola, gracias por avisarnos.");
  });
});
