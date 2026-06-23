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
        requiredAction
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
        creatorTagIds
        campaignIds
        productIds
        createdAt
        updatedAt
      }
      creatorRelations {
        id
        creatorId
        blocked
        blockedShopIds
        shopStates {
          shopId
          lifecycleStage
          tagIds
          lastContactedAt
          lastInvitedAt
          lastQualifiedAt
        }
        updatedAt
      }
      creatorTags {
        id
        shopId
        name
        type
        systemKey
        sensitive
        updatedAt
      }
      campaigns {
        id
        name
        decisionThresholds {
          minExpectedSalesUnits
        }
      }
    }
  }
`;

export interface AffiliateWorkspaceQueryResult {
  affiliateWorkspace: GQL.AffiliateWorkspacePayload;
}

export const AFFILIATE_ACTION_PROPOSAL_DELTA_QUERY = `
  query AffiliateActionProposalDelta($input: AffiliateActionProposalDeltaInput!) {
    affiliateActionProposalDelta(input: $input) {
      id
      type
      status
      operatorSummary
      creatorId
      shopThreadId
      collaborationRecordId
      decision {
        note
        decidedAt
        actorType
        actorId
      }
      steps {
        stepId
        type
        operatorSummary
      }
      sampleReviewIntent {
        sampleApplicationRecordId
        platformApplicationId
        decision
        rejectReason
      }
      messageIntent {
        conversationId
        creatorId
        sampleApplicationRecordId
        platformApplicationId
        messageType
        text
      }
      updatedAt
    }
  }
`;

export interface AffiliateActionProposalDeltaQueryResult {
  affiliateActionProposalDelta: GQL.ActionProposal[];
}

export const AFFILIATE_EXPECTED_SALES_PREDICTIONS_QUERY = `
  query AffiliateExpectedSalesPredictions($input: AffiliateExpectedSalesPredictionInput!) {
    affiliateExpectedSalesPredictions(input: $input) {
      status
      requestId
      modelTag
      modelType
      trainedAt
      featureVersion
      predictions {
        cacheId
        status
        message
        expectedSalesUnits
        expectedSalesPercentile
        subject {
          sampleApplicationRecordId
          platformApplicationId
          creatorId
          creatorOpenId
          affiliateCollaborationId
          platformCollaborationId
          productId
        }
        resolvedContext {
          sampleApplicationRecordId
          platformApplicationId
          creatorId
          creatorOpenId
          creatorUsername
          creatorNickname
          affiliateCollaborationId
          platformCollaborationId
          productId
          productTitle
          source
        }
        predictionQuality {
          score
          level
          featureCompletenessScore
          dataSupportScore
          probabilityMarginScore
          predictionBucketSupportScore
          interpretation
        }
        predictionInterval {
          lowerExpectedSalesUnits
          upperExpectedSalesUnits
          confidenceLevel
          method
          interpretation
        }
        thresholdProbabilities {
          unitsGe1
          unitsGe2
          unitsGe3
          unitsGe5
          unitsGe10
        }
        thresholdPercentiles {
          unitsGe1 { percentile topPercent }
          unitsGe2 { percentile topPercent }
          unitsGe3 { percentile topPercent }
          unitsGe5 { percentile topPercent }
          unitsGe10 { percentile topPercent }
        }
        predictionBucket {
          bucketIndex
          scoreMin
          scoreMax
          sampleCount
          actualAvgUnits
          actualP25Units
          actualMedianUnits
          actualP75Units
          actualP90Units
          actualZeroRate
        }
      }
    }
  }
`;

export interface AffiliateExpectedSalesPredictionsQueryResult {
  affiliateExpectedSalesPredictions: GQL.AffiliateExpectedSalesPredictionPayload;
}

export const AFFILIATE_WORK_ITEMS_QUERY = `
  query AffiliateWorkItems($input: ReadAffiliateWorkItemsInput) {
    affiliateWorkItems(input: $input) {
      id
      subjectType
      shopThreadId
      collaborationRecordId
      versionAt
      requiredAction
      shopThread {
        id
        lastSignalAt
        workHandledUntil
        processingStatus
        requiredAction
        processReasons
      }
      collaboration {
        id
        lastSignalAt
        workHandledUntil
        processingStatus
        requiredAction
        processReasons
      }
    }
  }
`;

export interface AffiliateWorkItemsQueryResult {
  affiliateWorkItems: Array<Pick<GQL.AffiliateWorkItem, "id" | "shopThreadId" | "collaborationRecordId" | "versionAt" | "shopThread" | "collaboration">>;
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
