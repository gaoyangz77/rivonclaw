import type { GQL } from "@rivonclaw/core";

export const AFFILIATE_CONTEXT_BUILDER_QUERY = `
  query AffiliateContextBuilder($input: AffiliateContextBuilderInput!) {
    affiliateContextBuilder(input: $input) {
      baseCheckpointId
      baseEventCursor
      targetEventCursor
      relationshipOperationalConfigRevision
      businessDeveloperIdSnapshot
      businessDeveloperConfigRevision
      baseMatchesCommitted
      truncated
      involvedShopInstructions {
        shopId
        shopName
        businessPrompt
      }
      businessDeveloper {
        id
        displayName
        regions
        acceptingCreators
        agentAssistanceMode
        businessPrompt
        configRevision
      }
    }
  }
`;

export interface AffiliateContextBuilderQueryResult {
  affiliateContextBuilder: GQL.AffiliateContextBuilderPayload;
}

export const AFFILIATE_EXPECTED_SALES_PREDICTIONS_QUERY = `
  query AffiliateExpectedSalesPredictions($input: AffiliateExpectedSalesPredictionInput!) {
    affiliateExpectedSalesPredictions(input: $input) {
      status
      modelStatus
      expectedSalesUnits
      requestId
      modelStage
      requestedTenantScope
      requestedTenantId
      effectiveTenantScope
      effectiveTenantId
      featureTemporalBasis
      modelTag
      modelType
      trainedAt
      featureVersion
      modelVersion
      expectedSales {
        modelStatus
        modelStage
        featureTemporalBasis
        requestedTenantScope
        requestedTenantId
        effectiveTenantScope
        effectiveTenantId
        modelVersion { modelFamily modelStage tenantScope tenantId tenantModelName contractHash featureVersion trainedAt trainingRunId trainingIndex bentomlTag modelVersionKey }
      }
      humanDecision {
        modelStatus
        modelStage
        featureTemporalBasis
        requestedTenantScope
        requestedTenantId
        effectiveTenantScope
        effectiveTenantId
        modelVersion { modelFamily modelStage tenantScope tenantId tenantModelName contractHash featureVersion trainedAt trainingRunId trainingIndex bentomlTag modelVersionKey }
      }
      predictions {
        cacheId
        status
        expectedSalesStatus
        humanDecisionStatus
        message
        expectedSalesUnits
        expectedSalesPercentile
        humanDecision {
          status
          message
          humanApprovalProbability
          humanApprovalPercentile
          wouldApprove
          approvalCutoff
          historicalApprovalRate
        }
        subject {
          platformApplicationId
          creatorId
          creatorOpenId
          affiliateCollaborationId
          platformCollaborationId
          productId
        }
        resolvedContext {
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
      triggerShopId
      triggerPlatformShopId
      routingShopIds
      routingPlatformShopIds
      subjectType
      creatorRelationshipId
      affiliateCollaborationId
      relationshipOperationalConfigRevision
      businessDeveloperIdSnapshot
      businessDeveloperConfigRevision
      workKind
      workBundleKind
      triggerChannel
      triggerLifecycleEventId
      agentWorkingAgendaItems {
        key
        owner
        sourceType
        workKind
        requiredAction
        shopId
        affiliateCollaborationId
        sampleApplicationRecordId
        proposalId
        reasons
        nextActionAt
        boundaryEventCursor
        updatedAt
        predictionEvidence {
          sourceCacheId
          predictionType
          captureMode
          scenario
          subject { sampleApplicationRecordId platformApplicationId creatorId creatorOpenId affiliateCollaborationId platformCollaborationId productId }
          status
          output
          model
          diagnostics
          resolvedContext { shopId sampleApplicationRecordId platformApplicationId creatorId creatorOpenId creatorUsername creatorNickname productId skuId productTitle source }
          message
          predictedAt
          capturedAt
        }
        revisionRequestedProposal {
          id
          type
          status
          operatorSummary
          decision { note decidedAt actorType actorId }
          messageIntent {
            creatorId
            preferredChannel
            emailSubject
            parts { kind text textHash textLength draftAssetId caption captionHash captionLength emailDisposition fileName mimeType sizeBytes sha256 productId targetCollaborationId sampleApplicationId }
          }
          sampleReviewIntent { sampleApplicationRecordId platformApplicationId projectionRevision lastObservedAt decision rejectReason }
          targetCollaborationIntent {
            name
            message
            endTime
            hasFreeSample
            isSampleApprovalExempt
            creatorIds
            creatorOpenIds
            products { productId targetCommissionRateBps shopAdsCommissionRateBps }
            sellerContactInfo { email phoneNumber whatsapp telegram line }
          }
          steps {
            stepId
            type
            operatorSummary
            messageIntent {
              creatorId
              preferredChannel
              emailSubject
              parts { kind text textHash textLength draftAssetId caption captionHash captionLength emailDisposition fileName mimeType sizeBytes sha256 productId targetCollaborationId sampleApplicationId }
            }
            sampleReviewIntent { sampleApplicationRecordId platformApplicationId projectionRevision lastObservedAt decision rejectReason }
            targetCollaborationIntent {
              name
              message
              endTime
              hasFreeSample
              isSampleApprovalExempt
              creatorIds
              creatorOpenIds
              products { productId targetCommissionRateBps shopAdsCommissionRateBps }
              sellerContactInfo { email phoneNumber whatsapp telegram line }
            }
          }
        }
      }
      recommendedActionTypes
      agentDispatchRecommended
      creatorProtected
      agentEligibilityReason
      staffReviewRequired
      processingStatus
      versionAt
      requiredAction
      processReasons
      creatorRelationship {
        id
        creatorId
        businessDeveloperId
        operationalConfigRevision
        blocked
        blockedShopIds
        lastInboundAt
        lastInboundChannel
        lastInboundLifecycleEventId
        lastOutboundAt
        lastAgentHandledAt
        committedCheckpointId
        committedCheckpointAt
        committedEventCursor
        lifecycleEventSequence
        activeRunId
        activeRunBaseCheckpointId
        activeRunBaseEventCursor
        stateUpdatedAt
        activeAffiliateCollaborationIds
        shopStates {
          shopId
          tagIds
          lastContactedAt
          lastInvitedAt
          lastQualifiedAt
        }
      }
      affiliateCollaboration {
        id
        userId
        shopId
        campaignId
        type
        platformCollaborationId
        status
        creatorIds
        creatorOpenIds
        productIds
        commissionRate
        effectiveTime
        platformUpdatedAt
        firstObservedAt
        lastObservedAt
        lastSyncSource
        projectionRevision
        createdAt
        updatedAt
      }
      context {
        creatorProfile {
          id
          platform
          creatorOpenId
          creatorImId
        }
        creatorRelation {
          id
          creatorId
          blocked
          blockedShopIds
          shopStates {
            shopId
            tagIds
            lastContactedAt
            lastInvitedAt
            lastQualifiedAt
          }
        }
        affiliateCollaboration {
          id
          type
          campaignId
          platformCollaborationId
          productIds
          status
        }
        activeCollaborations {
          id
          userId
          shopId
          type
          platformCollaborationId
          status
          creatorIds
          creatorOpenIds
          productIds
          lastObservedAt
          updatedAt
        }
        focusCollaboration {
          id
          userId
          shopId
          type
          platformCollaborationId
          status
          creatorIds
          creatorOpenIds
          productIds
          lastObservedAt
          updatedAt
        }
        ambiguousCollaborationCandidates {
          id
          userId
          shopId
          type
          platformCollaborationId
          status
          creatorIds
          creatorOpenIds
          productIds
          lastObservedAt
          updatedAt
        }
        productContext {
          productId
          title
          imageUrl
          source
        }
        primarySampleApplication {
          id
          userId
          platformApplicationId
          creatorId
          creatorOpenId
          productId
          affiliateCollaborationId
          collaborationType
          platformCollaborationId
          platformOpenCollaborationId
          platformTargetCollaborationId
          sampleWorkStatus
          trackingNumber
          carrier
          observedContentCount
          latestObservedContentAt
          latestObservedContentId
          latestObservedContentUrl
          latestObservedContentFormat
          latestObservedContentPaidOrderCount
          latestObservedContentViewCount
          shippedAt
          deliveredAt
          updatedAt
        }
        relatedSampleApplications {
          id
          userId
          platformApplicationId
          creatorId
          creatorOpenId
          productId
          affiliateCollaborationId
          collaborationType
          platformCollaborationId
          platformOpenCollaborationId
          platformTargetCollaborationId
          sampleWorkStatus
          trackingNumber
          carrier
          observedContentCount
          latestObservedContentAt
          latestObservedContentId
          latestObservedContentUrl
          latestObservedContentFormat
          latestObservedContentPaidOrderCount
          latestObservedContentViewCount
          shippedAt
          deliveredAt
          updatedAt
        }
        sampleApplicationLookup {
          status
          queriedAt
          shopId
          productIds
        }
        missingContext {
          reason
          severity
          message
        }
        recommendedActionTypes
      }
    }
  }
`;

