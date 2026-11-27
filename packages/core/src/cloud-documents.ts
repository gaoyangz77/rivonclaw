// Backend GraphQL documents shared by every host that talks to the backend
// directly: Desktop (init queries, subscriptions) and the Panel web host.
// Moved from apps/desktop/src/cloud (ADR-123 step 2b).

export const TOOL_SPECS_SYNC_QUERY = `
  query ToolSpecsSync {
    toolSpecs {
      id
      name
      category
      dataScope
      displayName
      description
      supportsPersistResult
      resultSchema
      resultMode
      surfaces
      runProfiles
      graphqlOperation
      operationType
      parameters {
        name
        type
        description
        graphqlVar
        required
        nullable
        defaultValue
        enumValues
        isList
        children {
          name
          type
          description
          graphqlVar
          required
          nullable
          defaultValue
          enumValues
          isList
          children {
            name
            type
            description
            graphqlVar
            required
            nullable
            defaultValue
            enumValues
            isList
            children {
              name
              type
              description
              graphqlVar
              required
              nullable
              defaultValue
              enumValues
              isList
              children {
                name
                type
                description
                graphqlVar
                required
                nullable
                defaultValue
                enumValues
                isList
                children {
                  name
                  type
                  description
                  graphqlVar
                  required
                  nullable
                  defaultValue
                  enumValues
                  isList
                  children {
                    name
                    type
                    description
                    graphqlVar
                    required
                    nullable
                    defaultValue
                    enumValues
                    isList
                  }
                }
              }
            }
          }
        }
      }
      contextBindings {
        paramName
        contextField
      }
      restMethod
      restEndpoint
      restContentType
      supportedPlatforms
      prune
    }
  }
`;

export const INIT_ME_QUERY = `
  query {
    me {
      userId
      email
      name
      createdAt
      enrolledModules
      entitlementKeys
      accountId
      isOwner
      permissionScopes
      roleName
      defaultRunProfileId
      support {
        telegramDebugProxyToken
      }
      agent {
        active
        inviteCode
        enabledAt
        enabledByUserId
        disabledAt
        disabledByUserId
      }
    }
  }
`;

export const INIT_SURFACES_QUERY = `
  query {
    surfaces {
      id
      name
      description
      userId
      allowedToolIds
      createdAt
      updatedAt
    }
  }
`;

export const INIT_RUN_PROFILES_QUERY = `
  query {
    runProfiles {
      id
      name
      userId
      surfaceId
      selectedToolIds
    }
  }
`;

export const INIT_SHOPS_QUERY = `
  query {
    shops {
      id
      userId
      platform
      platformAppId
      platformShopId
      collectionKey
      shopName
      alias
      authStatus
      region
      accessTokenExpiresAt
      refreshTokenExpiresAt
      services {
        customerService {
          enabled
          pickupReminderEnabled
          deliveryFailureReminderEnabled
          messageAutoTranslation
          unpaidOrderReachoutEnabled
          unpaidOrderReachoutStages { id enabled delayMinutes messageTemplate }
          unpaidOrderReachoutExperiment { enabled holdoutPercent experimentId startedAt }
          businessPrompt
          runProfileId
          csDeviceId
          escalationChannelId
          escalationRecipientId
          platformSystemPrompt
          reviewOptimization {
            enabled
            badReviewReachout {
              enabled
              mode
              stars
              recentDays
              maxAttempts
            }
          }
        }
        wms {
          enabled
        }
        affiliateService {
          enabled
          runProfileId
          deviceId
          businessPrompt
          campaignDailyCreatorOutreachLimit
          campaignDailyCreatorOutreachLimitRevision
          campaignDailyCreatorOutreachLimitUpdatedAt
          decisionThresholds {
            minExpectedSalesUnits
          }
          samplePerformanceFollowUp {
            enabled
            lowOrderThreshold
            stages { id delayDays }
            revision
            updatedAt
          }
        }
      }
    }
  }
`;

const ADS_ADVERTISER_FIELDS = `
      __typename
      id
      userId
      platform
      ownerType
      advertiserId
      advertiserName
      advertiserRole
      platformStatus
      currency
      timezone
      createdAt
      updatedAt
      auth {
        status
        accessTokenExpiresAt
        refreshTokenExpiresAt
        authorizedAt
        lastRefreshedAt
        lastError
      }
`;

