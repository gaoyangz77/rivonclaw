import { gql } from "@apollo/client/core";

export const SHOP_FIELDS_FRAGMENT = gql`
  fragment ShopFields on Shop {
    id
    platform
    platformAppId
    platformShopId
    collectionKey
    shopName
    alias
    authStatus
    region
    timezone
    timezoneSource
    accessTokenExpiresAt
    refreshTokenExpiresAt
    services {
      customerService {
        enabled
        unpaidOrderReachoutEnabled
        unpaidOrderReachoutStages {
          id
          enabled
          delayMinutes
          messageTemplate
        }
        unpaidOrderReachoutExperiment {
          enabled
          holdoutPercent
          experimentId
          startedAt
        }
        businessPrompt
        runProfileId
        csDeviceId
        csProviderOverride
        csModelOverride
        escalationChannelId
        escalationRecipientId
        platformSystemPrompt
        reviewOptimization {
          enabled
          badReviewReachout {
            enabled
            stars
            recentDays
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
      }
    }
  }
`;

export const SHOPS_QUERY = gql`
  ${SHOP_FIELDS_FRAGMENT}
  query Shops {
    shops {
      ...ShopFields
    }
  }
`;

export const SHOP_QUERY = gql`
  ${SHOP_FIELDS_FRAGMENT}
  query Shop($id: ID!) {
    shop(id: $id) {
      ...ShopFields
    }
  }
`;

export const SHOP_AUTH_STATUS_QUERY = gql`
  query ShopAuthStatus($id: ID!) {
    shopAuthStatus(id: $id) {
      hasToken
      accessTokenExpiresAt
      refreshTokenExpiresAt
    }
  }
`;

export const PLATFORM_APPS_QUERY = gql`
  query PlatformApps {
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

export const UPDATE_SHOP_MUTATION = gql`
  ${SHOP_FIELDS_FRAGMENT}
  mutation UpdateShop($id: ID!, $input: UpdateShopInput!) {
    updateShop(id: $id, input: $input) {
      ...ShopFields
    }
  }
`;

export const ECOMMERCE_UPDATE_SHOP_MUTATION = gql`
  mutation EcommerceUpdateShop($shopId: String!, $alias: String) {
    ecommerceUpdateShop(shopId: $shopId, alias: $alias) {
      shopId
      message
    }
  }
`;

export const DELETE_SHOP_MUTATION = gql`
  mutation DeleteShop($id: ID!) {
    deleteShop(id: $id)
  }
`;

export const INITIATE_TIKTOK_OAUTH_MUTATION = gql`
  mutation InitiateTikTokOAuth($platformAppId: ID!) {
    initiateTikTokOAuth(platformAppId: $platformAppId) {
      authUrl
      state
    }
  }
`;

export const PRESET_SKILLS_QUERY = gql`
  query PresetSkills($serviceIds: [ServiceId!]) {
    presetSkills(serviceIds: $serviceIds)
  }
`;

export const PRESET_SKILL_MANIFEST_QUERY = gql`
  query PresetSkillManifest($serviceIds: [ServiceId!]) {
    presetSkillManifest(serviceIds: $serviceIds) {
      serviceId
      slug
      localSlug
      displayName
      currentHash
      previousHashes
      autoUpdatePolicy
      version
      updatedAt
    }
  }
`;

export const ECOMMERCE_GET_PRODUCT_QUERY = gql`
  query EcommerceGetProduct($shopId: String!, $productId: String!) {
    ecommerceGetProduct(shopId: $shopId, productId: $productId) {
      productId
      title
      status
      description
      createTime
      updateTime
      images {
        url
        width
        height
      }
      brand {
        id
        name
      }
      categoryChains {
        id
        localName
        parentId
        isLeaf
      }
      productTypes
      skus {
        id
        sellerSku
        price {
          salePrice
          currency
          taxExclusivePrice
        }
        listPrice {
          amount
          currency
        }
        statusInfo {
          status
          deactivationSource
        }
        inventory {
          warehouseId
          quantity
          backorderQuantity
        }
      }
    }
  }
`;

export const ECOMMERCE_SEARCH_PRODUCTS_QUERY = gql`
  query EcommerceSearchProducts($shopId: String!, $status: EcomProductStatus, $limit: Int) {
    ecommerceSearchProducts(shopId: $shopId, status: $status, limit: $limit) {
      productId
      title
      coverImage
      status
      priceMin
      priceMax
    }
  }
`;

const AFFILIATE_CAMPAIGN_FIELDS = gql`
  fragment AffiliateCampaignFields on AffiliateCampaign {
    id
    userId
    shopId
    name
    status
    productSnapshotId
    productSnapshotHash
    productSnapshot {
      id
      productId
      title
      sellerSkus
      description
      status
      coverImage
      originalCurrency
      minimumPriceUsdAmount
      maximumPriceUsdAmount
      categoryPathIds
      categoryPathNames
      brandId
      brandName
      observedAt
      snapshotHash
    }
    searchPlanGuidance
    searchPlanExplanationLocale
    searchPlanning {
      state
      generationSequence
      activePlanId
      lastPlanCompletedAt
      generationRequest {
        id
        generation
        reason
        configRevision
        requestedAt
        nextAttemptAt
        desktopAttemptCount
        cloudAttemptCount
        generating
        blocked
        errorCode
      }
    }
    market
    resolvedTimeZone
    dailyOutreachTarget
    products {
      productId
      commissionRatePercent
      shopAdsCommissionRatePercent
    }
    endDays
    isSampleApprovalExempt
    sellerContactEmail
    selectionPolicy {
      strategy
    }
    messageTemplateText
    messageTemplateSource
    messageProductName
    templateVersion
    templateTextHash
    configRevision
    needsReconfiguration
    nextTickAt
    activatedAt
    pausedAt
    completedAt
    createdAt
    updatedAt
  }
`;

const AFFILIATE_CAMPAIGN_EXECUTION_FIELDS = gql`
  fragment AffiliateCampaignExecutionFields on AffiliateCampaignDailyExecution {
    id
    campaignId
    shopId
    market
    timezone
    marketLocalDate
    configRevision
    templateVersion
    selectionStrategy
    counterSchemaVersion
    modelVersion
    requestedTarget
    allocatedTarget
    effectiveTarget
    status
    searchPlanExecutions {
      searchPlanId
      generation
      phraseKey
      phrase
      startPageSequence
      endPageSequence
      scanned
      matched
      qualified
      scheduled
      startedAt
      lastSearchedAt
      completedAt
    }
    riskState
    riskReason
    counters {
      scanned
      matched
      protected
      outreachPolicyBlocked
      evaluated
      qualificationFailed
      qualified
      scheduled
      submitted
      sent
      replied
      failed
      uncertain
      cancelled
    }
    nextTickAt
    stopReason
    completionReason
    completedAt
    underDeliveryReason
    createdAt
    updatedAt
  }
`;

export const AFFILIATE_CAMPAIGNS_QUERY = gql`
  ${AFFILIATE_CAMPAIGN_FIELDS}
  query AffiliateCampaigns($input: ReadAffiliateCampaignsInput!) {
    affiliateCampaigns(input: $input) {
      ...AffiliateCampaignFields
    }
  }
`;

export const AFFILIATE_CAMPAIGN_SUMMARY_QUERY = gql`
  ${AFFILIATE_CAMPAIGN_EXECUTION_FIELDS}
  query AffiliateCampaignSummary($campaignId: ID!) {
    affiliateCampaignSummary(campaignId: $campaignId) {
      campaignId
      totalCreators
      lifetimeReachedOut
      activeDayCount
      deliveryFailureReasons {
        code
        count
      }
      counters {
        scanned
        matched
        protected
        outreachPolicyBlocked
        evaluated
        qualificationFailed
        qualified
        scheduled
        submitted
        sent
        replied
        failed
        uncertain
        cancelled
      }
      shopDailyCapacity {
        marketLocalDate
        effectiveDailyLimit
        countedOutreachCount
        remainingOutreachCapacity
        activeCampaignDailyTargetSum
        targetToLimitRatio
        nextSlotAt
        circuitOpenUntil
        circuitReason
      }
      targetCollaborationCreateQuota {
        active
        firstObservedAt
        lastObservedAt
        lastSuccessfulCreateAt
        liveQuotaErrorCountToday
        affectedDeliveryCountToday
        waitingDeliveryCount
        nextRetryAt
        recentEvents {
          occurredAt
          outcome
          affectedDeliveryCount
          inferredFromLegacy
        }
      }
      latestExecution {
        ...AffiliateCampaignExecutionFields
      }
    }
  }
`;

export const AFFILIATE_CAMPAIGN_EXECUTIONS_QUERY = gql`
  ${AFFILIATE_CAMPAIGN_EXECUTION_FIELDS}
  query AffiliateCampaignDailyExecutions($input: ReadAffiliateCampaignDailyExecutionsInput!) {
    affiliateCampaignDailyExecutions(input: $input) {
      ...AffiliateCampaignExecutionFields
    }
  }
`;

export const AFFILIATE_CAMPAIGN_AI_READINESS_QUERY = gql`
  query AffiliateCampaignAiReadiness {
    affiliateCampaignAiReadiness {
      ready
      status
      modelVersion
      contractVersion
      checkedAt
    }
  }
`;

export const AFFILIATE_CAMPAIGN_CREATOR_STATES_QUERY = gql`
  query AffiliateCampaignCreatorStates($input: ReadAffiliateCampaignCreatorStatesInput!) {
    affiliateCampaignCreatorStates(input: $input) {
      nextCursor
      items {
        id
        campaignId
        shopId
        creatorId
        productId
        market
        status
        firstSeenAt
        lastSeenAt
        searchOccurrenceCount
        eligibilityCategory
        eligibilityReasonCode
        eligibilityPolicyVersion
        eligibilityEvaluatedAt
        sourceSearchPlanIds
        latestSearchDailyExecutionId
        latestSearchPlanId
        latestSearchPlanGeneration
        latestSearchProviderOrdinal
        latestSearchMatchedAt
        followerCount
        decisionReason
        selectionStrategy
        predictionStatus
        filterResult
        decisionReasonCodes
        providerOrdinal
        providerPageSequence
        evaluationAttemptCount
        nextEvaluationAt
        evaluationFailureStage
        preApprovalProbability
        preApprovalCutoff
        preApproved
        preApprovalModelVersion
        preApprovalContractVersion
        preApprovalObservedAt
        qualificationDecision
        qualifiedAt
        scheduledAt
        reachedOutAt
        repliedAt
        outreachErrorCode
        creatorProfile {
          id
          platform
          creatorOpenId
          username
          nickname
          avatarUrl
          bioDescription
          lastObservedAt
        }
        creatorPerformance {
          market
          observedAt
          sourceType
          followerCount
          categoryIds
        }
        creatorRelationship {
          id
          shopStates {
            shopId
          }
          lastInboundAt
          lastOutboundAt
          activeAffiliateCollaborationIds
          blocked
          workSummary {
            agentRequiredCount
            staffRequiredCount
            externalWaitingCount
          }
        }
      }
    }
  }
