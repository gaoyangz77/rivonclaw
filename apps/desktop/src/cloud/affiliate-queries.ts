import type { GQL } from "@rivonclaw/core";

export const AFFILIATE_CONTEXT_BUILDER_QUERY = `
  query AffiliateContextBuilder(
    $input: AffiliateContextBuilderInput!
    $contactInput: AffiliateCreatorContactStateInput!
  ) {
    affiliateContextBuilder(input: $input) {
      baseCheckpointId
      baseEventCursor
      targetEventCursor
      relationshipOperationalConfigRevision
      businessDeveloperIdSnapshot
      businessDeveloperConfigRevision
      baseMatchesCommitted
      truncated
      businessDeveloper {
        id
        displayName
        regions
        acceptingCreators
        agentAssistanceMode
        businessPrompt
        configRevision
      }
      events {
        id
        occurredAt
        actorType
        actorRole
        summary
        relatedIds {
          shopId
          creatorId
          collaborationRecordId
          sampleApplicationRecordId
          platformApplicationId
          actionProposalId
          lifecycleEventId
          productId
        }
        lifecycleEvent {
          lifecycleEventId
          eventType
          entityType
          entityId
          relationshipSequence
          decisionRelevant
          displayPayloadJson
        }
      }
      creatorRelationship {
        id
        committedCheckpointId
        committedEventCursor
        lifecycleEventSequence
        agendaItems {
          key
          owner
          sourceType
          status
          workKind
          requiredAction
          shopId
          collaborationRecordId
          sampleApplicationRecordId
          proposalId
          reasons
          nextActionAt
          boundaryEventCursor
          updatedAt
        }
        workSummary {
          agentRequiredCount
          staffRequiredCount
          externalWaitingCount
          activeCollaborationCount
          nextActionAt
        }
      }
      workspace {
        creatorRelations {
          id
          creatorId
          blocked
          agendaItems {
            key
            owner
            sourceType
            workKind
            requiredAction
            collaborationRecordId
            sampleApplicationRecordId
            proposalId
            reasons
            nextActionAt
          }
        }
        collaborationRecords {
          id
          shopId
          creatorId
          creatorRelationshipId
          productId
          lifecycleStage
          processingStatus
          requiredAction
          processReasons
          sampleApplicationRecordId
          lastSignalAt
          nextSellerActionAt
          stateUpdatedAt
        }
        sampleApplicationRecords {
          id
          platformApplicationId
          creatorId
          productId
          sampleWorkStatus
          order {
            platformOrderId
            trackingNumber
            carrier
          }
          trackingNumber
          carrier
          shippedAt
          deliveredAt
          observedContentCount
          latestObservedContentAt
          updatedAt
        }
        actionProposals {
          id
          status
          type
          operatorSummary
          creatorRelationshipId
          collaborationRecordId
          baseCheckpointId
          baseEventCursor
          candidateCheckpointId
          targetEventCursor
          steps {
            stepId
            type
            operatorSummary
          }
        }
        creatorProfiles {
          id
          platform
          creatorOpenId
          username
          nickname
          marketplaceSnapshotJson
          followerCount
        }
      }
    }
    affiliateCreatorContactState(input: $contactInput) {
      defaultOutboundChannel
      hasUsableWhatsAppContact
      hasUsableEmailContact
      preferredWhatsAppAccount {
        id
        businessDeveloperId
        displayName
        phoneNumber
        status
      }
      preferredEmailAccount {
        id
        businessDeveloperId
        displayName
        emailAddress
        sharedMailboxAddress
        mailboxType
        status
      }
      channelContacts {
        id
        channel
        accountBindingId
        businessDeveloperId
        creatorPhone
        creatorEmail
        effectiveAlias
        status
        verifiedAt
        lastInboundAt
        lastOutboundAt
      }
      whatsAppAccounts {
        id
        businessDeveloperId
        displayName
        phoneNumber
        status
      }
      emailAccounts {
        id
        businessDeveloperId
        displayName
        emailAddress
        sharedMailboxAddress
        mailboxType
        status
      }
    }
  }
`;

