import { gql } from "@apollo/client/core";

export const SHOP_FIELDS_FRAGMENT = gql`
  fragment ShopFields on Shop {
    id
    platform
    platformAppId
    platformShopId
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
        businessPrompt
        runProfileId
        csDeviceId
        csProviderOverride
        csModelOverride
        escalationChannelId
        escalationRecipientId
        platformSystemPrompt
      }
      wms {
        enabled
      }
      affiliateService {
        enabled
        runProfileId
        csDeviceId
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
    $limit: Int
    $offset: Int
  ) {
    ecommerceGetCustomerServiceInbox(
      shopIds: $shopIds
      status: $status
      aiEnabled: $aiEnabled
      escalation: $escalation
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
    }
  }
`;

export const AFFILIATE_ACTION_PROPOSALS_QUERY = gql`
  query AffiliateActionProposals($input: ReadActionProposalsInput!) {
    actionProposals(input: $input) {
      id
      userId
      shopId
      campaignId
      creatorId
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
        platformConversationId
        creatorImId
        lastCreatorMessageId
        lastCreatorMessageAt
        startedAt
        endedAt
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
      steps {
        stepId
        type
        operatorSummary
        messageIntent {
          conversationId
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
      }
      messageIntent {
        conversationId
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

export const AFFILIATE_DASHBOARD_QUERY = gql`
  query AffiliateDashboard($input: AffiliateDashboardInput) {
    affiliateDashboard(input: $input) {
      summary {
        needsAttentionCount
        pendingApprovalCount
        manualFollowUpCount
        inProgressCount
        historyCount
      }
      items {
        id
        section
        kind
        shopId
        creatorId
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
        collaborationRecord {
          id
          creatorId
          productId
          sampleApplicationRecordId
          platformCollaborationId
          platformConversationId
          processingStatus
          processReasons
          lifecycleStage
          lastSignalAt
          workHandledUntil
          stateUpdatedAt
        }
        proposalId
        proposal {
          id
          userId
          shopId
          campaignId
          creatorId
          collaborationRecordId
          type
          status
          operatorSummary
          steps {
            stepId
            type
            operatorSummary
            messageIntent {
              conversationId
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
          }
          messageIntent {
            conversationId
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
        sampleApplicationRecordId
        sampleApplicationRecord {
          id
          platformApplicationId
          creatorId
          creatorOpenId
          productId
          sampleWorkStatus
          observedContentCount
          latestObservedContentAt
          latestObservedContentUrl
          latestObservedContentFormat
          latestObservedContentPaidOrderCount
          latestObservedContentViewCount
          carrier
          trackingNumber
          shippedAt
          deliveredAt
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
        lifecycleEventId
        lifecycleEventType
        title
        summary
        statusLabel
        occurredAt
        updatedAt
      }
    }
  }
`;

export const AFFILIATE_ML_INSIGHTS_QUERY = gql`
  query AffiliateMlInsights($input: AffiliateMlInsightsInput) {
    affiliateMlInsights(input: $input) {
      latestModelEfficiencySummary {
        userId
        shopId
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
  }
`;

export const AFFILIATE_COLLABORATION_RECORD_ITEMS_QUERY = gql`
  query AffiliateCollaborationRecordItems($input: ReadAffiliateCollaborationRecordsInput!) {
    affiliateCollaborationRecordItems(input: $input) {
      collaborationRecord {
        id
        userId
        shopId
        creatorId
        creatorOpenId
        productId
        lifecycleStage
        processingStatus
        processReasons
        nextSellerActionAt
        stateUpdatedAt
        lastSignalAt
        workHandledUntil
        affiliateCollaborationId
        collaborationType
        platformCollaborationId
        platformConversationId
        creatorImId
        lastCreatorMessageId
        lastCreatorMessageAt
        sampleApplicationRecordId
        startedAt
        endedAt
      }
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
      latestProposal {
        id
        type
        status
        operatorSummary
        createdAt
        updatedAt
      }
      latestLifecycleEvent {
        id
        eventType
        fromStage
        toStage
        displayPayloadJson
        actorType
        createdAt
      }
    }
  }
`;

export const AFFILIATE_COLLABORATION_ACTIVITY_QUERY = gql`
  query AffiliateCollaborationActivity($input: AffiliateCollaborationActivityInput!) {
    affiliateCollaborationActivity(input: $input) {
      actionProposals {
        id
        type
        status
        operatorSummary
        steps {
          stepId
          type
          operatorSummary
          messageIntent {
            conversationId
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
        }
        messageIntent {
          conversationId
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
        createdAt
        updatedAt
        decision {
          decidedAt
          note
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
        eventType
        fromStage
        toStage
        displayPayloadJson
        actorType
        actorId
        createdAt
      }
    }
  }
`;

export const DECIDE_ACTION_PROPOSAL_MUTATION = gql`
  mutation DecideActionProposal($input: DecideActionProposalInput!) {
    decideActionProposal(input: $input) {
      id
      status
      updatedAt
      decision {
        decidedAt
        note
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
