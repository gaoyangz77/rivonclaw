import { describe, expect, it } from "vitest";
import { AffiliateWorkspaceModel } from "./Affiliate.js";

describe("AffiliateWorkspaceModel", () => {
  it("merges partial proposal updates without dropping normalized proposal context", () => {
    const workspace = AffiliateWorkspaceModel.create({});

    workspace.upsertAffiliateActionProposal({
      id: "proposal-1",
      userId: "user-1",
      focusShopId: "shop-1",
      creatorId: "creator-1",
      creatorRelationshipId: "relationship-1",
      collaborationRecordId: "collab-1",
      type: "SEND_MESSAGE",
      status: "PENDING",
      operatorSummary: "Send a reply",
      steps: [],
      createdAt: "2026-06-19T00:00:00.000Z",
      updatedAt: "2026-06-19T00:00:00.000Z",
      creatorProfile: {
        id: "creator-1",
        platform: "TIKTOK_SHOP",
        username: "creator",
        nickname: "Creator",
        categoryIds: [],
        createdAt: "2026-06-19T00:00:00.000Z",
        updatedAt: "2026-06-19T00:00:00.000Z",
      },
      collaborationRecord: {
        id: "collab-1",
        userId: "user-1",
        shopId: "shop-1",
        creatorRelationshipId: "relationship-1",
        creatorId: "creator-1",
        productId: "product-1",
        lifecycleStage: "SAMPLE",
        processingStatus: "STAFF_REQUIRED",
        requiredAction: "REVIEW_ACTION_PROPOSAL",
        processReasons: [],
        stateUpdatedAt: "2026-06-19T00:00:00.000Z",
        startedAt: "2026-06-19T00:00:00.000Z",
        predictionSnapshots: [],
        createdAt: "2026-06-19T00:00:00.000Z",
        updatedAt: "2026-06-19T00:00:00.000Z",
      },
      productSummary: {
        productId: "product-1",
        title: "Product",
        priceMin: "12.00",
        priceMax: "12.00",
        skus: [],
      },
    } as any);

    workspace.upsertAffiliateActionProposal({
      id: "proposal-1",
      status: "APPROVED",
      updatedAt: "2026-06-19T00:01:00.000Z",
      decision: {
        actorType: "HUMAN",
        decidedAt: "2026-06-19T00:01:00.000Z",
      },
    } as any);

    const projection = workspace.proposalProjection("proposal-1");
    expect(projection?.proposal.status).toBe("APPROVED");
    expect(projection?.proposal.creatorRelationshipId).toBe("relationship-1");
    expect(projection?.collaborationRecord?.creatorRelationshipId).toBe("relationship-1");
    expect(projection?.proposal.operatorSummary).toBe("Send a reply");
    expect(projection?.creatorProfile?.nickname).toBe("Creator");
    expect(projection?.productSummary?.title).toBe("Product");
  });

  it("accepts partial proposal snapshots from relationship workspace queries", () => {
    const workspace = AffiliateWorkspaceModel.create({});

    expect(() => {
      workspace.upsertAffiliateActionProposal({
        id: "proposal-unknown",
        status: "EXECUTED",
        updatedAt: "2026-06-19T00:01:00.000Z",
        executionResult: {
          platformObjectId: "platform-1",
          executedAt: "2026-06-19T00:01:00.000Z",
        },
      } as any);
    }).not.toThrow();

    expect(workspace.getActionProposal("proposal-unknown")?.status).toBe("EXECUTED");
    expect(workspace.getActionProposal("proposal-unknown")?.operatorSummary).toBe("");
  });

  it("does not expose technical affiliate conversation state in the shared workspace", () => {
    const workspace = AffiliateWorkspaceModel.create({});

    expect("conversationRecords" in workspace).toBe(false);
    expect("conversationMessagePages" in workspace).toBe(false);
    expect("ingestAffiliateConversationMessages" in workspace).toBe(false);
    expect("ingestAffiliateCollaborationRecordItems" in workspace).toBe(false);
  });

  it("stores creator relationships as the shared affiliate workspace owner", () => {
    const workspace = AffiliateWorkspaceModel.create({});

    workspace.ingestAffiliateWorkspace({
      creatorRelations: [{
        id: "relationship-1",
        creatorId: "creator-1",
        blocked: false,
        blockedShopIds: [],
        shopStates: [{
          shopId: "shop-1",
          lifecycleStage: "QUALIFIED",
          tagIds: ["tag-1"],
        }],
        updatedAt: "2026-06-19T00:00:00.000Z",
      }],
      creatorProfiles: [{
        id: "creator-1",
        platform: "TIKTOK_SHOP",
        username: "creator",
        nickname: "Creator",
        categoryIds: [],
      }],
      collaborationRecords: [{
        id: "collab-1",
        creatorRelationshipId: "relationship-1",
        creatorId: "creator-1",
        shopId: "shop-1",
        productId: "product-1",
        lifecycleStage: "SAMPLE",
        processingStatus: "AGENT_REQUIRED",
        requiredAction: "FOLLOW_UP_CREATOR",
        processReasons: ["SAMPLE_CONTENT_OVERDUE"],
      }],
      sampleApplicationRecords: [],
      actionProposals: [{
        id: "proposal-1",
        focusShopId: "shop-1",
        creatorId: "creator-1",
        creatorRelationshipId: "relationship-1",
        collaborationRecordId: "collab-1",
        type: "SEND_MESSAGE",
        status: "PENDING",
        operatorSummary: "Follow up",
        steps: [],
      }],
    } as any);

    expect(workspace.getCreatorRelationship("relationship-1")?.creatorId).toBe("creator-1");
    expect(workspace.getCreatorRelationshipByCreatorId("creator-1")?.id).toBe("relationship-1");

    const projection = workspace.proposalProjection("proposal-1");
    expect(projection?.creatorRelationship?.id).toBe("relationship-1");
    expect(projection?.collaborationRecord?.creatorRelationshipId).toBe("relationship-1");
    expect(projection?.creatorProfile?.nickname).toBe("Creator");
  });

  it("projects complete relationship context across collaborations, proposals, samples, and history", () => {
    const workspace = AffiliateWorkspaceModel.create({});

    workspace.ingestAffiliateWorkspace({
      creatorRelations: [{
        id: "relationship-1",
        creatorId: "creator-1",
        pendingActionProposalId: "proposal-relationship",
        blocked: false,
        blockedShopIds: [],
        activeCollaborationRecordIds: ["collab-1", "collab-2"],
        shopStates: [{
          shopId: "shop-1",
          lifecycleStage: "QUALIFIED",
          tagIds: [],
        }],
        updatedAt: "2026-06-19T00:00:00.000Z",
      }],
      creatorProfiles: [{
        id: "creator-1",
        platform: "TIKTOK_SHOP",
        username: "creator",
        nickname: "Creator",
        categoryIds: [],
      }],
      collaborationRecords: [{
        id: "collab-1",
        creatorRelationshipId: "relationship-1",
        creatorId: "creator-1",
        shopId: "shop-1",
        productId: "product-1",
        lifecycleStage: "SAMPLE",
        processingStatus: "AGENT_REQUIRED",
        requiredAction: "REVIEW_SAMPLE_APPLICATION",
        processReasons: [],
        affiliateCollaborationId: "affiliate-collab-1",
        sampleApplicationRecordId: "sample-1",
        stateUpdatedAt: "2026-06-19T00:03:00.000Z",
      }, {
        id: "collab-2",
        creatorRelationshipId: "relationship-1",
        creatorId: "creator-1",
        shopId: "shop-2",
        productId: "product-2",
        lifecycleStage: "CONTENT",
        processingStatus: "EXTERNAL_WAIT",
        requiredAction: "WAIT_FOR_CREATOR_CONTENT",
        processReasons: [],
        stateUpdatedAt: "2026-06-19T00:02:00.000Z",
      }],
      sampleApplicationRecords: [{
        id: "sample-1",
        creatorId: "creator-1",
        shopId: "shop-1",
        productId: "product-1",
        affiliateCollaborationId: "affiliate-collab-1",
        platformApplicationId: "platform-sample-1",
        sampleWorkStatus: "PENDING_REVIEW",
        updatedAt: "2026-06-19T00:02:30.000Z",
      }],
      actionProposals: [{
        id: "proposal-relationship",
        focusShopId: "shop-1",
        creatorId: "creator-1",
        creatorRelationshipId: "relationship-1",
        collaborationRecordId: null,
        type: "SEND_MESSAGE",
        status: "PENDING",
        operatorSummary: "Ask for clarification",
        steps: [],
        updatedAt: "2026-06-19T00:04:00.000Z",
      }, {
        id: "proposal-collab",
        focusShopId: "shop-2",
        creatorId: "creator-1",
        creatorRelationshipId: null,
        collaborationRecordId: "collab-2",
        type: "SEND_MESSAGE",
        status: "SUPERSEDED",
        operatorSummary: "Follow up on content",
        steps: [],
        updatedAt: "2026-06-19T00:01:00.000Z",
      }],
      lifecycleEvents: [{
        id: "event-relationship",
        userId: "user-1",
        shopId: "shop-1",
        entityType: "CREATOR_RELATIONSHIP",
        entityId: "relationship-1",
        eventType: "ACTION_PROPOSAL_CREATED",
        actorType: "SYSTEM",
        actorId: null,
        collaborationRecordId: null,
        creatorRelationshipId: "relationship-1",
        proposalId: "proposal-relationship",
        creatorId: "creator-1",
        productId: null,
        campaignId: null,
        fromStage: null,
        toStage: null,
        displayPayloadJson: null,
        createdAt: "2026-06-19T00:04:00.000Z",
      }, {
        id: "event-collab",
        userId: "user-1",
        shopId: "shop-2",
        entityType: "COLLABORATION_RECORD",
        entityId: "collab-2",
        eventType: "COLLABORATION_STATE_UPDATED",
        actorType: "SYSTEM",
        actorId: null,
        collaborationRecordId: "collab-2",
        creatorRelationshipId: null,
        proposalId: null,
        creatorId: "creator-1",
        productId: "product-2",
        campaignId: null,
        fromStage: null,
        toStage: null,
        displayPayloadJson: null,
        createdAt: "2026-06-19T00:02:00.000Z",
      }],
    } as any);

    const projection = workspace.relationshipProjection("relationship-1");
    expect(projection?.creatorRelationship.id).toBe("relationship-1");
    expect(projection?.creatorProfile?.nickname).toBe("Creator");
    expect(projection?.collaborationRecords.map((record) => record.id)).toEqual(["collab-1", "collab-2"]);
    expect(projection?.sampleApplications.map((sample) => sample.id)).toEqual(["sample-1"]);
    expect(projection?.actionProposals.map((proposal) => proposal.id)).toEqual([
      "proposal-relationship",
      "proposal-collab",
    ]);
    expect(projection?.pendingActionProposal?.id).toBe("proposal-relationship");
    expect(projection?.lifecycleEvents.map((event) => event.id)).toEqual([
      "event-relationship",
      "event-collab",
    ]);
  });

  it("shows relationship-level proposals in every linked shop page", () => {
    const workspace = AffiliateWorkspaceModel.create({});

    workspace.ingestAffiliateWorkspace({
      creatorRelations: [{
        id: "relationship-1",
        creatorId: "creator-1",
        blocked: false,
        blockedShopIds: [],
        shopStates: [{
          shopId: "shop-2",
          lifecycleStage: "QUALIFIED",
          tagIds: [],
        }],
        updatedAt: "2026-06-19T00:00:00.000Z",
      }],
      creatorProfiles: [{
        id: "creator-1",
        platform: "TIKTOK_SHOP",
        username: "creator",
        nickname: "Creator",
        categoryIds: [],
        createdAt: "2026-06-19T00:00:00.000Z",
        updatedAt: "2026-06-19T00:00:00.000Z",
      }],
      collaborationRecords: [{
        id: "collab-2",
        userId: "user-1",
        shopId: "shop-2",
        creatorRelationshipId: "relationship-1",
        creatorId: "creator-1",
        productId: "product-2",
        lifecycleStage: "SAMPLE",
        processingStatus: "STAFF_REQUIRED",
        requiredAction: "REVIEW_ACTION_PROPOSAL",
        processReasons: [],
        stateUpdatedAt: "2026-06-19T00:00:00.000Z",
        startedAt: "2026-06-19T00:00:00.000Z",
        predictionSnapshots: [],
        createdAt: "2026-06-19T00:00:00.000Z",
        updatedAt: "2026-06-19T00:00:00.000Z",
      }],
      actionProposals: [{
        id: "proposal-cross-shop",
        userId: "user-1",
        focusShopId: "shop-1",
        creatorId: "creator-1",
        creatorRelationshipId: "relationship-1",
        collaborationRecordId: null,
        type: "SEND_MESSAGE",
        status: "PENDING",
        operatorSummary: "Relationship-level reply",
        steps: [],
        createdAt: "2026-06-19T00:00:00.000Z",
        updatedAt: "2026-06-19T00:00:00.000Z",
      }],
    } as any);

    expect(workspace.actionProposalPage({ shopId: "shop-1" }).map((item) => item.proposal.id)).toEqual([
      "proposal-cross-shop",
    ]);
    expect(workspace.actionProposalPage({ shopId: "shop-2" }).map((item) => item.proposal.id)).toEqual([
      "proposal-cross-shop",
    ]);
  });

  it("projects relationship proposal steps back into the targeted collaboration detail", () => {
    const workspace = AffiliateWorkspaceModel.create({});

    workspace.ingestAffiliateWorkspace({
      creatorRelations: [{
        id: "relationship-1",
        creatorId: "creator-1",
        blocked: false,
        blockedShopIds: [],
        shopStates: [{
          shopId: "shop-1",
          lifecycleStage: "QUALIFIED",
          tagIds: [],
        }],
      }],
      creatorProfiles: [{
        id: "creator-1",
        platform: "TIKTOK_SHOP",
        username: "creator",
        nickname: "Creator",
        categoryIds: [],
      }],
      collaborationRecords: [{
        id: "collab-1",
        userId: "user-1",
        shopId: "shop-1",
        creatorRelationshipId: "relationship-1",
        creatorId: "creator-1",
        productId: "product-1",
        lifecycleStage: "SAMPLE",
        processingStatus: "STAFF_REQUIRED",
        requiredAction: "REVIEW_ACTION_PROPOSAL",
        processReasons: [],
      }],
      actionProposals: [{
        id: "proposal-bundle",
        userId: "user-1",
        focusShopId: "shop-1",
        creatorId: "creator-1",
        creatorRelationshipId: "relationship-1",
        collaborationRecordId: null,
        type: "SEND_MESSAGE",
        status: "PENDING",
        operatorSummary: "Bundled relationship action",
        steps: [{
          type: "REVIEW_SAMPLE_APPLICATION",
          collaborationRecordId: "collab-1",
        }],
        updatedAt: "2026-06-19T00:04:00.000Z",
      }],
      lifecycleEvents: [{
        id: "event-proposal",
        userId: "user-1",
        shopId: "shop-1",
        entityType: "ACTION_PROPOSAL",
        entityId: "proposal-bundle",
        eventType: "ACTION_PROPOSAL_CREATED",
        actorType: "SYSTEM",
        actorId: null,
        collaborationRecordId: null,
        creatorRelationshipId: "relationship-1",
        proposalId: "proposal-bundle",
        creatorId: "creator-1",
        productId: "product-1",
        campaignId: null,
        fromStage: null,
        toStage: null,
        displayPayloadJson: null,
        createdAt: "2026-06-19T00:04:00.000Z",
      }],
    } as any);

    const projection = workspace.collaborationProjection("collab-1");
    expect(projection?.actionProposals.map((proposal) => proposal.id)).toEqual(["proposal-bundle"]);
    expect(projection?.lifecycleEvents.map((event) => event.id)).toEqual(["event-proposal"]);
  });
});