`;

export const AFFILIATE_CAMPAIGN_SEARCH_PLAN_CREATOR_STATES_QUERY = gql`
  query AffiliateCampaignSearchPlanCreatorStates(
    $input: ReadAffiliateCampaignSearchPlanCreatorStatesInput!
  ) {
    affiliateCampaignSearchPlanCreatorStates(input: $input) {
      nextCursor
      items {
        id
        campaignId
        shopId
        creatorId
        productId
        market
        status
        firstSeenAt
        lastSeenAt
        searchOccurrenceCount
        eligibilityCategory
        eligibilityReasonCode
        eligibilityPolicyVersion
        eligibilityEvaluatedAt
        sourceSearchPlanIds
        latestSearchDailyExecutionId
        latestSearchPlanId
        latestSearchPlanGeneration
        latestSearchProviderOrdinal
        latestSearchMatchedAt
        followerCount
        decisionReason
        selectionStrategy
        predictionStatus
        filterResult
        decisionReasonCodes
        providerOrdinal
        providerPageSequence
        evaluationAttemptCount
        nextEvaluationAt
        evaluationFailureStage
        preApprovalProbability
        preApprovalCutoff
        preApproved
        preApprovalModelVersion
        preApprovalContractVersion
        preApprovalObservedAt
        qualificationDecision
        qualifiedAt
        scheduledAt
        reachedOutAt
        repliedAt
        outreachErrorCode
        creatorProfile {
          id
          platform
          creatorOpenId
          username
          nickname
          avatarUrl
          bioDescription
          lastObservedAt
        }
        creatorPerformance {
          market
          observedAt
          sourceType
          followerCount
          categoryIds
        }
        creatorRelationship {
          id
          shopStates { shopId }
          lastInboundAt
          lastOutboundAt
          activeAffiliateCollaborationIds
          blocked
          workSummary {
            agentRequiredCount
            staffRequiredCount
            externalWaitingCount
          }
        }
      }
    }
  }
`;

export const AFFILIATE_MARKETPLACE_RULE_CAPABILITIES_QUERY = gql`
  query AffiliateMarketplaceCreatorRuleCapabilities($shopId: ID!) {
    affiliateMarketplaceCreatorRuleCapabilities(shopId: $shopId) {
      shopId
      market
      apiVersion
      ageRanges
      genders
      gmvRanges
      unitsSoldRanges
      languages
      creatorLevels
      categoryPros
      fetchedAt
      capabilityHash
    }
  }
`;

export const AFFILIATE_CAMPAIGN_SELECTION_READINESS_QUERY = gql`
  query AffiliateCampaignSelectionReadiness($campaignId: ID!) {
    affiliateCampaignSelectionReadiness(campaignId: $campaignId) {
      campaignId
      strategy
      ready
      reasonCode
      message
    }
  }
`;

export const AFFILIATE_CAMPAIGN_SEARCH_PLANS_QUERY = gql`
  query AffiliateCampaignSearchPlans($input: ReadAffiliateCampaignSearchPlansInput!) {
    affiliateCampaignSearchPlans(input: $input) {
      nextCursor
      items {
        id
        campaignId
        shopId
        productId
        generation
        configRevision
        status
        generatedBy {
          source
          requestedModel
          resolvedModel
          completedAt
        }
        phrase {
          key
          text
          explanation
          explanationLocale
        }
        discoveryRules {
          followerCount { minimum maximum }
          audience {
            ageRanges
            genderDistribution { gender minimumPercentage }
          }
          salesPerformance30d { gmvRanges unitsSoldRanges }
          categories { parentCategoryId }
          contentPerformance30d {
            averageVideoViews
            averageShoppableVideoViews
            averageEngagementRate
            averageShoppableEngagementRate
            averageLiveViewers
            averageShoppableLiveViewers
          }
          affiliatePerformance30d {
            averageCommissionRate
            postRate
            creatorAgencyStatus
            fastGrowingOnly
            notInvitedLast90Days
          }
          marketSpecific { languages creatorLevels categoryPros }
        }
        guidanceInterpretation {
          sourceGuidanceHash
          softDirections
          hardConstraints {
            followerCount { minimum maximum }
            audience {
              ageRanges
              genderDistribution { gender minimumPercentage }
            }
            salesPerformance30d { gmvRanges unitsSoldRanges }
            categories { parentCategoryId }
            contentPerformance30d {
              averageVideoViews
              averageShoppableVideoViews
              averageEngagementRate
              averageShoppableEngagementRate
              averageLiveViewers
              averageShoppableLiveViewers
            }
            affiliatePerformance30d {
              averageCommissionRate
              postRate
              creatorAgencyStatus
              fastGrowingOnly
              notInvitedLast90Days
            }
            marketSpecific { languages creatorLevels categoryPros }
          }
        }
        pageSequence
        totals {
          scanned
          matched
          protected
          outreachPolicyBlocked
          qualificationFailed
          qualified
          scheduled
        }
        providerFailureCount
        blockStage
        errorCode
        completionReason
        generatedAt
        startedAt
        lastSearchedAt
        completedAt
      }
    }
  }
`;

export const AFFILIATE_CAMPAIGN_SEARCH_PLAN_SUMMARIES_QUERY = gql`
  query AffiliateCampaignSearchPlanSummaries($input: ReadAffiliateCampaignSearchPlansInput!) {
    affiliateCampaignSearchPlanSummaries(input: $input) {
      nextCursor
      items {
        duplicateCount
        delivery {
          submitted
          sent
          failed
          failureReasons { code count }
        }
        plan {
          id
          campaignId
          shopId
          productId
          generation
          configRevision
          status
          generatedBy {
            source
            requestedModel
            resolvedModel
            completedAt
          }
          phrase {
            key
            text
            explanation
            explanationLocale
          }
          discoveryRules {
            followerCount { minimum maximum }
            audience {
              ageRanges
              genderDistribution { gender minimumPercentage }
            }
            salesPerformance30d { gmvRanges unitsSoldRanges }
            categories { parentCategoryId }
            contentPerformance30d {
              averageVideoViews
              averageShoppableVideoViews
              averageEngagementRate
              averageShoppableEngagementRate
              averageLiveViewers
              averageShoppableLiveViewers
            }
            affiliatePerformance30d {
              averageCommissionRate
              postRate
              creatorAgencyStatus
              fastGrowingOnly
              notInvitedLast90Days
            }
            marketSpecific { languages creatorLevels categoryPros }
          }
          guidanceInterpretation {
            sourceGuidanceHash
            softDirections
            hardConstraints {
              followerCount { minimum maximum }
              audience {
                ageRanges
                genderDistribution { gender minimumPercentage }
              }
              salesPerformance30d { gmvRanges unitsSoldRanges }
              categories { parentCategoryId }
              contentPerformance30d {
                averageVideoViews
                averageShoppableVideoViews
                averageEngagementRate
                averageShoppableEngagementRate
                averageLiveViewers
                averageShoppableLiveViewers
              }
              affiliatePerformance30d {
                averageCommissionRate
                postRate
                creatorAgencyStatus
                fastGrowingOnly
                notInvitedLast90Days
              }
              marketSpecific { languages creatorLevels categoryPros }
            }
          }
          pageSequence
          totals {
            scanned
            matched
            protected
            outreachPolicyBlocked
            qualificationFailed
            qualified
            scheduled
          }
          providerFailureCount
          blockStage
          errorCode
          completionReason
          generatedAt
          startedAt
          lastSearchedAt
          completedAt
        }
      }
    }
  }
`;

export const RETRY_AFFILIATE_CAMPAIGN_SEARCH_PLAN_MUTATION = gql`
  mutation RetryAffiliateCampaignSearchPlan($campaignId: ID!) {
    retryAffiliateCampaignSearchPlanGeneration(campaignId: $campaignId)
  }
`;

export const WRITE_AFFILIATE_CAMPAIGN_MUTATION = gql`
  ${AFFILIATE_CAMPAIGN_FIELDS}
  mutation WriteAffiliateCampaign($input: WriteAffiliateCampaignInput!) {
    writeAffiliateCampaign(input: $input) {
      ...AffiliateCampaignFields
    }
  }
`;

export const SET_AFFILIATE_CAMPAIGN_STATUS_MUTATION = gql`
  ${AFFILIATE_CAMPAIGN_FIELDS}
  mutation SetAffiliateCampaignStatus($input: SetAffiliateCampaignStatusInput!) {
    setAffiliateCampaignStatus(input: $input) {
      ...AffiliateCampaignFields
    }
  }
`;

export const DUPLICATE_AFFILIATE_CAMPAIGN_MUTATION = gql`
  ${AFFILIATE_CAMPAIGN_FIELDS}
  mutation DuplicateAffiliateCampaign($input: DuplicateAffiliateCampaignInput!) {
    duplicateAffiliateCampaign(input: $input) {
      ...AffiliateCampaignFields
    }
  }
`;

export const DELETE_AFFILIATE_CAMPAIGN_DRAFT_MUTATION = gql`
  mutation DeleteAffiliateCampaignDraft($input: DeleteAffiliateCampaignDraftInput!) {
    deleteAffiliateCampaignDraft(input: $input)
  }
`;

export const GENERATE_AFFILIATE_CAMPAIGN_TEMPLATE_MUTATION = gql`
  mutation GenerateAffiliateCampaignMessageTemplate(
    $input: GenerateAffiliateCampaignMessageTemplateInput!
  ) {
    generateAffiliateCampaignMessageTemplate(input: $input) {
      text
      source
      productShortName
    }
  }
