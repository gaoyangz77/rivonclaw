import type { GQL } from "@rivonclaw/core";

export const AFFILIATE_CONVERSATION_MESSAGE_DELTA_QUERY = `
  query AffiliateConversationMessageDelta(
    $shopId: String!,
    $conversationId: String!,
    $currentMessageId: String!,
    $anchor: ConversationMessageDeltaAnchorInput,
    $maxPages: Int
  ) {
    affiliateConversationMessageDelta(
      shopId: $shopId,
      conversationId: $conversationId,
      currentMessageId: $currentMessageId,
      anchor: $anchor,
      maxPages: $maxPages
    ) {
      items {
        conversationIndex
        messageId
        conversationId
        type
        content
        createTime
        senderId
      }
      meta {
        completeness
        anchorMatchType
        currentMessageFound
        anchorMatched
        pageLimitReached
        fetchedMessageCount
        anchorMessageId
        anchorCreateTime
      }
    }
  }
`;

export interface AffiliateConversationMessageDeltaQueryResult {
  affiliateConversationMessageDelta: GQL.EcomAffiliateMessageDelta;
}

export const AFFILIATE_WORKSPACE_QUERY = `
  query AffiliateWorkspace($input: AffiliateWorkspaceInput!) {
    affiliateWorkspace(input: $input) {
      sampleApplicationRecords {
        id
        platformApplicationId
        creatorId
        productId
        sampleWorkStatus
        observedContentCount
        latestObservedContentAt
        latestObservedContentId
        latestObservedContentUrl
        latestObservedContentFormat
        latestObservedContentPaidOrderCount
        latestObservedContentViewCount
        updatedAt
      }
      collaborationRecords: collaborationRecords {
        id
        creatorId
        productId
        sampleApplicationRecordId
        platformConversationId
        lifecycleStage
        processingStatus
        processReasons
        lastCreatorMessageId
        lastCreatorMessageAt
        lastSignalAt
        workHandledUntil
        nextSellerActionAt
      }
      actionProposals {
        id
        type
        status
        operatorSummary
        steps {
          stepId
          type
          operatorSummary
        }
        creatorId
        collaborationRecordId
        sampleReviewIntent {
          sampleApplicationRecordId
          platformApplicationId
          decision
          rejectReason
        }
        sampleShipmentIntent {
          sampleApplicationRecordId
          platformApplicationId
          warehouseId
          skuId
          quantity
        }
        messageIntent {
          conversationId
          creatorId
          sampleApplicationRecordId
          platformApplicationId
          messageType
          text
        }
      }
      approvalPolicies {
        id
        reason
        action
        enabled
      }
    }
  }
`;

export interface AffiliateWorkspaceQueryResult {
  affiliateWorkspace: GQL.AffiliateWorkspacePayload;
}

export const RESOLVE_AFFILIATE_WORK_ITEM_MUTATION = `
  mutation ResolveAffiliateWorkItem($input: ResolveAffiliateWorkItemInput!) {
    resolveAffiliateWorkItem(input: $input) {
      decision
      stale
      actionMode
      proposal {
        id
        status
        operatorSummary
      }
      collaborationRecord {
        id
        processingStatus
        processReasons
        workHandledUntil
        stateUpdatedAt
      }
    }
  }
`;

export interface ResolveAffiliateWorkItemMutationResult {
  resolveAffiliateWorkItem: {
    decision: string;
    stale: boolean;
    actionMode?: string | null;
    proposal?: Pick<GQL.ActionProposal, "id" | "status" | "operatorSummary"> | null;
    collaborationRecord?: Pick<
      GQL.AffiliateCollaborationRecord,
      "id" | "processingStatus" | "processReasons" | "workHandledUntil" | "stateUpdatedAt"
    > | null;
  };
}