const ADS_STORE_ACCESS_FIELDS = `
      __typename
      id
      userId
      platform
      adsAdvertiserId
      advertiserId
      storeId
      storeName
      storeAuthorizedBcId
      businessCenterId
      storeRole
      storeStatus
      isGmvMaxAvailable
      exclusiveAuthorizedAdvertiserId
      exclusiveAuthorizationStatus
      createdAt
      updatedAt
`;

export const INIT_ADS_ADVERTISERS_QUERY = `
  query {
    adsAdvertisers { ${ADS_ADVERTISER_FIELDS} }
    adsStoreAccesses(status: ACTIVE) { ${ADS_STORE_ACCESS_FIELDS} }
  }
`;

export const ADS_ENTITY_DELTA_QUERY = `
  query AdsEntityDelta($ids: [ID!]!) {
    adsAdvertisers(ids: $ids) { ${ADS_ADVERTISER_FIELDS} }
    adsStoreAccesses(adsAdvertiserIds: $ids, status: ACTIVE) { ${ADS_STORE_ACCESS_FIELDS} }
  }
`;

export const INIT_PLATFORM_APPS_QUERY = `
  query {
    platformApps {
      id
      platform
      market
      sellerType
      status
      label
      apiBaseUrl
      authLinkUrl
    }
  }
`;

export const INIT_BILLING_OVERVIEW_QUERY = `
  query {
    billingOverview {
      accountServices {
        product
        entitlement {
          scopeType scopeId coverageScopeType coverageScopeId product allowed code source validUntil
          subscription {
            planId provider status currency amountMinor currentPeriodStart currentPeriodEnd
            graceUntil renewalMode cancelAtPeriodEnd
          }
          usage { metric window usedPercent remainingPercent refreshAt }
        }
      }
      accountLlm {
        planId
        entitlement {
          scopeType
          scopeId
          product
          allowed
          code
          source
          subscription {
            planId
            provider
            status
            currency
            amountMinor
            currentPeriodStart
            currentPeriodEnd
            graceUntil
            renewalMode
            cancelAtPeriodEnd
          }
          validUntil
          usage {
            metric
            window
            usedPercent
            remainingPercent
            refreshAt
          }
        }
      }
      shops {
        shopId
        shopName
        customerService {
          scopeType
          scopeId
          coverageScopeType
          coverageScopeId
          product
          allowed
          code
          source
          subscription {
            planId
            provider
            status
            currency
            amountMinor
            currentPeriodStart
            currentPeriodEnd
            graceUntil
            renewalMode
            cancelAtPeriodEnd
          }
          validUntil
          usage {
            metric
            window
            usedPercent
            remainingPercent
            refreshAt
          }
        }
        inventory {
          scopeType
          scopeId
          product
          allowed
          code
          source
          subscription {
            planId
            provider
            status
            currency
            amountMinor
            currentPeriodStart
            currentPeriodEnd
            graceUntil
            renewalMode
            cancelAtPeriodEnd
          }
          validUntil
          usage {
            metric
            window
            usedPercent
            remainingPercent
            refreshAt
          }
        }
        affiliate {
          scopeType
          scopeId
          product
          allowed
          code
          source
          subscription {
            planId
            provider
            status
            currency
            amountMinor
            currentPeriodStart
            currentPeriodEnd
            graceUntil
            renewalMode
            cancelAtPeriodEnd
          }
          validUntil
          usage {
            metric
            window
            usedPercent
            remainingPercent
            refreshAt
          }
        }
        analytics {
          scopeType
          scopeId
          product
          allowed
          code
          source
          subscription {
            planId
            provider
            status
            currency
            amountMinor
            currentPeriodStart
            currentPeriodEnd
            graceUntil
            renewalMode
            cancelAtPeriodEnd
          }
          validUntil
          usage {
            metric
            window
            usedPercent
            remainingPercent
            refreshAt
          }
        }
      }
    }
  }
`;

export const INIT_WMS_ACCOUNTS_QUERY = `
  query {
    readWmsAccounts(input: {}) {
      id
      userId
      provider
      label
      endpoint
      status
      lastSyncedAt
      lastSyncError
      notes
      createdAt
      updatedAt
    }
  }
`;

export const INIT_WAREHOUSES_QUERY = `
  query {
    readWarehouses(input: {}) {
      id
      userId
      provider
      warehouseType
      name
      code
      externalWarehouseId
      sourceId
      regionCode
      address {
        addressLine1
        addressLine2
        city
        district
        fullAddress
        postalCode
        region
        regionCode
        state
      }
      status
      lastSyncedAt
      notes
      createdAt
      updatedAt
    }
  }
`;

