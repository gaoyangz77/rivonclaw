import { describe, expect, it } from "vitest";
import { AffiliateWorkspaceModel } from "./Affiliate.js";

describe("AffiliateWorkspaceModel", () => {
  it("merges partial proposal updates without dropping normalized proposal context", () => {
    const workspace = AffiliateWorkspaceModel.create({});

    workspace.upsertAffiliateActionProposal({
      id: "proposal-1",
      userId: "user-1",
      shopId: "shop-1",
      creatorId: "creator-1",
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
    expect(projection?.proposal.operatorSummary).toBe("Send a reply");
    expect(projection?.creatorProfile?.nickname).toBe("Creator");
    expect(projection?.productSummary?.title).toBe("Product");
  });

  it("ignores partial proposal updates when the proposal is not already present", () => {
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

    expect(workspace.getActionProposal("proposal-unknown")).toBeNull();
  });

  it("stores conversation message pages by conversation and appends without duplicates", () => {
    const workspace = AffiliateWorkspaceModel.create({});

    workspace.ingestAffiliateConversationMessages("shop-1", "conversation-1", {
      hasMore: true,
      nextPageToken: "older",
      items: [
        {
          messageId: "message-1",
          conversationId: "conversation-1",
          text: "hello",
          productRefs: [],
          sampleApplicationRefs: [],
          targetCollaborationRefs: [],
        },
      ],
    } as any);

    workspace.ingestAffiliateConversationMessages("shop-1", "conversation-1", {
      hasMore: false,
      items: [
        {
          messageId: "message-1",
          conversationId: "conversation-1",
          text: "hello duplicate",
          productRefs: [],
          sampleApplicationRefs: [],
          targetCollaborationRefs: [],
        },
        {
          messageId: "message-2",
          conversationId: "conversation-1",
          text: "older",
          productRefs: [],
          sampleApplicationRefs: [],
          targetCollaborationRefs: [],
        },
      ],
    } as any, "append");

    const page = workspace.getConversationMessagePage("shop-1", "conversation-1");
    expect(page?.hasMore).toBe(false);
    expect(page?.items).toHaveLength(2);
    expect(page?.items.map((item: any) => item.messageId)).toEqual(["message-1", "message-2"]);
  });
});