export interface AffiliateWorkItemsQueryResult {
  affiliateWorkItems: GQL.AffiliateWorkItem[];
}

export const AFFILIATE_CREATOR_MESSAGE_PREFLIGHT_QUERY = `
  query AffiliateCreatorMessagePreflight($input: AffiliateCreatorMessageHistoryInput!) {
    affiliateCreatorMessageHistory(input: $input) {
      items {
        channel
        direction
        createdAt
        messageType
        parts {
          kind
          fileName
          mimeType
          sizeBytes
          agentReadable
          providerType
          summary
        }
      }
    }
  }
`;

export interface AffiliateCreatorMessagePreflightQueryResult {
  affiliateCreatorMessageHistory: Pick<GQL.AffiliateCreatorMessageHistoryPayload, "items">;
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
        baseCheckpointId
        candidateCheckpointId
      }
      affiliateCollaboration {
        id
        status
        lastObservedAt
        projectionRevision
      }
    }
  }
`;

export interface ResolveAffiliateWorkItemMutationResult {
  resolveAffiliateWorkItem: {
    decision: string;
    stale: boolean;
    actionMode?: string | null;
    proposal?: Pick<
      GQL.ActionProposal,
      "id" | "status" | "operatorSummary" | "baseCheckpointId" | "candidateCheckpointId"
    > | null;
    affiliateCollaboration?: Pick<
      GQL.AffiliateCollaboration,
      "id" | "status" | "lastObservedAt" | "projectionRevision"
    > | null;
  };
}
