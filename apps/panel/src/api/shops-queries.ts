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
    accessTokenExpiresAt
    refreshTokenExpiresAt
    services {
      customerService {
        enabled
        unpaidOrderReachoutEnabled
        unpaidOrderReachoutDelayHours
        unpaidOrderReminderMessageTemplate
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
        csDeviceId
        modelUsageScope
        businessPrompt
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
        createdAt
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
        createdAt
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
    actionProposals(input: $input) {
      id
      userId
      focusShopId
      campaignId
      creatorId
      creatorRelationshipId
      creatorProfile {
        id
        creatorOpenId
        creatorImId
        username
        nickname
        avatarUrl
        followerCount
        categoryIds
        marketplaceSnapshotJson
        createdAt
        updatedAt
      }
      collaborationRecordId
      sourceWorkBoundary {
        subjectType
        collaborationRecordId
        creatorRelationshipId
        workKind
        workBundleKind
        versionAt
        triggerKind
        triggerId
        recommendedActionTypes
      }
      collaborationRecord {
        id
        userId
        shopId
        creatorId
        creatorOpenId
        productId
        lifecycleStage
        processingStatus
        requiredAction
        processReasons
        nextSellerActionAt
        stateUpdatedAt
        lastSignalAt
        workHandledUntil
        affiliateCollaborationId
        collaborationType
        sampleApplicationRecordId
        platformCollaborationId
        creatorImId
        lastCreatorMessageId
        lastCreatorMessageAt
        startedAt
        endedAt
        predictionSnapshots {
          sourceCacheId
          predictionType
          captureMode
          scenario
          status
          output
          model
          message
          predictedAt
          capturedAt
        }
        createdAt
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
      steps {
        stepId
        shopId
        campaignId
        collaborationRecordId
        type
        operatorSummary
        predictionCacheIds
        messageIntent {
          creatorId
          creatorOpenId
          messageType
          text
          productId
          platformApplicationId
          platformTargetCollaborationId
          sampleApplicationRecordId
          targetCollaborationRecordId: affiliateCollaborationId
          imageUrl
          imageWidth
          imageHeight
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
      decision {
        decidedAt
        note
        actorType
        actorId
      }
      messageIntent {
        creatorId
        creatorOpenId
        messageType
        text
        productId
        platformApplicationId
        platformTargetCollaborationId
        sampleApplicationRecordId
        targetCollaborationRecordId: affiliateCollaborationId
        imageUrl
        imageWidth
        imageHeight
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
      targetCollaborationIntent {
        name
        message
        endTime
        hasFreeSample
        isSampleApprovalExempt
        creatorIds
        creatorOpenIds
        products {
          productId
          targetCommissionRateBps
          shopAdsCommissionRateBps
        }
        sellerContactInfo {
          email
          phoneNumber
          whatsapp
          telegram
          line
        }
      }
      creatorTagIntent {
        creatorId
        tagId
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
        creatorTagIds
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
      }
    }
  }
`;

export const AFFILIATE_WORK_ITEMS_QUERY = gql`
  query AffiliateWorkItems($input: ReadAffiliateWorkItemsInput) {
    affiliateWorkItems(input: $input) {
      id
      subjectType
      focusShopId
      collaborationRecordId
      focusPlatformShopId
      routingShopIds
      routingPlatformShopIds
      processingStatus
      requiredAction
      processReasons
      workKind
      workBundleKind
      agentDispatchRecommended
      staffReviewRequired
      recommendedActionTypes
      versionAt
      collaboration {
        id
        userId
        shopId
        creatorId
        creatorOpenId
        productId
        lifecycleStage
        processingStatus
        requiredAction
        processReasons
        nextSellerActionAt
        stateUpdatedAt
        lastSignalAt
        workHandledUntil
        affiliateCollaborationId
        collaborationType
        sampleApplicationRecordId
        platformCollaborationId
        creatorImId
        lastCreatorMessageId
        lastCreatorMessageAt
        startedAt
        endedAt
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
      latestPendingProposal {
        id
        userId
        shopId
        campaignId
        creatorId
        collaborationRecordId
        type
        status
        operatorSummary
        predictionCacheIds
        steps {
          stepId
          type
          operatorSummary
          predictionCacheIds
          messageIntent {
            creatorId
            creatorOpenId
            messageType
            text
            productId
            platformApplicationId
            platformTargetCollaborationId
            sampleApplicationRecordId
            targetCollaborationRecordId: affiliateCollaborationId
            imageUrl
            imageWidth
            imageHeight
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
        decision {
          decidedAt
          note
          actorType
          actorId
        }
        messageIntent {
          creatorId
          creatorOpenId
          messageType
          text
          productId
          platformApplicationId
          platformTargetCollaborationId
          sampleApplicationRecordId
          targetCollaborationRecordId: affiliateCollaborationId
          imageUrl
          imageWidth
          imageHeight
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
        targetCollaborationIntent {
          name
          message
          endTime
          hasFreeSample
          isSampleApprovalExempt
          creatorIds
          creatorOpenIds
          products {
            productId
            targetCommissionRateBps
            shopAdsCommissionRateBps
          }
          sellerContactInfo {
            email
            phoneNumber
            whatsapp
            telegram
            line
          }
        }
        creatorTagIntent {
          creatorId
          tagId
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
          creatorTagIds
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
        }
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
          createdAt
          updatedAt
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
          updatedAt
        }
        activeCollaborations {
          id
          userId
          shopId
          creatorId
          creatorOpenId
          productId
          lifecycleStage
          processingStatus
          requiredAction
          processReasons
          nextSellerActionAt
          stateUpdatedAt
          lastSignalAt
          workHandledUntil
          affiliateCollaborationId
          collaborationType
          sampleApplicationRecordId
          platformCollaborationId
          creatorImId
          lastCreatorMessageId
          lastCreatorMessageAt
          startedAt
          endedAt
          createdAt
          updatedAt
        }
        focusCollaboration {
          id
          userId
          shopId
          creatorId
          creatorOpenId
          productId
          lifecycleStage
          processingStatus
          requiredAction
          processReasons
          nextSellerActionAt
          stateUpdatedAt
          lastSignalAt
          workHandledUntil
          affiliateCollaborationId
          collaborationType
          sampleApplicationRecordId
          platformCollaborationId
          creatorImId
          lastCreatorMessageId
          lastCreatorMessageAt
          startedAt
          endedAt
          createdAt
          updatedAt
        }
        ambiguousCollaborationCandidates {
          id
          userId
          shopId
          creatorId
          creatorOpenId
          productId
          lifecycleStage
          processingStatus
          requiredAction
          processReasons
          nextSellerActionAt
          stateUpdatedAt
          lastSignalAt
          workHandledUntil
          affiliateCollaborationId
          collaborationType
          sampleApplicationRecordId
          platformCollaborationId
          creatorImId
          lastCreatorMessageId
          lastCreatorMessageAt
          startedAt
          endedAt
          createdAt
          updatedAt
        }
        pendingProposals {
          id
          userId
          shopId
          campaignId
          creatorId
          collaborationRecordId
          type
          status
          operatorSummary
          updatedAt
          messageIntent {
            creatorId
            creatorOpenId
            messageType
            text
            productId
            platformApplicationId
            platformTargetCollaborationId
            sampleApplicationRecordId
            targetCollaborationRecordId: affiliateCollaborationId
          }
          sampleReviewIntent {
            sampleApplicationRecordId
            platformApplicationId
            decision
            rejectReason
          }
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

export const AFFILIATE_COLLABORATION_RECORDS_QUERY = gql`
  query AffiliateCollaborationRecords($input: ReadAffiliateCollaborationRecordsInput!) {
    collaborationRecords(input: $input) {
      id
      userId
      shopId
      creatorId
      creatorRelationshipId
      creatorProfile {
        id
        platform
        creatorOpenId
        creatorImId
        nickname
        username
        avatarUrl
        followerCount
      }
      creatorOpenId
      productId
      lifecycleStage
      processingStatus
      requiredAction
      processReasons
      nextSellerActionAt
      stateUpdatedAt
      lastSignalAt
      workHandledUntil
      affiliateCollaborationId
      collaborationType
      sampleApplicationRecordId
      platformCollaborationId
      creatorImId
      lastCreatorMessageId
      lastCreatorMessageAt
      startedAt
      endedAt
      createdAt
      updatedAt
      sampleApplicationRecords {
        id
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

export const AFFILIATE_ML_INSIGHT_SUMMARIES_QUERY = gql`
  query AffiliateMlInsightSummaries($input: AffiliateMlInsightSummariesInput) {
    affiliateMlInsightSummaries(input: $input) {
      userId
      shopId
      modelScope
      tenantId
      trainedAt
      evaluationScope
      rowCount
      humanApprovedCount
      humanApprovalRate
      modelSameBudgetCount
      minExpectedSalesUnitsSameBudget
      modelSameBudgetExpectedUnits
      humanSameBudgetExpectedUnits
      modelVsHumanExpectedUnitsLiftRatio
      modelSelectedHumanRejectedCount
      modelRejectedHumanApprovedCount
      modelRejectedHumanApprovedActualUnits
      humanApprovedObservedCount
      humanApprovedActualUnits
      humanApprovedActualAvgUnits
      payload
      createdAt
    }
  }
`;

export const AFFILIATE_APPROVAL_POLICIES_QUERY = gql`
  query AffiliateApprovalPolicies($input: ReadAffiliateApprovalPoliciesInput!) {
    affiliateApprovalPolicies(input: $input) {
      id
      userId
      shopId
      action
      creatorTagIds
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
  query AffiliatePolicyContext($campaignsInput: ReadAffiliateCampaignsInput!, $shopId: String!) {
    affiliateCampaigns(input: $campaignsInput) {
      id
      shopId
      name
      status
      updatedAt
    }
    creatorTags(shopId: $shopId) {
      id
      shopId
      name
      type
      systemKey
      sensitive
      updatedAt
    }
  }
`;

export const AFFILIATE_CREATORS_QUERY = gql`
  query AffiliateCreators($input: ReadAffiliateCreatorsInput!) {
    affiliateCreators(input: $input) {
      creatorId
      tagIds
      tags {
        id
        shopId
        name
        type
        systemKey
        sensitive
        updatedAt
      }
      needsAttention
      activeCollaborationCount
      lastInteractionAt
      shopState {
        shopId
        lifecycleStage
        tagIds
        lastContactedAt
        lastInvitedAt
        lastQualifiedAt
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
        followerCount
        categoryIds
        marketplaceSnapshotJson
        updatedAt
      }
      latestCollaborationRecord {
        id
        userId
        shopId
        creatorId
        creatorOpenId
        productId
        lifecycleStage
        processingStatus
        requiredAction
        processReasons
        nextSellerActionAt
        stateUpdatedAt
        lastSignalAt
        workHandledUntil
        creatorImId
        lastCreatorMessageId
        lastCreatorMessageAt
        affiliateCollaborationId
        collaborationType
        platformCollaborationId
        sampleApplicationRecordId
        startedAt
        endedAt
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
        messageIntent {
          text
          messageType
          productId
          creatorId
          sampleApplicationRecordId
          platformApplicationId
        }
        sampleReviewIntent {
          sampleApplicationRecordId
          platformApplicationId
          decision
          rejectReason
        }
        targetCollaborationIntent {
          name
          message
          creatorIds
          creatorOpenIds
          products {
            productId
            targetCommissionRateBps
            shopAdsCommissionRateBps
          }
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
`;

export const APPLY_CREATOR_TAG_MUTATION = gql`
  mutation ApplyCreatorTag($input: ApplyCreatorTagInput!) {
    applyCreatorTag(input: $input) {
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
  }
`;

export const REMOVE_CREATOR_TAG_MUTATION = gql`
  mutation RemoveCreatorTag($input: ApplyCreatorTagInput!) {
    removeCreatorTag(input: $input) {
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
  }
`;

export const WRITE_AFFILIATE_APPROVAL_POLICY_MUTATION = gql`
  mutation WriteAffiliateApprovalPolicy($input: WriteAffiliateApprovalPolicyInput!) {
    writeAffiliateApprovalPolicy(input: $input) {
      id
      userId
      shopId
      action
      creatorTagIds
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

export const AFFILIATE_COLLABORATION_ACTIVITY_QUERY = gql`
  query AffiliateCollaborationActivity($input: AffiliateCollaborationActivityInput!) {
    affiliateCollaborationActivity(input: $input) {
      limit
      offset
      hasMore
      nextOffset
      actionProposals {
        id
        userId
        focusShopId
        campaignId
        creatorId
        collaborationRecordId
        sourceWorkBoundary {
          subjectType
          collaborationRecordId
          workKind
          workBundleKind
          versionAt
          triggerKind
          triggerId
          recommendedActionTypes
        }
        collaborationRecordLastSignalAt
        collaborationRecordStateUpdatedAt
        type
        status
        operatorSummary
        predictionCacheIds
        steps {
          stepId
          shopId
          campaignId
          collaborationRecordId
          type
          operatorSummary
          predictionCacheIds
          messageIntent {
            creatorId
            creatorOpenId
            messageType
            text
            productId
            platformApplicationId
            platformTargetCollaborationId
            sampleApplicationRecordId
            targetCollaborationRecordId: affiliateCollaborationId
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
          targetCollaborationIntent {
            name
            message
            endTime
            hasFreeSample
            isSampleApprovalExempt
            creatorIds
            creatorOpenIds
            products {
              productId
              targetCommissionRateBps
              shopAdsCommissionRateBps
            }
            sellerContactInfo {
              email
              phoneNumber
              whatsapp
              telegram
              line
            }
          }
        }
        policySnapshot {
          action
          requiresApproval
          matchedPolicyIds
          reasons
        }
        messageIntent {
          creatorId
          creatorOpenId
          messageType
          text
          productId
          platformApplicationId
          platformTargetCollaborationId
          sampleApplicationRecordId
          targetCollaborationRecordId: affiliateCollaborationId
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
        targetCollaborationIntent {
          name
          message
          endTime
          hasFreeSample
          isSampleApprovalExempt
          creatorIds
          creatorOpenIds
          products {
            productId
            targetCommissionRateBps
            shopAdsCommissionRateBps
          }
          sellerContactInfo {
            email
            phoneNumber
            whatsapp
            telegram
            line
          }
        }
        createdAt
        updatedAt
        expiresAt
        decision {
          decidedAt
          note
          actorType
          actorId
        }
        executionResult {
          platformObjectId
          domainObjectId
          executedAt
          errorMessage
        }
      }
      lifecycleEvents {
        id
        userId
        shopId
        entityType
        entityId
        eventType
        fromStage
        toStage
        displayPayloadJson
        actorType
        actorId
        collaborationRecordId
        proposalId
        creatorId
        creatorRelationshipId
        productId
        campaignId
        createdAt
      }
      sampleApplicationRecords {
        id
        userId
        shopId
        creatorId
        creatorOpenId
        productId
        affiliateCollaborationId
        collaborationType
        platformApplicationId
        platformCollaborationId
        platformOpenCollaborationId
        platformTargetCollaborationId
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
        text
        messageType
        messageId
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
      shopId
      campaignId
      creatorId
      collaborationRecordId
      creatorRelationshipId
      sourceWorkBoundary {
        subjectType
        collaborationRecordId
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
      predictionCacheIds
      steps {
        stepId
        type
        operatorSummary
        predictionCacheIds
        messageIntent {
          creatorId
          creatorOpenId
          messageType
          text
          productId
          platformApplicationId
          platformTargetCollaborationId
          sampleApplicationRecordId
          targetCollaborationRecordId: affiliateCollaborationId
          imageUrl
          imageWidth
          imageHeight
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
      decision {
        decidedAt
        note
        actorType
        actorId
      }
      messageIntent {
        creatorId
        creatorOpenId
        messageType
        text
        productId
        platformApplicationId
        platformTargetCollaborationId
        sampleApplicationRecordId
        targetCollaborationRecordId: affiliateCollaborationId
        imageUrl
        imageWidth
        imageHeight
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
      targetCollaborationIntent {
        name
        message
        endTime
        hasFreeSample
        isSampleApprovalExempt
        creatorIds
        creatorOpenIds
        products {
          productId
          targetCommissionRateBps
          shopAdsCommissionRateBps
        }
        sellerContactInfo {
          email
          phoneNumber
          whatsapp
          telegram
          line
        }
      }
      creatorTagIntent {
        creatorId
        tagId
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
        creatorTagIds
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
      }
    }
  }
`;

export const RESOLVE_AFFILIATE_COLLABORATION_STAFF_ACTION_MUTATION = gql`
  mutation ResolveAffiliateCollaborationStaffAction($input: ResolveAffiliateCollaborationStaffActionInput!) {
    resolveAffiliateCollaborationStaffAction(input: $input) {
      collaborationRecord {
        id
        processingStatus
        requiredAction
        processReasons
        nextSellerActionAt
        stateUpdatedAt
        workHandledUntil
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
        status
        providerMessageId
        errorMessage
        createdAt
      }
      collaborationRecord {
        id
        processingStatus
        requiredAction
        processReasons
        stateUpdatedAt
        workHandledUntil
        updatedAt
      }
    }
  }
`;

export const WHATSAPP_ACCOUNT_FIELDS_FRAGMENT = gql`
  fragment WhatsAppAccountFields on WhatsAppAccountBinding {
    id
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
      fallbackCount
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