export interface AffiliateContextBuilderQueryResult {
  affiliateContextBuilder: GQL.AffiliateContextBuilderPayload;
  affiliateCreatorContactState: GQL.AffiliateCreatorContactStatePayload;
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
        creatorRelationshipId
        creatorId
        productId
        sampleApplicationRecordId
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
        baseCheckpointId
        candidateCheckpointId
        steps {
          stepId
          type
          operatorSummary
        }
        creatorId
        creatorRelationshipId
        collaborationRecordId
        sourceWorkBoundary {
          subjectType
          creatorRelationshipId
          collaborationRecordId
          workKind
          workBundleKind
          versionAt
          triggerKind
          triggerId
          recommendedActionTypes
        }
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
          creatorId
          preferredChannel
          emailSubject
          subjectHash
          subjectLength
          parts { kind text textHash textLength draftAssetId caption captionHash captionLength emailDisposition fileName mimeType sizeBytes sha256 productId targetCollaborationId sampleApplicationId }
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
        committedCheckpointId
        committedCheckpointAt
        committedEventCursor
        lifecycleEventSequence
        activeRunId
        activeRunBaseCheckpointId
        activeRunBaseEventCursor
        agendaItems {
          key
          owner
          sourceType
          status
          workKind
          requiredAction
          shopId
          collaborationRecordId
          sampleApplicationRecordId
          proposalId
          reasons
          nextActionAt
          boundaryEventCursor
          updatedAt
        }
        workSummary {
          agentRequiredCount
          staffRequiredCount
          externalWaitingCount
          activeCollaborationCount
          nextActionAt
        }
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
      creatorRelationshipId
      collaborationRecordId
      baseCheckpointId
      candidateCheckpointId
      sourceWorkBoundary {
        subjectType
        creatorRelationshipId
        collaborationRecordId
        workKind
        workBundleKind
        versionAt
        triggerKind
        triggerId
        recommendedActionTypes
      }
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
        creatorId
        preferredChannel
        emailSubject
        subjectHash
        subjectLength
        parts { kind text textHash textLength draftAssetId caption captionHash captionLength emailDisposition fileName mimeType sizeBytes sha256 productId targetCollaborationId sampleApplicationId }
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
      focusShopId
      focusPlatformShopId
      routingShopIds
      routingPlatformShopIds
      subjectType
      creatorRelationshipId
      collaborationRecordId
      relationshipOperationalConfigRevision
      businessDeveloperIdSnapshot
      businessDeveloperConfigRevision
      workKind
      workBundleKind
      triggerChannel
      triggerLifecycleEventId
      recommendedActionTypes
      agentDispatchRecommended
      staffReviewRequired
      processingStatus
      versionAt
      requiredAction
      processReasons
      creatorRelationship {
        id
        creatorId
        businessDeveloperId
        aiEngagementStatus
        aiEngagementSource
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
        activeRunId
        activeRunBaseCheckpointId
        stateUpdatedAt
        activeCollaborationRecordIds
        pendingActionProposalId
        shopStates {
          shopId
          lifecycleStage
          tagIds
          lastContactedAt
          lastInvitedAt
          lastQualifiedAt
        }
      }
      collaboration {
        id
        userId
        shopId
        lastSignalAt
        workHandledUntil
        nextSellerActionAt
        processingStatus
        requiredAction
        processReasons
        creatorId
        creatorOpenId
        productId
        sampleApplicationRecordId
        affiliateCollaborationId
        collaborationType
        platformCollaborationId
        creatorImId
        lifecycleStage
        lastCreatorMessageId
        lastCreatorMessageAt
        stateUpdatedAt
        startedAt
        endedAt
        createdAt
        updatedAt
        predictionSnapshots {
          sourceCacheId
          predictionType
          scenario
          status
          output
          model
          diagnostics
          predictedAt
          capturedAt
        }
      }
      sampleApplicationRecord {
        id
        userId
        shopId
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
      context {
        creatorProfile {
          id
          platform
          creatorOpenId
          creatorImId
          username
          nickname
          avatarUrl
          followerCount
          categoryIds
          marketplaceSnapshotJson
          aggregatedSignalsSnapshotJson
        }
        creatorRelation {
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
          creatorId
          creatorOpenId
          productId
          sampleApplicationRecordId
          affiliateCollaborationId
          collaborationType
          platformCollaborationId
          lifecycleStage
          processingStatus
          requiredAction
          processReasons
          lastSignalAt
          workHandledUntil
          updatedAt
        }
        focusCollaboration {
          id
          creatorId
          productId
          lifecycleStage
          processingStatus
          updatedAt
        }
        ambiguousCollaborationCandidates {
          id
          creatorId
          creatorOpenId
          productId
          sampleApplicationRecordId
          affiliateCollaborationId
          collaborationType
          platformCollaborationId
          lifecycleStage
          processingStatus
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
          providerFreshnessKnown
          shopId
          productIds
        }
        pendingProposals {
          id
          type
          status
          operatorSummary
          creatorId
          creatorRelationshipId
          collaborationRecordId
          sourceWorkBoundary {
            subjectType
            creatorRelationshipId
            collaborationRecordId
            workKind
            workBundleKind
            versionAt
            triggerKind
            triggerId
            recommendedActionTypes
          }
          decision {
            note
            decidedAt
            actorType
            actorId
          }
          updatedAt
        }
        missingContext {
          reason
          severity
          message
        }
        recommendedActionTypes
      }
      latestPendingProposal {
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
        creatorRelationshipId
        collaborationRecordId
        sourceWorkBoundary {
          subjectType
          creatorRelationshipId
          collaborationRecordId
          workKind
          workBundleKind
          versionAt
          triggerKind
          triggerId
          recommendedActionTypes
        }
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
          creatorId
          preferredChannel
          emailSubject
          subjectHash
          subjectLength
          parts { kind text textHash textLength draftAssetId caption captionHash captionLength emailDisposition fileName mimeType sizeBytes sha256 productId targetCollaborationId sampleApplicationId }
        }
        updatedAt
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
    proposal?: Pick<
      GQL.ActionProposal,
      "id" | "status" | "operatorSummary" | "baseCheckpointId" | "candidateCheckpointId"
    > | null;
    collaborationRecord?: Pick<
      GQL.AffiliateCollaborationRecord,
      "id" | "processingStatus" | "processReasons" | "workHandledUntil" | "stateUpdatedAt"
    > | null;
  };
}