export const INIT_INVENTORY_GOODS_QUERY = `
  query {
    readInventoryGoods(input: {}) {
      id
      userId
      sku
      name
      status
      gtin
      barcode
      hsCode
      countryOfOrigin
      weightValue
      weightUnit
      lengthValue
      widthValue
      heightValue
      dimensionUnit
      declaredValue
      declaredValueCurrency
      isBattery
      isHazmat
      imageAssetId
      imageUri
      createdAt
      updatedAt
    }
  }
`;

export const OAUTH_COMPLETE_SUBSCRIPTION = `
  subscription OAuthComplete {
    oauthComplete {
      shopId
      shopName
      platform
      shops {
        shopName
        __typename
        id
        userId
        platform
        platformAppId
        platformShopId
        collectionKey
        alias
        authStatus
        region
        accessTokenExpiresAt
        refreshTokenExpiresAt
        services {
          customerService {
            enabled
            pickupReminderEnabled
            deliveryFailureReminderEnabled
            messageAutoTranslation
            unpaidOrderReachoutEnabled
            unpaidOrderReachoutStages { id enabled delayMinutes messageTemplate }
            unpaidOrderReachoutExperiment { enabled holdoutPercent experimentId startedAt }
            businessPrompt
            runProfileId
            csDeviceId
            escalationChannelId
            escalationRecipientId
            platformSystemPrompt
            reviewOptimization {
              enabled
              badReviewReachout {
                enabled
                mode
                stars
                recentDays
                maxAttempts
              }
            }
          }
          wms {
            enabled
          }
          affiliateService {
            enabled
            runProfileId
            deviceId
            businessPrompt
            campaignDailyCreatorOutreachLimit
            campaignDailyCreatorOutreachLimitRevision
            campaignDailyCreatorOutreachLimitUpdatedAt
            decisionThresholds {
              minExpectedSalesUnits
            }
            samplePerformanceFollowUp {
              enabled
              lowOrderThreshold
              stages { id delayDays }
              revision
              updatedAt
            }
          }
        }
      }
    }
  }
`;

export const ADS_OAUTH_COMPLETE_SUBSCRIPTION = `
  subscription AdsOAuthComplete {
    adsOAuthComplete {
      platform
      advertiserIds
      advertiserCount
    }
  }
`;

export const AFFILIATE_OUTREACH_ACCOUNT_CONNECTED_SUBSCRIPTION = `
  subscription AffiliateOutreachAccountConnected {
    affiliateOutreachAccountConnected {
      channel
      accountId
      displayName
      address
    }
  }
`;

export const SHOP_UPDATED_SUBSCRIPTION = `
  subscription ShopUpdated {
    shopUpdated {
      __typename
      id
      userId
      platform
      platformAppId
      platformShopId
      collectionKey
      shopName
      alias
      authStatus
      region
      accessTokenExpiresAt
      refreshTokenExpiresAt
      services {
        customerService {
          enabled
          pickupReminderEnabled
          deliveryFailureReminderEnabled
          messageAutoTranslation
          unpaidOrderReachoutEnabled
          unpaidOrderReachoutStages { id enabled delayMinutes messageTemplate }
          unpaidOrderReachoutExperiment { enabled holdoutPercent experimentId startedAt }
          businessPrompt
          runProfileId
          csDeviceId
          escalationChannelId
          escalationRecipientId
          platformSystemPrompt
          reviewOptimization {
            enabled
            badReviewReachout {
              enabled
              mode
              stars
              recentDays
              maxAttempts
            }
          }
        }
        wms {
          enabled
        }
        affiliateService {
          enabled
          runProfileId
          deviceId
          businessPrompt
          campaignDailyCreatorOutreachLimit
          campaignDailyCreatorOutreachLimitRevision
          campaignDailyCreatorOutreachLimitUpdatedAt
          decisionThresholds {
            minExpectedSalesUnits
          }
          samplePerformanceFollowUp {
            enabled
            lowOrderThreshold
            stages { id delayDays }
            revision
            updatedAt
          }
        }
      }
    }
  }
`;