`;

export const AFFILIATE_CAMPAIGN_PRODUCT_PREVIEW_QUERY = gql`
  query AffiliateCampaignProductPreview($input: ResolveAffiliateCampaignProductInput!) {
    affiliateCampaignProductPreview(input: $input) {
      productId
      title
      description
      status
      coverImage
      originalCurrency
      minimumPriceUsdAmount
      maximumPriceUsdAmount
      categoryLeafId
      categoryLeafName
      categoryPathIds
      categoryPathNames
      brandId
      brandName
      observedAt
      snapshotHash
    }
  }
`;

export const CS_OPEN_ESCALATIONS_QUERY = gql`
  query CsOpenEscalations($filter: CsOpenEscalationFilterInput) {
    csOpenEscalationsPage(filter: $filter) {
      total
      limit
      offset
      items {
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
        updatedAt
        result {
          decision
          instructions
          resolved
          resolvedAt
        }
      }
    }
  }
`;

export const CS_ESCALATION_BY_ID_QUERY = gql`
  query CsEscalationById($filter: CsOpenEscalationFilterInput) {
    csOpenEscalationsPage(filter: $filter) {
      items {
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
        updatedAt
        result {
          decision
          instructions
          resolved
          resolvedAt
        }
      }
    }
  }
`;

export const CS_CONVERSATION_INBOX_QUERY = gql`
  query CustomerServiceInbox(
    $shopIds: [ID!]
    $status: CustomerServiceConversationStatus
    $aiEnabled: Boolean
    $escalation: CustomerServiceConversationEscalationFilter
    $search: String
    $hasBadReview: Boolean
    $limit: Int
    $offset: Int
  ) {
    ecommerceGetCustomerServiceInbox(
      shopIds: $shopIds
      status: $status
      aiEnabled: $aiEnabled
      escalation: $escalation
      search: $search
      hasBadReview: $hasBadReview
      limit: $limit
      offset: $offset
    ) {
      totalCount
      items {
        shopId
        platformShopId
        conversationId
        status
        isOpen
        platformConversationStatus
        aiEnabled
        buyerUserId
        buyerImUserId
        buyerNickname
        orderId
        latestMessageTime
        latestMessageId
        latestMessageIndex
        latestMessageType
        latestSenderRole
        latestMessagePreview
        lastPendingAt
        resolvedAt
        updatedAt
        openEscalationCount
        latestOpenEscalationId
        latestOpenEscalationStatus
        latestOpenEscalationUpdatedAt
        recentBadReviews {
          id
          platformReviewId
          orderId
          productId
          sellerSkus
          rating
          title
          content
          reviewCreateTime
          reviewUpdateTime
          followUpStatus
        }
      }
    }
  }
`;

export const CS_CONVERSATION_MESSAGES_QUERY = gql`
  query CustomerServiceConversationMessages(
    $shopId: String!
    $conversationId: String!
    $pageSize: Float!
    $pageToken: String
    $locale: String
  ) {
    ecommerceGetConversationMessages(
      shopId: $shopId
      conversationId: $conversationId
      pageSize: $pageSize
      pageToken: $pageToken
      locale: $locale
    ) {
      nextPageToken
      items {
        messageId
        index
        type
        text
        createTime
        sender {
          role
          nickname
        }
      }
    }
  }
`;

export const CS_CONVERSATION_ORDER_CONTEXT_QUERY = gql`
  query CustomerServiceConversationOrderContext(
    $shopId: String!
    $orderId: String!
    $buyerUserId: String
  ) {
    order: ecommerceGetOrder(
      shopId: $shopId
      orderId: $orderId
      buyerUserId: $buyerUserId
    ) {
      orderId
      buyerUserId
      status
      createTime
      updateTime
      paidTime
      deliveryTime
      totalAmount
      currency
      paymentMethodName
      shippingProvider
      trackingNumber
      recipientAddress {
        name
        fullAddress
        postalCode
        phone
        region
        city
        district
      }
      lineItems {
        orderLineItemId
        productId
        productName
        quantity
        sellerSku
        skuId
        skuName
        skuImage
        salePrice
        currency
        displayStatus
        packageStatus
        trackingNumber
      }
    }
    returns: ecommerceSearchReturns(
      shopId: $shopId
      limit: 20
      orderIds: [$orderId]
    ) {
      returnId
      orderId
      returnType
      returnStatus
      returnReason
      returnReasonText
      createTime
      updateTime
      returnMethod
      returnTrackingNumber
      isQuickRefund
      refundAmount {
        currency
        refundTotal
      }
      lineItems {
        returnLineItemId
        orderLineItemId
        productName
        sellerSku
        skuId
        skuName
        productImage {
          url
          width
          height
        }
        refundAmount {
          currency
          refundTotal
        }
      }
    }
  }
`;

export const CS_SET_CONVERSATION_AI_ENABLED_MUTATION = gql`
  mutation SetCustomerServiceConversationAiEnabled(
    $shopId: String!
    $conversationId: String!
    $aiEnabled: Boolean!
  ) {
    ecommerceSetCustomerServiceConversationAiEnabled(
      shopId: $shopId
      conversationId: $conversationId
      aiEnabled: $aiEnabled
    ) {
      shopId
      platformShopId
      conversationId
      status
      isOpen
      platformConversationStatus
      aiEnabled
      buyerUserId
      buyerImUserId
      buyerNickname
      orderId
      latestMessageTime
      latestMessageId
      latestMessageIndex
      latestMessageType
      latestSenderRole
      latestMessagePreview
      lastPendingAt
      resolvedAt
      updatedAt
      openEscalationCount
      latestOpenEscalationId
      latestOpenEscalationStatus
      latestOpenEscalationUpdatedAt
      recentBadReviews {
        id
        platformReviewId
        orderId
        productId
        sellerSkus
        rating
        title
        content
        reviewCreateTime
        reviewUpdateTime
        followUpStatus
      }
    }
  }
`;

export const CS_SEND_MANUAL_TEXT_REPLY_MUTATION = gql`
  mutation SendCustomerServiceManualTextReply(
    $shopId: String!
    $conversationId: String!
    $message: String!
  ) {
    ecommerceSendCustomerServiceTextReply(
      shopId: $shopId
      conversationId: $conversationId
      message: $message
    ) {
      messageId
    }
  }
`;

export const CS_END_CUSTOMER_SERVICE_SESSION_MUTATION = gql`
  mutation EndCustomerServiceSession($shopId: ID!, $conversationId: String!) {
    csEndCustomerServiceSession(shopId: $shopId, conversationId: $conversationId)
  }
`;

export const CS_DISMISS_ESCALATION_MUTATION = gql`
  mutation DismissCustomerServiceEscalation($escalationId: ID!) {
    csDismissEscalation(escalationId: $escalationId) {
      ok
      escalationId
      status
      version
      error
    }
  }
`;

export const CS_DISMISS_CONVERSATION_ESCALATIONS_MUTATION = gql`
  mutation DismissConversationEscalations($shopId: ID!, $conversationId: String!) {
    csDismissConversationEscalations(shopId: $shopId, conversationId: $conversationId) {
      shopId
      platformShopId
      conversationId
      status
      isOpen
      platformConversationStatus
      aiEnabled
      buyerUserId
      buyerImUserId
      buyerNickname
      orderId
      latestMessageTime
      latestMessageId
      latestMessageIndex
      latestMessageType
      latestSenderRole
      latestMessagePreview
      lastPendingAt
      resolvedAt
      updatedAt
      openEscalationCount
      latestOpenEscalationId
      latestOpenEscalationStatus
      latestOpenEscalationUpdatedAt
      recentBadReviews {
        id
        platformReviewId
        orderId
        productId
        sellerSkus
        rating
        title
        content
        reviewCreateTime
        reviewUpdateTime
        followUpStatus
      }
    }
  }
