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
        businessPrompt
        runProfileId
        csDeviceId
        csProviderOverride
        csModelOverride
        escalationChannelId
        escalationRecipientId
        platformSystemPrompt
      }
      customerServiceBilling {
        tier
        balance
        balanceExpiresAt
        periodEnd
      }
      wms {
        enabled
      }
      affiliateService {
        enabled
        runProfileId
        csDeviceId
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

export const MY_CREDITS_QUERY = gql`
  query MyCredits {
    myCredits {
      id
      service
      quota
      status
      expiresAt
      source
    }
  }
`;

export const REDEEM_CREDIT_MUTATION = gql`
  ${SHOP_FIELDS_FRAGMENT}
  mutation RedeemCredit($creditId: ID!, $shopId: ID!) {
    redeemCredit(creditId: $creditId, shopId: $shopId) {
      ...ShopFields
    }
  }
`;

export const PRESET_SKILLS_QUERY = gql`
  query PresetSkills($serviceIds: [ServiceId!]) {
    presetSkills(serviceIds: $serviceIds)
  }
`;

export const AFFILIATE_ACTION_PROPOSALS_QUERY = gql`
  query AffiliateActionProposals($input: ReadActionProposalsInput!) {
    actionProposals(input: $input) {
      id
      shopId
      campaignId
      creatorId
      collaborationId
      type
      status
      summary
      createdAt
      updatedAt
      expiresAt
      policySnapshot {
        action
        requiresApproval
        matchedPolicyIds
        reasons
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
        targetCollaborationRecordId
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

export const DECIDE_ACTION_PROPOSAL_MUTATION = gql`
  mutation DecideActionProposal($input: DecideActionProposalInput!) {
    decideActionProposal(input: $input) {
      id
      status
      updatedAt
      decision {
        decidedAt
        decidedByActorId
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