export const CS_ESCALATION_EVENT_SUBSCRIPTION = `
  subscription CsEscalationEvent {
    csEscalationEvent {
      escalation {
        id
        shopId
        conversationId
        buyerUserId
        buyerNickname
        orderId
        reason
        context
        status
        version
      }
      event {
        id
        type
        status
        decision
        instructions
        createdAt
        updatedAt
      }
    }
  }
`;

export const AFFILIATE_ESCALATION_CHANGED_SUBSCRIPTION = `
  subscription AffiliateEscalationChanged {
    affiliateEscalationChanged {
      escalationId
      status
      version
    }
  }
`;

export const CS_CONVERSATION_CHANGED_SUBSCRIPTION = `
  subscription CsConversationChanged($shopIds: [ID!]) {
    csConversationChanged(shopIds: $shopIds) {
      shopId
      platformShopId
      conversationId
      unreadCount
      status
      replyStatus
      isOpen
      platformConversationStatus
      aiEnabled
      createTime
      latestMessageTime
      latestMessagePreview
      lastPendingAt
      resolvedAt
      updatedAt
      openEscalationCount
      latestOpenEscalationId
      latestOpenEscalationStatus
      latestOpenEscalationUpdatedAt
      dispatchHint {
        reason
        source
        messageId
        messageIndex
        eventTime
        dispatchEventTime
        operatorInstruction
        badReviewReachoutRoundId
        batchId
      }
      orderId
      participantCount
      canSendMessage
      participants {
        role
        userId
        imUserId
        nickname
        avatar
      }
      latestMessage {
        messageId
        type
        content
        index
        createTime
        sender {
          role
          userId
          imUserId
          nickname
          avatar
        }
      }
    }
  }
`;

export const AFFILIATE_WORK_ITEM_CHANGED_SUBSCRIPTION = `
  subscription AffiliateWorkItemChanged {
    affiliateWorkItemChanged {
      workItem {
        id
        triggerShopId
        triggerPlatformShopId
        routingShopIds
        routingPlatformShopIds
        subjectType
        creatorRelationshipId
        affiliateCollaborationId
        workKind
        workBundleKind
        agentWorkingAgendaItems {
          key
          owner
          scopeType
          sourceType
          workKind
          requiredAction
          shopId
          shopRegion
          productId
          campaignId
          affiliateCollaborationId
          sampleApplicationRecordId
          reviewDisposition
          proposalId
          reasons
          nextActionAt
          sampleContentFollowUpStage
          samplePerformanceFollowUpStage
          samplePerformanceFollowUpStageId
          samplePerformanceConfigRevision
          samplePerformanceFollowUpDelayDays
          samplePerformanceFollowUpAnchorAt
          samplePerformanceFollowUpExpiresAt
          samplePerformanceLowOrderThreshold
          samplePerformanceAttributedOrderCount
          samplePerformanceSnapshotHash
          boundaryEventCursor
          escalationReason
          escalationQuestion
          escalationContext
          escalationDecision
          escalationInstructions
          escalationResolvedAt
          updatedAt
          conversationWindow {
            coverage
            resolvedThroughRelationshipSequence
            lastPendingRelationshipSequence
            totalCreatorTurnCount
            includedCreatorTurnCount
            includedCharacterCount
            maxCreatorTurnCount
            maxCharacterCount
            containsUnsupportedContent
            sellerAnchor {
              relationshipSequence occurredAt direction channel subject trust
              parts { sequence kind text fileName mimeType sizeBytes caption agentReadable productId shopId targetCollaborationId sampleApplicationId providerType summary contentAvailability }
            }
            creatorTurns {
              relationshipSequence occurredAt direction channel subject trust
              parts { sequence kind text fileName mimeType sizeBytes caption agentReadable productId shopId targetCollaborationId sampleApplicationId providerType summary contentAvailability }
            }
          }
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
            predictionEvidence {
              evidenceMode
              expectedSales {
                family
                status
                selection { requestedScope effectiveScope modelVersion evaluatedScopes { tenantScope tenantId artifactFound expectedSalesReliability reliabilityReasons reason } }
                error { code message }
                value { units percentile reliability reliabilityReasons quality { score level featureCompletenessScore dataSupportScore probabilityMarginScore predictionBucketSupportScore interpretation } }
              }
              humanDecision {
                family
                status
                selection { requestedScope effectiveScope modelVersion evaluatedScopes { tenantScope tenantId artifactFound expectedSalesReliability reliabilityReasons reason } }
                error { code message }
                value { wouldApprove approvalProbability approvalPercentile cutoff historicalApprovalRate }
              }
            }
            resolvedContext { shopId sampleApplicationRecordId platformApplicationId creatorId creatorOpenId creatorUsername creatorNickname productId skuId productTitle source }
            message
            predictedAt
            capturedAt
          }
          lastFailedExecution {
            proposalId
            proposalType
            operatorSummary
            failedAt
            errorMessage
            errorRetryability
            consecutiveFailureCount
            consecutiveFailureCountTruncated
          }
          sampleTerminalState {
            cause
            sampleWorkStatus
            platformStatus
          }
          hasTargetCollaboration
          minExpectedSalesReference {
            availability
            units
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
            sampleReviewIntent { sampleApplicationRecordId platformApplicationId projectionRevision reviewDispositionRevision lastObservedAt decision executionMode rejectReason rejectReasonExplanation }
            creatorTagIntent { operation manualTagId systemTag contextShopId }
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
              sampleReviewIntent { sampleApplicationRecordId platformApplicationId projectionRevision reviewDispositionRevision lastObservedAt decision executionMode rejectReason rejectReasonExplanation }
              creatorTagIntent { operation manualTagId systemTag contextShopId }
            }
          }
        }
        recommendedActionTypes
        agentDispatchRecommended
        staffReviewRequired
        processingStatus
        requiredAction
        processReasons
        versionAt
        versionKey
        agendaItemsSnapshotId
        creatorRelationship {
          id
          creatorId
          blocked
          blockedShopIds
          systemTags
          lastInboundAt
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
            workKind
            requiredAction
            shopId
            shopRegion
            affiliateCollaborationId
            sampleApplicationRecordId
            proposalId
            reasons
            nextActionAt
            sampleContentFollowUpStage
            samplePerformanceFollowUpStage
            samplePerformanceFollowUpStageId
            samplePerformanceConfigRevision
            samplePerformanceFollowUpDelayDays
            samplePerformanceFollowUpAnchorAt
            samplePerformanceFollowUpExpiresAt
            samplePerformanceLowOrderThreshold
            samplePerformanceAttributedOrderCount
            samplePerformanceSnapshotHash
            boundaryEventCursor
            escalationReason
            escalationQuestion
            escalationContext
            escalationDecision
            escalationInstructions
            escalationResolvedAt
            updatedAt
          }
          workSummary {
            agentRequiredCount
            staffRequiredCount
            externalWaitingCount
            nextActionAt
            businessDeveloperId
            businessDeveloperDeviceId
          }
          stateUpdatedAt
          activeAffiliateCollaborationIds
          shopStates {
            shopId
            sampleTier
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
            systemTags
            shopStates {
              shopId
              sampleTier
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
            shippedAt
            deliveredAt
            latestObservedContentId
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
  }
`;

