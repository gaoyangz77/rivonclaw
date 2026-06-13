import { gql } from "@apollo/client/core";

export const ADS_ADVERTISER_FIELDS_FRAGMENT = gql`
  fragment AdsAdvertiserFields on AdsAdvertiser {
    id
    userId
    platform
    businessConnectionId
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
  }
`;

export const ADS_BUSINESS_CONNECTION_FIELDS_FRAGMENT = gql`
  fragment AdsBusinessConnectionFields on AdsBusinessConnection {
    id
    userId
    platform
    authGrantId
    authStatus
    displayName
    authorizedAt
    accessTokenExpiresAt
    refreshTokenExpiresAt
    advertiserCount
    managedShopCount
    lastSyncedAt
    lastError
    createdAt
    updatedAt
  }
`;

export const ADS_STORE_ACCESS_FIELDS_FRAGMENT = gql`
  fragment AdsStoreAccessFields on AdsStoreAccess {
    id
    userId
    platform
    adsAdvertiserId
    advertiserId
    shopId
    linkedShopId
    shopPlatformShopId
    linkedShopName
    linkedShopAuthStatus
    linkStatus
    isManagedByEasyClaw
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
  }
`;

export const ADS_ADVERTISERS_QUERY = gql`
  ${ADS_BUSINESS_CONNECTION_FIELDS_FRAGMENT}
  ${ADS_ADVERTISER_FIELDS_FRAGMENT}
  query AdsAdvertisers {
    adsBusinessConnections {
      ...AdsBusinessConnectionFields
    }
    adsAdvertisers {
      ...AdsAdvertiserFields
    }
  }
`;

export const ADS_STORE_ACCESSES_QUERY = gql`
  ${ADS_STORE_ACCESS_FIELDS_FRAGMENT}
  query AdsStoreAccesses($managedOnly: Boolean) {
    adsStoreAccesses(managedOnly: $managedOnly) {
      ...AdsStoreAccessFields
    }
  }
`;

export const INITIATE_TIKTOK_ADS_OAUTH_MUTATION = gql`
  mutation InitiateTikTokAdsOAuth {
    initiateTikTokAdsOAuth {
      authUrl
      state
    }
  }
`;

export const DISCONNECT_ADS_ADVERTISER_MUTATION = gql`
  mutation DisconnectAdsAdvertiser($id: ID!) {
    disconnectAdsAdvertiser(id: $id)
  }
`;