`;

export const AFFILIATE_ACTION_PROPOSALS_QUERY = gql`
  query AffiliateActionProposals($input: ReadActionProposalsInput!) {
    affiliateActionProposalPage(input: $input) {
      items {
      id
      userId
      focusShopId
      shopIds
      campaignId
      creatorId
      creatorRelationshipId
      businessDeveloperIdSnapshot
      creatorRelationship {
        id
        creatorId
        shopStates {
          shopId
        }
      }
      creatorFollowerCount
      creatorAverageVideoViews
      creatorEngagementRate
      creatorShoppableVideoCount
      creatorProfile {
        id
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
        affiliateCollaborationId
        sampleApplicationRecordId
        productId
        creatorRelationshipId
        workKind
        workBundleKind
        versionAt
        triggerKind
        triggerId
        triggerChannel
        triggerShopId
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
      requestedByActorType
      requestedByActorId
      revisionOfProposalId
      revisionRootProposalId
      revisionNumber
      supersededByProposalId
      revisionHistory {
        id
        type
        status
        operatorSummary
        requestedByActorType
        requestedByActorId
        revisionOfProposalId
        revisionRootProposalId
        revisionNumber
        supersededByProposalId
        decision {
          decidedAt
          note
          actorType
          actorId
        }
        executionResult {
          executedAt
          errorMessage
          deliveryStatus
        }
        createdAt
        updatedAt
      }
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
        message
        predictedAt
        capturedAt
        predictionEvidence {
          evidenceMode
          expectedSales {
            family
            status
            selection {
              requestedScope
              effectiveScope
              modelVersion
              evaluatedScopes {
                tenantScope
                tenantId
                artifactFound
                expectedSalesReliability
                reliabilityReasons
                reason
              }
            }
            error {
              code
              message
            }
            value {
              units
              percentile
              quality {
                level
                score
              }
              reliability
              reliabilityReasons
            }
          }
          humanDecision {
            family
            status
            selection {
              requestedScope
              effectiveScope
              modelVersion
              evaluatedScopes {
                tenantScope
                tenantId
                artifactFound
                expectedSalesReliability
                reliabilityReasons
                reason
              }
            }
            error {
              code
              message
            }
            value {
              wouldApprove
              approvalProbability
              approvalPercentile
              cutoff
              historicalApprovalRate
            }
          }
        }
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
        predictionCacheIds
        messageIntent {
          creatorId
          creatorOpenId
          preferredChannel
          emailSubject
          subjectHash
          subjectLength
          parts {
            kind
            text
            textHash
            textLength
            draftAssetId
            caption
            captionHash
            captionLength
            emailDisposition
            fileName
            mimeType
            sizeBytes
            sha256
            productId
            targetCollaborationId
            sampleApplicationId
          }
        }
        sampleReviewIntent {
          sampleApplicationRecordId
          platformApplicationId
          decision
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
        creatorTagIntent {
          operation
          manualTagId
          contextShopId
        }
      }
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
        decidedAt
        note
        actorType
        actorId
      }
      messageIntent {
        creatorId
        creatorOpenId
        preferredChannel
        emailSubject
        subjectHash
        subjectLength
        parts {
          kind
          text
          textHash
          textLength
          draftAssetId
          caption
          captionHash
          captionLength
          emailDisposition
          fileName
          mimeType
          sizeBytes
          sha256
          productId
          targetCollaborationId
          sampleApplicationId
        }
      }
      sampleReviewIntent {
        sampleApplicationRecordId
        platformApplicationId
        decision
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
      creatorTagIntent {
        operation
        manualTagId
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
      deliveredMessage {
        deliveryId
        status
        channel
        parts {
          sequence
          kind
          text
        }
      }
      }
      nextCursor
      hasMore
    }
  }
`;

export const AFFILIATE_WORK_ITEMS_QUERY = gql`
  query AffiliateWorkItems($input: ReadAffiliateWorkItemsInput) {
    affiliateWorkItems(input: $input) {
      id
      subjectType
      triggerShopId
      affiliateCollaborationId
      sampleApplicationRecordId
      triggerPlatformShopId
      routingShopIds
      routingPlatformShopIds
      processingStatus
      requiredAction
      processReasons
      workKind
      workBundleKind
      agentDispatchRecommended
      creatorProtected
      agentEligibilityReason
      staffReviewRequired
      recommendedActionTypes
      versionAt
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
        productId
        sampleWorkStatus
        observedContentCount
        latestObservedContentAt
        shippedAt
        deliveredAt
        order {
          platformOrderId
          trackingNumber
          carrier
        }
        trackingNumber
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
          createdAt
          updatedAt
        }
        creatorRelation {
          id
          creatorId
          businessDeveloperId
          operationalConfigRevision
          blocked
          blockedShopIds
          shopStates {
            shopId
            sampleTier
            lastContactedAt
            lastInvitedAt
            lastQualifiedAt
          }
          updatedAt
        }
        activeCollaborations {
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
        focusCollaboration {
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
        ambiguousCollaborationCandidates {
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
        primarySampleApplication {
          id
          platformApplicationId
          creatorId
          productId
          sampleWorkStatus
          observedContentCount
          latestObservedContentAt
          shippedAt
          deliveredAt
          order {
            platformOrderId
            trackingNumber
            carrier
          }
          trackingNumber
          updatedAt
        }
        relatedSampleApplications {
          id
          platformApplicationId
          creatorId
          productId
          sampleWorkStatus
          observedContentCount
          latestObservedContentAt
          shippedAt
          deliveredAt
          order {
            platformOrderId
            trackingNumber
            carrier
          }
          trackingNumber
          updatedAt
        }
        productContext {
          productId
          title
          imageUrl
          source
        }
        recommendedActionTypes
        missingContext {
          reason
          severity
          message
        }
      }
    }
  }
`;

export const AFFILIATE_COLLABORATION_FIELDS_FRAGMENT = gql`
  fragment AffiliateCollaborationFields on AffiliateCollaboration {
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
    name
    message
    collaborationSubType
    commissionRate
    commissionStartTime
    commissionEndTime
    effectiveTime
    startTime
    endTime
    creatorInvitedCount
    showcaseCreatorCount
    contentCreatorCount
    productCount
    sellerContactInfo {
      email
      phoneNumber
      whatsapp
      telegram
      line
    }
    freeSampleRule {
      hasFreeSample
      isSampleApprovalExempt
    }
    openSampleRule {
      productId
      status
      sampleQuota
      availableQuantity
      isSampleTimeUnlimited
      startTime
      endTime
      thresholds {
        minimumFollowerCount
        minimumGmv
        avgEcVideoViews
        categoryIds
        predictedFulfillmentRank
      }
    }
    products {
      id
      productId
      title
      imageUrl
      mainImageUrl
      status
      collaborationStatus
      commissionEffectiveStatus
      commission {
        rate
        shopAdsCommissionRate
        startTime
        endTime
      }
    }
    targetCreators {
      creatorOpenId
      username
      nickname
      collaborationStatus
      productEffectiveStatus
      selectionRegion
      showcaseProductCount
      contentProductCount
      avatar { url width height }
    }
    platformUpdatedAt
    firstObservedAt
    lastObservedAt
    projectionRevision
    lastSyncSource
    createdAt
    updatedAt
  }
`;

export const AFFILIATE_COLLABORATIONS_QUERY = gql`
  ${AFFILIATE_COLLABORATION_FIELDS_FRAGMENT}
  query AffiliateCollaborations($input: ReadAffiliateCollaborationsInput!) {
    affiliateCollaborations(input: $input) {
      ...AffiliateCollaborationFields
    }
  }
`;

export const AFFILIATE_COLLABORATION_DETAIL_QUERY = gql`
  ${AFFILIATE_COLLABORATION_FIELDS_FRAGMENT}
  query AffiliateCollaborationDetail($input: AffiliateCollaborationDetailInput!) {
    affiliateCollaborationDetail(input: $input) {
      collaboration {
        ...AffiliateCollaborationFields
      }
      creators {
        id
        platform
        creatorOpenId
        username
        nickname
        avatarUrl
      }
      sampleApplications {
        id
        platformApplicationId
        creatorId
        productId
        sampleWorkStatus
        platformStatus
        platformFulfillmentStatus
        updatedAt
      }
      productSummaries {
        shopId
        product {
          productId
          title
          coverImage
          status
          priceMin
          priceMax
          skus { skuId skuName sellerSku price currency }
        }
      }
    }
  }
`;

export const EDIT_AFFILIATE_OPEN_COLLABORATION_SETTINGS_MUTATION = gql`
  mutation EditAffiliateOpenCollaborationSettings($input: EditAffiliateOpenCollaborationSettingsInput!) {
    editAffiliateOpenCollaborationSettings(input: $input) {
      settings {
        autoAddProduct { enable commissionRate }
      }
    }
  }
`;

export const AFFILIATE_OPEN_COLLABORATION_SETTINGS_QUERY = gql`
  query AffiliateOpenCollaborationSettings($shopId: ID!) {
    affiliateOpenCollaborationSettings(shopId: $shopId) {
      autoAddProduct { enable commissionRate }
    }
  }
`;

export const CREATE_AFFILIATE_OPEN_COLLABORATION_MUTATION = gql`
  ${AFFILIATE_COLLABORATION_FIELDS_FRAGMENT}
  mutation CreateAffiliateOpenCollaboration($input: CreateAffiliateOpenCollaborationInput!) {
    createAffiliateOpenCollaboration(input: $input) {
      collaboration { ...AffiliateCollaborationFields }
    }
  }
`;

export const EDIT_AFFILIATE_OPEN_COLLABORATION_SAMPLE_RULE_MUTATION = gql`
  ${AFFILIATE_COLLABORATION_FIELDS_FRAGMENT}
  mutation EditAffiliateOpenCollaborationSampleRule($input: EditAffiliateOpenCollaborationSampleRuleInput!) {
    editAffiliateOpenCollaborationSampleRule(input: $input) {
      collaboration { ...AffiliateCollaborationFields }
      sampleRule {
        productId
        status
        sampleQuota
        availableQuantity
        isSampleTimeUnlimited
        startTime
        endTime
        thresholds {
          minimumFollowerCount
          minimumGmv
          avgEcVideoViews
          categoryIds
          predictedFulfillmentRank
        }
      }
    }
  }
`;

export const REMOVE_AFFILIATE_OPEN_COLLABORATION_MUTATION = gql`
  ${AFFILIATE_COLLABORATION_FIELDS_FRAGMENT}
  mutation RemoveAffiliateOpenCollaboration($input: RemoveAffiliateOpenCollaborationInput!) {
    removeAffiliateOpenCollaboration(input: $input) {
      collaboration { ...AffiliateCollaborationFields }
      terminatedEffectiveTime
    }
  }
`;

export const CREATE_AFFILIATE_TARGET_COLLABORATION_MUTATION = gql`
  ${AFFILIATE_COLLABORATION_FIELDS_FRAGMENT}
  mutation CreateAffiliateTargetCollaboration($input: CreateAffiliateTargetCollaborationInput!) {
    createAffiliateTargetCollaboration(input: $input) {
      collaboration { ...AffiliateCollaborationFields }
      providerResult {
        targetCollaborationId
        invalidOpenIdList
        invalidProductIdList
        targetCollaborationConflicts { creatorUserOpenId productId }
      }
    }
  }
`;

export const UPDATE_AFFILIATE_TARGET_COLLABORATION_MUTATION = gql`
  ${AFFILIATE_COLLABORATION_FIELDS_FRAGMENT}
  mutation UpdateAffiliateTargetCollaboration($input: UpdateAffiliateTargetCollaborationInput!) {
    updateAffiliateTargetCollaboration(input: $input) {
      collaboration { ...AffiliateCollaborationFields }
      providerResult {
        targetCollaborationConflicts { creatorUserOpenId productId }
        updateFailed {
          removeCreatorOpenIds
          removeProductIds
          addCreatorOpenIds
          invalidOpenIdList
          invalidProductIdList
          name
          endTime
          addProducts { id productId commissionRate }
          changeCommissions { id productId commissionRate }
          sellerContactInfo { email phoneNumber whatsapp telegram line }
        }
      }
    }
  }
`;

export const REMOVE_AFFILIATE_TARGET_COLLABORATION_MUTATION = gql`
  ${AFFILIATE_COLLABORATION_FIELDS_FRAGMENT}
  mutation RemoveAffiliateTargetCollaboration($input: RemoveAffiliateTargetCollaborationInput!) {
    removeAffiliateTargetCollaboration(input: $input) {
      collaboration { ...AffiliateCollaborationFields }
    }
  }
`;

export const AFFILIATE_ML_INSIGHTS_QUERY = gql`
  query AffiliateMlInsights($input: AffiliateMlInsightsInput) {
    affiliateMlInsights(input: $input) {
      automaticExpectedSalesSelection {
        selectionBasis
        requestedTenantScope
        effectiveTenantScope
        outperformanceProbability
        dataFoundationLevel
        evaluationSampleCount
      }
      modelAvailability {
        modelFamily
        modelStage
        status
        featureTemporalBasis
        requestedTenantScope
        requestedTenantId
        effectiveTenantScope
        effectiveTenantId
        modelVersionKey
        bentomlTag
        contractHash
        contractStatus
        trainedAt
        reason
        evaluationSummary {
          comparisonAvailable
          historicalApplicationCount
          historicalSelectedCount
          modelSelectedCount
          selectionDifferenceCount
          historicalExpectedUnits
          modelExpectedUnits
          expectedSalesLiftRatio
          outperformanceProbability
          dataFoundationLevel
          expectedSalesLiftRatioPrimaryRangeLevel
          expectedSalesLiftRatioPrimaryRangeLowerBound
          expectedSalesLiftRatioPrimaryRangeUpperBound
          sameBudgetComparison {
            historicalApprovalRate
            historicalActualObservedCount
            modelSelectedHistoricalRejectedCount
            modelRejectedHistoricalSelectedCount
            historicalActualUnitsHistogram {
              key
              label
              count
            }
            historicalExpectedUnitsHistogram {
              key
              label
              count
            }
            modelExpectedUnitsHistogram {
              key
              label
              count
            }
          }
          sameThresholdComparison {
            minimumExpectedSalesUnits
            historicalQualifiedCount
            modelQualifiedCount
            modelQualifiedHistoricalRejectedCount
            belowThresholdCount
            qualifiedCreatorLiftRatio
            historicalExpectedUnitsHistogram {
              key
              label
              count
            }
            modelExpectedUnitsHistogram {
              key
              label
              count
            }
            belowThresholdModelExpectedUnitsHistogram {
              key
              label
              count
            }
          }
        }
      }
    }
  }
`;

export const AFFILIATE_ML_INSIGHTS_BULK_QUERY = gql`
  query AffiliateMlInsightsBulk($input: AffiliateMlInsightsBulkInput!) {
    affiliateMlInsightsBulk(input: $input) {
      items {
        shopId
        modelScope
        automaticExpectedSalesSelection {
          selectionBasis
          requestedTenantScope
          effectiveTenantScope
          outperformanceProbability
          dataFoundationLevel
          evaluationSampleCount
        }
        modelAvailability {
          modelFamily
          modelStage
          status
          featureTemporalBasis
          requestedTenantScope
          requestedTenantId
          effectiveTenantScope
          effectiveTenantId
          modelVersionKey
          bentomlTag
          contractHash
          contractStatus
          trainedAt
          reason
          evaluationSummary {
            comparisonAvailable
            historicalApplicationCount
            historicalSelectedCount
            modelSelectedCount
            selectionDifferenceCount
            historicalExpectedUnits
            modelExpectedUnits
            expectedSalesLiftRatio
            outperformanceProbability
            dataFoundationLevel
            expectedSalesLiftRatioPrimaryRangeLevel
            expectedSalesLiftRatioPrimaryRangeLowerBound
            expectedSalesLiftRatioPrimaryRangeUpperBound
            sameBudgetComparison {
              historicalApprovalRate
              historicalActualObservedCount
              modelSelectedHistoricalRejectedCount
              modelRejectedHistoricalSelectedCount
              historicalActualUnitsHistogram {
                key
                label
                count
              }
              historicalExpectedUnitsHistogram {
                key
                label
                count
              }
              modelExpectedUnitsHistogram {
                key
                label
                count
              }
            }
            sameThresholdComparison {
              minimumExpectedSalesUnits
              historicalQualifiedCount
              modelQualifiedCount
              modelQualifiedHistoricalRejectedCount
              belowThresholdCount
              qualifiedCreatorLiftRatio
              historicalExpectedUnitsHistogram {
                key
                label
                count
              }
              modelExpectedUnitsHistogram {
                key
                label
                count
              }
              belowThresholdModelExpectedUnitsHistogram {
                key
                label
                count
              }
            }
          }
        }
      }
    }
  }
`;

export const AFFILIATE_APPROVAL_POLICIES_QUERY = gql`
  query AffiliateApprovalPolicies($input: ReadAffiliateApprovalPoliciesInput!) {
    affiliateApprovalPolicies(input: $input) {
      id
      userId
      action
      manualTagIds
      excludedManualTagIds
      sampleTiers
      excludedSampleTiers
      campaignIds
      productIds
      reason
      enabled
      createdAt
      updatedAt
    }
  }
`;

export const AFFILIATE_POLICY_CONTEXT_QUERY = gql`
  query AffiliatePolicyContext {
    affiliateApprovalPolicyContext {
      shops {
        shopId
        shopName
        campaigns {
          id
          shopId
          name
          status
          updatedAt
        }
      }
    }
  }
`;

export const AFFILIATE_CREATORS_QUERY = gql`
  query AffiliateCreators($input: ReadAffiliateCreatorsInput!) {
    affiliateCreators(input: $input) {
      totalCount
      offset
      limit
      hasMore
      items {
        creatorId
        market
        creatorPerformance {
          id
          market
          observedAt
          sourceType
          preciseDataAuthorized
          followerCount
          categoryIds
          gmv {
            amount
            currency
            minimumAmount
            maximumAmount
            window
            precision
          }
          videoGmv {
            amount
            currency
            minimumAmount
            maximumAmount
            window
            precision
          }
          liveGmv {
            amount
            currency
            minimumAmount
            maximumAmount
            window
            precision
          }
          gpm {
            amount
            currency
            minimumAmount
            maximumAmount
            window
            precision
          }
          unitsSold
          videoCount
          liveCount
          averageVideoViews
          engagementRate
          pps
          ratingScore
          contentWindow
        }
        needsAttention
        activeCollaborationCount
        activeSampleApplicationCount
        lastInteractionAt
        shopState {
          shopId
          sampleTier
          lastContactedAt
          lastInvitedAt
          lastQualifiedAt
        }
        creatorRelation {
          id
          creatorId
          businessDeveloperId
          operationalConfigRevision
          blocked
          blockedShopIds
          manualTagIds
          manualTags {
            id
            name
            sensitive
            updatedAt
          }
          highestSampleTier
          committedCheckpointId
          committedEventCursor
          lifecycleEventSequence
          agendaItems {
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
          }
          workSummary {
            agentRequiredCount
            staffRequiredCount
            externalWaitingCount
            nextActionAt
          }
          shopStates {
            shopId
            sampleTier
            lastContactedAt
            lastInvitedAt
            lastQualifiedAt
          }
          updatedAt
        }
        creatorProfile {
          id
          platform
          creatorOpenId
          creatorImId
          username
          nickname
          avatarUrl
          bioDescription
          profileTtUri
          firstObservedAt
          lastObservedAt
          updatedAt
        }
        latestAffiliateCollaboration {
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
          updatedAt
        }
        latestPendingProposal {
          id
          type
          status
          operatorSummary
          updatedAt
          policySnapshot {
            requiresApproval
            matchedPolicyIds
            reasons
            action
          }
          reviewSource
          humanReviewRequest {
            reason
            question
          }
          messageIntent {
            creatorId
            creatorOpenId
            preferredChannel
            emailSubject
            subjectHash
            subjectLength
            parts {
              kind
              text
              textHash
              textLength
              draftAssetId
              caption
              captionHash
              captionLength
              emailDisposition
              fileName
              mimeType
              sizeBytes
              sha256
              productId
              targetCollaborationId
              sampleApplicationId
            }
          }
          sampleReviewIntent {
            sampleApplicationRecordId
            platformApplicationId
            decision
            rejectReason
            rejectReasonExplanation
          }
        }
        latestSampleApplicationRecord {
          id
          platformApplicationId
          creatorId
          productId
          sampleWorkStatus
          observedContentCount
          latestObservedContentAt
          updatedAt
        }
      }
    }
  }
`;

export const AFFILIATE_CREATOR_RELATIONSHIP_DETAIL_QUERY = gql`
  query AffiliateCreatorRelationshipDetail($input: AffiliateCreatorRelationshipDetailInput!) {
    affiliateCreatorRelationshipDetail(input: $input) {
      includedShopIds
      lastContactedAt
      lastBusinessActivityAt
      counts {
        agendaItemCount
        activeSampleApplicationCount
        sampleApplicationCount
        activePlatformCollaborationCount
        platformCollaborationCount
        pendingProposalCount
        proposalCount
        lifecycleEventCount
      }
      shopActivitySummaries {
        shopId
        lastContactedAt
        lastBusinessActivityAt
        agendaItemCount
        sampleApplicationCount
        platformCollaborationCount
        pendingProposalCount
      }
      creator {
        id
        platform
        creatorOpenId
        creatorImId
        username
        nickname
        avatarUrl
        bioDescription
        profileTtUri
        firstObservedAt
        lastObservedAt
        updatedAt
      }
      performance {
        id
        market
        sourceShopId
        observedAt
        sourceType
        preciseDataAuthorized
        followerCount
        categoryIds
        gmv { amount currency minimumAmount maximumAmount window precision }
        videoGmv { amount currency minimumAmount maximumAmount window precision }
        liveGmv { amount currency minimumAmount maximumAmount window precision }
        gpm { amount currency minimumAmount maximumAmount window precision }
        unitsSold
        videoCount
        liveCount
        averageVideoViews
        engagementRate
        pps
        ratingScore
        contentWindow
      }
      businessDeveloper {
        id
        displayName
        agentAssistanceMode
        archivedAt
      }
      protection {
        id
        creatorId
        creatorOpenId
        username
        businessDeveloperId
        note
        source
        createdAt
        updatedAt
      }
      creatorRelationship {
        id
        creatorId
        activeSampleApplicationRecordIds
        businessDeveloperId
        operationalConfigRevision
        blocked
        blockedShopIds
        manualTagIds
        manualTags {
          id
          name
          sensitive
          updatedAt
        }
        highestSampleTier
        lastInboundAt
        lastInboundChannel
        lastOutboundAt
        stateUpdatedAt
        committedCheckpointId
        committedEventCursor
        lifecycleEventSequence
        agendaItems {
          key
          owner
          sourceType
          workKind
          requiredAction
          shopId
          affiliateCollaborationId
          sampleApplicationRecordId
          productId
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
          nextActionAt
        }
        shopStates {
          shopId
          sampleTier
          lastContactedAt
          lastInvitedAt
          lastQualifiedAt
        }
        updatedAt
      }
    }
  }
`;

export const AFFILIATE_RELATIONSHIP_SAMPLE_APPLICATIONS_QUERY = gql`
  query AffiliateRelationshipSampleApplications($input: AffiliateRelationshipEntityPageInput!) {
    affiliateRelationshipSampleApplications(input: $input) {
      hasMore
      nextCursor
      productSummaries {
        shopId
        product {
          productId
          title
          coverImage
          status
          priceMin
          priceMax
          skus { skuId skuName sellerSku price currency }
        }
      }
      items {
        id
        userId
        shopId
        platformApplicationId
        creatorRelationshipId
        creatorId
        creatorOpenId
        productId
        affiliateCollaborationId
        collaborationLinkBasis
        collaborationType
        platformCollaborationId
        platformTargetCollaborationId
        platformOpenCollaborationId
        commissionRate
        sampleWorkStatus
        platformStatus
        platformFulfillmentStatus
        approveExpirationAt
        firstObservedAt
        lastObservedAt
        providerEventAt
        projectionRevision
        order { platformOrderId trackingNumber carrier }
        trackingNumber
        carrier
        shippedAt
        deliveredAt
        observedContentCount
        latestObservedContentAt
        latestObservedContentId
        latestObservedContentFormat
        latestObservedContentUrl
        latestObservedContentViewCount
        latestObservedContentPaidOrderCount
        updatedAt
      }
    }
  }
`;

export const AFFILIATE_RELATIONSHIP_PLATFORM_COLLABORATIONS_QUERY = gql`
  query AffiliateRelationshipPlatformCollaborations($input: AffiliateRelationshipEntityPageInput!) {
    affiliateRelationshipPlatformCollaborations(input: $input) {
      hasMore
      nextCursor
      productSummaries {
        shopId
        product {
          productId
          title
          coverImage
          status
          priceMin
          priceMax
          skus { skuId skuName sellerSku price currency }
        }
      }
      items {
        sources
        collaboration {
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
      }
    }
  }
`;

export const AFFILIATE_PRODUCT_SUMMARIES_QUERY = gql`
  query AffiliateProductSummaries($input: AffiliateProductSummaryBatchInput!) {
    affiliateProductSummaries(input: $input) {
      shopId
      product {
        productId
        title
        coverImage
        status
        priceMin
        priceMax
        skus { skuId skuName sellerSku price currency }
      }
    }
  }
`;

export const AFFILIATE_CREATOR_PROFILE_QUERY = gql`
  query AffiliateCreatorProfile($input: AffiliateCreatorProfileInput!) {
    affiliateCreatorProfile(input: $input) {
      freshnessStatus
      market
      dataUpdatedAt
      refreshAttemptedAt
      refreshShopId
      refreshErrorCode
      refreshErrorMessage
      creator {
        id
        platform
        creatorOpenId
        creatorImId
        username
        nickname
        avatarUrl
        bioDescription
        profileTtUri
        firstObservedAt
        lastObservedAt
        updatedAt
      }
      performance {
        id
        market
        observedAt
        sourceType
        preciseDataAuthorized
        followerCount
        categoryIds
        gmv {
          amount
          currency
          minimumAmount
          maximumAmount
          window
          precision
        }
        videoGmv {
          amount
          currency
          minimumAmount
          maximumAmount
          window
          precision
        }
        liveGmv {
          amount
          currency
          minimumAmount
          maximumAmount
          window
          precision
        }
        gpm {
          amount
          currency
          minimumAmount
          maximumAmount
          window
          precision
        }
        unitsSold
        videoCount
        liveCount
        averageVideoViews
        engagementRate
        pps
        ratingScore
        contentWindow
      }
    }
  }
`;

export const CREATOR_MANUAL_TAGS_QUERY = gql`
  query CreatorManualTags($input: ReadCreatorManualTagsInput) {
    creatorManualTags(input: $input) {
      id
      name
      sensitive
      updatedAt
    }
  }
`;

export const CREATE_CREATOR_MANUAL_TAG_MUTATION = gql`
  mutation CreateCreatorManualTag($input: CreateCreatorManualTagInput!) {
    createCreatorManualTag(input: $input) {
      id
      name
      sensitive
      updatedAt
    }
  }
`;

export const RENAME_CREATOR_MANUAL_TAG_MUTATION = gql`
  mutation RenameCreatorManualTag($input: RenameCreatorManualTagInput!) {
    renameCreatorManualTag(input: $input) {
      id
      name
      sensitive
      updatedAt
    }
  }
`;

/**
 * Read-only cost of deleting one tag. Deletion cascades across creators and
 * approval policies, so the confirmation needs these counts before the seller
 * commits — never after.
 */
export const CREATOR_MANUAL_TAG_USAGE_QUERY = gql`
  query CreatorManualTagUsage($tagId: ID!) {
    creatorManualTagUsage(tagId: $tagId) {
      manualTagId
      creatorRelationshipCount
      approvalPolicyMatchCount
      approvalPolicyExclusionCount
      approvalPolicyDisableCount
    }
  }
`;

export const DELETE_CREATOR_MANUAL_TAG_MUTATION = gql`
  mutation DeleteCreatorManualTag($tagId: ID!) {
    deleteCreatorManualTag(tagId: $tagId) {
      manualTagId
      creatorRelationshipsDetached
      approvalPolicyMatchesStripped
      approvalPolicyExclusionsStripped
      approvalPoliciesDisabled
    }
  }
`;

const CREATOR_RELATIONSHIP_MANUAL_TAG_RESULT = `
    id
    creatorId
    manualTagIds
    manualTags {
      id
      name
      sensitive
      updatedAt
    }
    highestSampleTier
    updatedAt
`;

export const ASSIGN_CREATOR_RELATIONSHIP_TAG_MUTATION = gql`
  mutation AssignCreatorRelationshipTag($input: CreatorRelationshipManualTagInput!) {
    assignCreatorRelationshipTag(input: $input) {
      ${CREATOR_RELATIONSHIP_MANUAL_TAG_RESULT}
    }
  }
`;

export const REMOVE_CREATOR_RELATIONSHIP_TAG_MUTATION = gql`
  mutation RemoveCreatorRelationshipTag($input: CreatorRelationshipManualTagInput!) {
    removeCreatorRelationshipTag(input: $input) {
      ${CREATOR_RELATIONSHIP_MANUAL_TAG_RESULT}
    }
  }
`;

export const WRITE_AFFILIATE_APPROVAL_POLICY_MUTATION = gql`
  mutation WriteAffiliateApprovalPolicy($input: WriteAffiliateApprovalPolicyInput!) {
    writeAffiliateApprovalPolicy(input: $input) {
      id
      userId
      action
      manualTagIds
      excludedManualTagIds
      sampleTiers
      excludedSampleTiers
      campaignIds
      productIds
      reason
      enabled
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_AFFILIATE_APPROVAL_POLICY_MUTATION = gql`
  mutation DeleteAffiliateApprovalPolicy($id: String!) {
    deleteAffiliateApprovalPolicy(id: $id)
  }
`;

export const AFFILIATE_RELATIONSHIP_TIMELINE_QUERY = gql`
  query AffiliateRelationshipTimeline($input: AffiliateRelationshipTimelineInput!) {
    affiliateRelationshipTimeline(input: $input) {
      limit
      readAt
      realItemCount
      hasOlder
      olderCursor
      items {
        id
        kind
        occurredAt
        actorType
        actorRole
        summary
        relatedIds {
          shopId
          creatorId
          affiliateCollaborationId
          sampleApplicationRecordId
          platformApplicationId
          actionProposalId
          lifecycleEventId
          productId
        }
        message {
          channel
          direction
          textPreview
          messageRef
          parts {
            kind
            text
            attachmentRef
            fileName
            mimeType
            sizeBytes
            width
            height
            durationMs
            inline
            caption
            agentReadable
            productId
            targetCollaborationId
            sampleApplicationId
            providerType
            summary
          }
          messageType
          subject
          channelLabel
          shopName
          accountLabel
        }
        businessEvent {
          lifecycleEventId
          eventType
          entityType
          entityId
          fromStage
          toStage
          actorRole
          displaySummary
        }
        actionEvent {
          lifecycleEventId
          eventType
          entityType
          entityId
          fromStage
          toStage
          actorRole
          displaySummary
        }
        timePassed {
          fromAt
          toAt
          durationSeconds
          durationHuman
          basis
        }
      }
    }
  }
`;

export const AFFILIATE_CREATOR_MESSAGE_HISTORY_QUERY = gql`
  query AffiliateCreatorMessageHistory($input: AffiliateCreatorMessageHistoryInput!) {
    affiliateCreatorMessageHistory(input: $input) {
      limit
      offset
      hasMore
      nextOffset
      items {
        channel
        direction
        messageRef
        parts {
          kind
          text
          attachmentRef
          fileName
          mimeType
          sizeBytes
          width
          height
          durationMs
          inline
          caption
          agentReadable
          productId
          targetCollaborationId
          sampleApplicationId
          providerType
          summary
        }
        messageType
        deliveryStatus
        createdAt
        subject
        channelLabel
        shopId
        shopName
        accountLabel
        source
      }
    }
  }
`;

export const DECIDE_ACTION_PROPOSAL_MUTATION = gql`
  mutation DecideActionProposal($input: DecideActionProposalInput!) {
    decideActionProposal(input: $input) {
      id
      userId
      shopIds
      campaignId
      creatorId
      affiliateCollaborationId
      sampleApplicationRecordId
      productId
      creatorRelationshipId
      businessDeveloperIdSnapshot
      sourceWorkBoundary {
        subjectType
        affiliateCollaborationId
        sampleApplicationRecordId
        productId
        creatorRelationshipId
        workKind
        workBundleKind
        versionAt
        triggerKind
        triggerId
        recommendedActionTypes
      }
      type
      status
      operatorSummary
      requestedByActorType
      requestedByActorId
      revisionOfProposalId
      revisionRootProposalId
      revisionNumber
      supersededByProposalId
      revisionHistory {
        id
        type
        status
        operatorSummary
        requestedByActorType
        requestedByActorId
        revisionOfProposalId
        revisionRootProposalId
        revisionNumber
        supersededByProposalId
        decision {
          decidedAt
          note
          actorType
          actorId
        }
        executionResult {
          executedAt
          errorMessage
          deliveryStatus
        }
        createdAt
        updatedAt
      }
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
        message
        predictedAt
        capturedAt
        predictionEvidence {
          evidenceMode
          expectedSales {
            family
            status
            selection {
              requestedScope
              effectiveScope
              modelVersion
              evaluatedScopes {
                tenantScope
                tenantId
                artifactFound
                expectedSalesReliability
                reliabilityReasons
                reason
              }
            }
            error {
              code
              message
            }
            value {
              units
              percentile
              quality {
                level
                score
              }
              reliability
              reliabilityReasons
            }
          }
          humanDecision {
            family
            status
            selection {
              requestedScope
              effectiveScope
              modelVersion
              evaluatedScopes {
                tenantScope
                tenantId
                artifactFound
                expectedSalesReliability
                reliabilityReasons
                reason
              }
            }
            error {
              code
              message
            }
            value {
              wouldApprove
              approvalProbability
              approvalPercentile
              cutoff
              historicalApprovalRate
            }
          }
        }
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
        type
        predictionCacheIds
        messageIntent {
          creatorId
          creatorOpenId
          preferredChannel
          emailSubject
          subjectHash
          subjectLength
          parts {
            kind
            text
            textHash
            textLength
            draftAssetId
            caption
            captionHash
            captionLength
            emailDisposition
            fileName
            mimeType
            sizeBytes
            sha256
            productId
            targetCollaborationId
            sampleApplicationId
          }
        }
        sampleReviewIntent {
          sampleApplicationRecordId
          platformApplicationId
          decision
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
        creatorTagIntent {
          operation
          manualTagId
          contextShopId
        }
      }
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
        decidedAt
        note
        actorType
        actorId
      }
      messageIntent {
        creatorId
        creatorOpenId
        preferredChannel
        emailSubject
        subjectHash
        subjectLength
        parts {
          kind
          text
          textHash
          textLength
          draftAssetId
          caption
          captionHash
          captionLength
          emailDisposition
          fileName
          mimeType
          sizeBytes
          sha256
          productId
          targetCollaborationId
          sampleApplicationId
        }
      }
      sampleReviewIntent {
        sampleApplicationRecordId
        platformApplicationId
        decision
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
      creatorTagIntent {
        operation
        manualTagId
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
      deliveredMessage {
        deliveryId
        status
        channel
        parts {
          sequence
          kind
          text
        }
      }
    }
  }
`;

export const SEND_AFFILIATE_CREATOR_MESSAGE_MUTATION = gql`
  mutation SendAffiliateCreatorMessage($input: SendAffiliateCreatorMessageInput!) {
    sendAffiliateCreatorMessage(input: $input) {
      delivery {
        id
        preferredChannel
        actualChannel
        channelSelectionSource
        replyToLifecycleEventId
        status
        parts {
          sequence
          kind
          status
          textHash
          textLength
          captionHash
          captionLength
          emailDisposition
          fileName
          mimeType
          sizeBytes
          sha256
          providerMessageId
          providerSubmittedAt
          providerConfirmedAt
          errorCode
          errorMessage
        }
        providerMessageId
        errorMessage
        createdAt
      }
      affiliateCollaboration {
        id
        shopId
        platformCollaborationId
        creatorIds
        creatorOpenIds
        productIds
        type
        status
        lastObservedAt
        updatedAt
      }
    }
  }
`;

export const WHATSAPP_ACCOUNT_FIELDS_FRAGMENT = gql`
  fragment WhatsAppAccountFields on WhatsAppAccountBinding {
    id
    userId
    businessDeveloperId
    businessDeveloperAssignedAt
    provider
    status
    evolutionInstanceName
    phoneNumber
    displayName
    profilePicUrl
    proxyId
    lastQrAt
    lastConnectedAt
    lastDisconnectedAt
    lastError
    updatedAt
  }
`;

export const WHATSAPP_PROXY_FIELDS_FRAGMENT = gql`
  fragment WhatsAppProxyFields on WhatsAppProxy {
    id
    protocol
    host
    port
    username
    region
    status
    lastCheckedAt
    lastError
    updatedAt
  }
`;

export const WHATSAPP_ACCOUNT_BINDINGS_QUERY = gql`
  ${WHATSAPP_ACCOUNT_FIELDS_FRAGMENT}
  query WhatsAppAccountBindings($status: WhatsAppAccountStatus) {
    whatsAppAccountBindings(status: $status) {
      ...WhatsAppAccountFields
    }
  }
`;

export const WHATSAPP_PROXIES_QUERY = gql`
  ${WHATSAPP_PROXY_FIELDS_FRAGMENT}
  query WhatsAppProxies($status: ProxyStatus) {
    whatsAppProxies(status: $status) {
      ...WhatsAppProxyFields
    }
  }
`;

export const WHATSAPP_CONNECTOR_STATUS_QUERY = gql`
  query WhatsAppConnectorStatus {
    whatsAppConnectorStatus {
      configured
      reachable
      ready
      httpStatus
      licenseRequired
      message
      accountCounts {
        status
        count
      }
      proxyCounts {
        status
        count
      }
    }
  }
`;

export const CREATE_WHATSAPP_PROXY_MUTATION = gql`
  ${WHATSAPP_PROXY_FIELDS_FRAGMENT}
  mutation CreateWhatsAppProxy($input: CreateWhatsAppProxyInput!) {
    createWhatsAppProxy(input: $input) {
      ...WhatsAppProxyFields
    }
  }
`;

export const UPDATE_WHATSAPP_PROXY_MUTATION = gql`
  ${WHATSAPP_PROXY_FIELDS_FRAGMENT}
  mutation UpdateWhatsAppProxy($input: UpdateWhatsAppProxyInput!) {
    updateWhatsAppProxy(input: $input) {
      ...WhatsAppProxyFields
    }
  }
`;

export const CREATE_WHATSAPP_ACCOUNT_BINDING_MUTATION = gql`
  ${WHATSAPP_ACCOUNT_FIELDS_FRAGMENT}
  mutation CreateWhatsAppAccountBinding($proxyId: ID) {
    createWhatsAppAccountBinding(proxyId: $proxyId) {
      ...WhatsAppAccountFields
    }
  }
`;

export const START_WHATSAPP_QR_ONBOARDING_MUTATION = gql`
  ${WHATSAPP_ACCOUNT_FIELDS_FRAGMENT}
  mutation StartWhatsAppQrOnboarding($input: StartWhatsAppQrOnboardingInput!) {
    startWhatsAppQrOnboarding(input: $input) {
      binding {
        ...WhatsAppAccountFields
      }
      qrBase64
      pairingCode
      qrCode
    }
  }
`;

export const REFRESH_WHATSAPP_ACCOUNT_BINDING_MUTATION = gql`
  ${WHATSAPP_ACCOUNT_FIELDS_FRAGMENT}
  mutation RefreshWhatsAppAccountBinding($bindingId: ID!) {
    refreshWhatsAppAccountBinding(bindingId: $bindingId) {
      ...WhatsAppAccountFields
    }
  }
`;

export const REVOKE_WHATSAPP_ACCOUNT_BINDING_MUTATION = gql`
  ${WHATSAPP_ACCOUNT_FIELDS_FRAGMENT}
  mutation RevokeWhatsAppAccountBinding($bindingId: ID!, $deleteInstance: Boolean) {
    revokeWhatsAppAccountBinding(bindingId: $bindingId, deleteInstance: $deleteInstance) {
      ...WhatsAppAccountFields
    }
  }
`;

export const EMAIL_ACCOUNT_FIELDS_FRAGMENT = gql`
  fragment EmailAccountFields on EmailAccountBinding {
    id
    userId
    businessDeveloperId
    businessDeveloperAssignedAt
    provider
    status
    mailboxType
    emailAddress
    displayName
    tenantId
    microsoftUserId
    sharedMailboxAddress
    subscriptionId
    subscriptionExpiresAt
    lastSyncAt
    lastError
    updatedAt
  }
`;

export const EMAIL_ACCOUNT_BINDINGS_QUERY = gql`
  ${EMAIL_ACCOUNT_FIELDS_FRAGMENT}
  query EmailAccountBindings($status: EmailAccountStatus) {
    emailAccountBindings(status: $status) {
      ...EmailAccountFields
    }
  }
`;

export const AFFILIATE_OUTREACH_OPERATIONAL_STATUS_QUERY = gql`
  query AffiliateOutreachOperationalStatus($input: AffiliateOutreachOperationalStatusInput!) {
    affiliateOutreachOperationalStatus(input: $input) {
      since
      failedDeliveryCount
      webhookReceivedCount
      ignoredWebhookCount
      rejectedWebhookCount
      mailboxSyncCount
      failedMailboxSyncCount
      subscriptionRenewalCount
      failedSubscriptionRenewalCount
      activeWhatsAppProxyCount
      disabledWhatsAppProxyCount
      errorWhatsAppProxyCount
      whatsappAccountsUsingUnavailableProxyCount
      whatsappAccountsNeedingReconnectCount
      emailAccountsMissingRefreshTokenCount
      sharedEmailAccountsMissingAddressCount
      latestDeliveryAt
      latestInboundAt
      latestOperationalEventAt
      deliveryCounts {
        channel
        status
        count
      }
      inboundCounts {
        channel
        direction
        count
      }
      operationalEventCounts {
        provider
        kind
        status
        count
      }
      operationalEventTypeCounts {
        provider
        kind
        status
        eventType
        count
      }
    }
  }
`;

export const MICROSOFT_GRAPH_CONNECTOR_STATUS_QUERY = gql`
  query MicrosoftGraphConnectorStatus {
    microsoftGraphConnectorStatus {
      configured
      oauthConfigured
      webhookConfigured
      ready
      message
      accountCounts {
        status
        count
      }
      subscriptionCounts {
        health
        count
      }
    }
  }
`;

export const START_MICROSOFT_EMAIL_OAUTH_MUTATION = gql`
  mutation StartMicrosoftEmailOAuth($input: StartMicrosoftEmailOAuthInput) {
    startMicrosoftEmailOAuth(input: $input) {
      url
      state
    }
  }
`;

export const REVOKE_EMAIL_ACCOUNT_BINDING_MUTATION = gql`
  ${EMAIL_ACCOUNT_FIELDS_FRAGMENT}
  mutation RevokeEmailAccountBinding($bindingId: ID!) {
    revokeEmailAccountBinding(bindingId: $bindingId) {
      ...EmailAccountFields
    }
  }
`;

export const AFFILIATE_BUSINESS_DEVELOPER_FIELDS_FRAGMENT = gql`
  fragment AffiliateBusinessDeveloperFields on AffiliateBusinessDeveloper {
    id
    userId
    displayName
    creatorDisplayName
    normalizedDisplayName
    regions
    acceptingCreators
    agentAssistanceMode
    businessPrompt
    profileStatus
    provisioningSource
    profileConfirmedAt
    preferredWhatsAppAccountBindingId
    preferredEmailAccountBindingId
    deviceId
    configRevision
    archivedAt
    createdAt
    updatedAt
  }
`;

export const AFFILIATE_BUSINESS_DEVELOPERS_QUERY = gql`
  ${AFFILIATE_BUSINESS_DEVELOPER_FIELDS_FRAGMENT}
  query AffiliateBusinessDevelopers($includeArchived: Boolean) {
    affiliateBusinessDevelopers(includeArchived: $includeArchived) {
      ...AffiliateBusinessDeveloperFields
    }
  }
`;

export const AFFILIATE_BUSINESS_DEVELOPER_PAGE_QUERY = gql`
  ${AFFILIATE_BUSINESS_DEVELOPER_FIELDS_FRAGMENT}
  query AffiliateBusinessDeveloperPage($input: AffiliateBusinessDeveloperPageInput) {
    affiliateBusinessDeveloperPage(input: $input) {
      items {
        developer {
          ...AffiliateBusinessDeveloperFields
        }
        creatorRelationshipCount
        whatsappAccountCount
        unhealthyWhatsappAccountCount
        emailAccountCount
        unhealthyEmailAccountCount
      }
      totalCount
      offset
      limit
    }
  }
`;

export const AFFILIATE_OPERATIONAL_SETTINGS_QUERY = gql`
  query AffiliateOperationalSettings {
    affiliateOperationalSettings {
      id
      userId
      onboardingCompletedAt
    }
  }
`;

export const AFFILIATE_CREATOR_PROTECTIONS_QUERY = gql`
  query AffiliateCreatorProtections($input: AffiliateCreatorProtectionPageInput!) {
    affiliateCreatorProtections(input: $input) {
      items {
        id
        userId
        platform
        creatorId
        creatorOpenId
        username
        businessDeveloperId
        importBatchId
        note
        source
        manualTags {
          id
          name
        }
        createdAt
        updatedAt
      }
      totalCount
      resolvedCount
      unresolvedCount
      businessDeveloperCounts {
        businessDeveloperId
        count
      }
      offset
      limit
    }
  }
`;

export const WRITE_AFFILIATE_BUSINESS_DEVELOPER_MUTATION = gql`
  ${AFFILIATE_BUSINESS_DEVELOPER_FIELDS_FRAGMENT}
  mutation WriteAffiliateBusinessDeveloper($input: WriteAffiliateBusinessDeveloperInput!) {
    writeAffiliateBusinessDeveloper(input: $input) {
      ...AffiliateBusinessDeveloperFields
    }
  }
`;

export const ENSURE_AFFILIATE_BUSINESS_DEVELOPERS_MUTATION = gql`
  ${AFFILIATE_BUSINESS_DEVELOPER_FIELDS_FRAGMENT}
  mutation EnsureAffiliateBusinessDevelopers($input: EnsureAffiliateBusinessDevelopersInput!) {
    ensureAffiliateBusinessDevelopers(input: $input) {
      idempotencyKey
      completed
      results {
        clientKey
        requestedDisplayName
        normalizedDisplayName
        disposition
        developer {
          ...AffiliateBusinessDeveloperFields
        }
        errorCode
        errorMessage
      }
    }
  }
`;

export const ARCHIVE_AFFILIATE_BUSINESS_DEVELOPER_MUTATION = gql`
  ${AFFILIATE_BUSINESS_DEVELOPER_FIELDS_FRAGMENT}
  mutation ArchiveAffiliateBusinessDeveloper($id: ID!) {
    archiveAffiliateBusinessDeveloper(id: $id) {
      ...AffiliateBusinessDeveloperFields
    }
  }
`;

export const SET_AFFILIATE_BUSINESS_DEVELOPER_PREFERRED_ACCOUNT_MUTATION = gql`
  ${AFFILIATE_BUSINESS_DEVELOPER_FIELDS_FRAGMENT}
  mutation SetAffiliateBusinessDeveloperPreferredAccount($input: SetAffiliateBusinessDeveloperPreferredAccountInput!) {
    setAffiliateBusinessDeveloperPreferredAccount(input: $input) {
      ...AffiliateBusinessDeveloperFields
    }
  }
`;

export const AFFILIATE_CREATOR_CHANNEL_CONTACTS_QUERY = gql`
  query AffiliateCreatorChannelContacts($input: AffiliateCreatorChannelContactPageInput!) {
    affiliateCreatorChannelContacts(input: $input) {
      items {
        id
        creatorRelationshipId
        channel
        accountBindingId
        businessDeveloperId
        creatorPhone
        creatorEmail
        customAlias
        providerAlias
        effectiveAlias
        status
        source
        verifiedAt
        firstObservedAt
        lastObservedAt
        lastInboundAt
        lastOutboundAt
      }
      totalCount
      offset
      limit
    }
  }
`;

export const ASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION = gql`
  ${WHATSAPP_ACCOUNT_FIELDS_FRAGMENT}
  mutation AssignAffiliateWhatsAppAccount($accountBindingId: ID!, $businessDeveloperId: ID!) {
    assignAffiliateWhatsAppAccount(accountBindingId: $accountBindingId, businessDeveloperId: $businessDeveloperId) {
      ...WhatsAppAccountFields
    }
  }
`;

export const UNASSIGN_AFFILIATE_WHATSAPP_ACCOUNT_MUTATION = gql`
  ${WHATSAPP_ACCOUNT_FIELDS_FRAGMENT}
  mutation UnassignAffiliateWhatsAppAccount($accountBindingId: ID!) {
    unassignAffiliateWhatsAppAccount(accountBindingId: $accountBindingId) {
      ...WhatsAppAccountFields
    }
  }
`;

export const ASSIGN_AFFILIATE_EMAIL_ACCOUNT_MUTATION = gql`
  ${EMAIL_ACCOUNT_FIELDS_FRAGMENT}
  mutation AssignAffiliateEmailAccount($accountBindingId: ID!, $businessDeveloperId: ID!) {
    assignAffiliateEmailAccount(accountBindingId: $accountBindingId, businessDeveloperId: $businessDeveloperId) {
      ...EmailAccountFields
    }
  }
`;

export const UNASSIGN_AFFILIATE_EMAIL_ACCOUNT_MUTATION = gql`
  ${EMAIL_ACCOUNT_FIELDS_FRAGMENT}
  mutation UnassignAffiliateEmailAccount($accountBindingId: ID!) {
    unassignAffiliateEmailAccount(accountBindingId: $accountBindingId) {
      ...EmailAccountFields
    }
  }
`;

export const IMPORT_AFFILIATE_CREATOR_PROTECTIONS_MUTATION = gql`
  mutation ImportAffiliateCreatorProtections($input: ImportAffiliateCreatorProtectionsInput!) {
    importAffiliateCreatorProtections(input: $input) {
      createdCount
      updatedCount
      resolvedCount
      unresolvedCount
      rejectedRows {
        index
        reason
      }
    }
  }
`;

export const COMPLETE_AFFILIATE_OPERATIONAL_ONBOARDING_MUTATION = gql`
  mutation CompleteAffiliateOperationalOnboarding {
    completeAffiliateOperationalOnboarding {
      id
      userId
      onboardingCompletedAt
    }
  }
`;

export const ASSIGN_AFFILIATE_BUSINESS_DEVELOPER_MUTATION = gql`
  mutation AssignAffiliateBusinessDeveloper($input: AssignAffiliateBusinessDeveloperInput!) {
    assignAffiliateBusinessDeveloper(input: $input) {
      id
      businessDeveloperId
      operationalConfigRevision
      updatedAt
    }
  }
`;

export const PROTECT_AFFILIATE_CREATOR_RELATIONSHIP_MUTATION = gql`
  mutation ProtectAffiliateCreatorRelationship($input: ProtectAffiliateCreatorRelationshipInput!) {
    protectAffiliateCreatorRelationship(input: $input) {
      id
      userId
      platform
      creatorId
      creatorOpenId
      username
      businessDeveloperId
      note
      source
      createdAt
      updatedAt
    }
  }
`;

export const REMOVE_AFFILIATE_CREATOR_PROTECTION_MUTATION = gql`
  mutation RemoveAffiliateCreatorProtection($id: ID!) {
    removeAffiliateCreatorProtection(id: $id) {
      removedId
      creatorId
      creatorRelationshipId
      redispatchScheduled
    }
  }
`;

export const REMOVE_AFFILIATE_CREATOR_RELATIONSHIP_PROTECTION_MUTATION = gql`
  mutation RemoveAffiliateCreatorRelationshipProtection($creatorRelationshipId: ID!) {
    removeAffiliateCreatorRelationshipProtection(creatorRelationshipId: $creatorRelationshipId) {
      removedId
      creatorId
      creatorRelationshipId
      redispatchScheduled
    }
  }
`;

export const AFFILIATE_OPERATIONAL_PROJECTION_HEALTH_QUERY = gql`
  query AffiliateOperationalProjectionHealth($shopId: ID!) {
    affiliateOperationalProjectionHealth(shopId: $shopId) {
      shopId
      ready
      datasets {
        dataset
        status
        currentStatus
        historyStatus
        ready
        complete
        stale
        lastSuccessfulSyncAt
        lastHeadSyncAt
        lastHistorySyncAt
        historyCutoffAt
        oldestCoveredAt
        providerWindowLimited
        reason
      }
    }
  }
`;