export const AFFILIATE_ACTION_PROPOSAL_CHANGED_SUBSCRIPTION = `
  subscription AffiliateActionProposalChanged {
    affiliateActionProposalChanged {
      proposal {
        id
        viewerCanApprove
        viewerCanAccessCurrentCreator
        userId
        focusShopId
        shopIds
        campaignId
        creatorId
        creatorRelationshipId
        creatorRelationship {
          id
          creatorId
          systemTags
          shopStates {
            shopId
          }
        }
        creatorProfile {
          id
          platform
          creatorOpenId
          creatorImId
          username
          nickname
          avatarUrl
          createdAt
          updatedAt
        }
        affiliateCollaborationId
        sampleApplicationRecordId
        productId
        sourceWorkBoundary {
          subjectType
          creatorRelationshipId
          affiliateCollaborationId
          sampleApplicationRecordId
          productId
          workKind
          workBundleKind
          versionAt
          triggerKind
          triggerId
          triggerChannel
          triggerLifecycleEventId
          recommendedActionTypes
        }
        affiliateCollaboration {
          id
          userId
          shopId
          creatorIds
          creatorOpenIds
          productIds
          type
          status
          platformCollaborationId
          campaignId
          commissionRate
          effectiveTime
          platformUpdatedAt
          firstObservedAt
          lastObservedAt
          projectionRevision
          lastSyncSource
          createdAt
          updatedAt
        }
        sampleApplicationRecord {
          id
          platformApplicationId
          creatorId
          creatorOpenId
          productId
          affiliateCollaborationId
          collaborationType
          platformCollaborationId
          sampleWorkStatus
          trackingNumber
          carrier
          shippedAt
          deliveredAt
          observedContentCount
          latestObservedContentAt
          updatedAt
        }
        productSummary {
          productId
          title
          coverImage
          status
          priceMin
          priceMax
          skus {
            skuId
            skuName
            sellerSku
            price
            currency
          }
        }
        type
        status
        operatorSummary
        predictionCacheIds
        predictionSnapshots {
          sourceCacheId
          predictionType
          captureMode
          scenario
          status
          output
          model
          diagnostics
          predictionEvidence {
            evidenceMode
            expectedSales {
              family
              status
              selection { requestedScope effectiveScope modelVersion evaluatedScopes { tenantScope tenantId artifactFound expectedSalesReliability reliabilityReasons reason } }
              error { code message }
              value { units percentile reliability reliabilityReasons quality { score level featureCompletenessScore dataSupportScore probabilityMarginScore predictionBucketSupportScore interpretation } }
            }
            humanDecision {
              family
              status
              selection { requestedScope effectiveScope modelVersion evaluatedScopes { tenantScope tenantId artifactFound expectedSalesReliability reliabilityReasons reason } }
              error { code message }
              value { wouldApprove approvalProbability approvalPercentile cutoff historicalApprovalRate }
            }
          }
          message
          predictedAt
          capturedAt
          subject {
            sampleApplicationRecordId
            platformApplicationId
            creatorId
            creatorOpenId
            creatorCandidateId
            campaignId
            affiliateCollaborationId
            platformCollaborationId
            productId
          }
          resolvedContext {
            shopId
            campaignId
            affiliateCollaborationId
            platformCollaborationId
            sampleApplicationRecordId
            platformApplicationId
            creatorId
            creatorOpenId
            creatorUsername
            creatorNickname
            productId
            skuId
            productTitle
            source
          }
        }
        steps {
          stepId
          shopId
          campaignId
          affiliateCollaborationId
          sampleApplicationRecordId
          productId
          type
          operatorSummary
          predictionCacheIds
          sampleReviewIntent {
            sampleApplicationRecordId
            platformApplicationId
            reviewDispositionRevision
            decision
            executionMode
            rejectReason
            rejectReasonExplanation
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
            creatorOpenId
            preferredChannel
            emailSubject
            subjectHash
            subjectLength
            parts { kind text textHash textLength draftAssetId caption captionHash captionLength emailDisposition fileName mimeType sizeBytes sha256 productId targetCollaborationId sampleApplicationId }
          }
        }
        baseCheckpointId
        candidateCheckpointId
        createdAt
        updatedAt
        expiresAt
        policySnapshot {
          action
          requiresApproval
          matchedPolicyIds
          reasons
        }
        reviewSource
        humanReviewRequest {
          reason
          question
        }
        decision {
          note
          decidedAt
          actorType
          actorId
        }
        sampleReviewIntent {
          sampleApplicationRecordId
          platformApplicationId
          reviewDispositionRevision
          decision
          executionMode
          rejectReason
          rejectReasonExplanation
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
          creatorOpenId
          preferredChannel
          emailSubject
          subjectHash
          subjectLength
          parts { kind text textHash textLength draftAssetId caption captionHash captionLength emailDisposition fileName mimeType sizeBytes sha256 productId targetCollaborationId sampleApplicationId }
        }
        creatorTagIntent {
          operation
          manualTagId
          systemTag
          contextShopId
        }
        referencedManualTags {
          id
          name
          sensitive
          updatedAt
        }
        blockCreatorIntent {
          creatorId
          reason
        }
        campaignProductUpdateIntent {
          campaignId
          campaignProductId
          productId
          commissionRate
          maxCommissionRate
          sampleOfferMode
          sampleQuota
          sampleUnitCostAmount
          sampleUnitCostCurrency
          promotionPriority
        }
        approvalPolicyUpdateIntent {
          policyId
          action
          manualTagIds
          excludedManualTagIds
          sampleTiers
          excludedSampleTiers
          campaignIds
          productIds
          reason
          enabled
        }
        candidateDecisionIntent {
          candidateIds
          status
          rationale
        }
        executionResult {
          platformObjectId
          domainObjectId
          lifecycleEventIds
          executedAt
          errorMessage
          deliveryId
          deliveryStatus
          preferredChannel
          actualChannel
          channelSelectionSource
        }
      }
    }
  }
`;
