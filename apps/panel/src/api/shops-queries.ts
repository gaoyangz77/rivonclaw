import { gql } from "@apollo/client/core";

export const SHOPS_QUERY = gql`
  query Shops {
    shops {
      id
      userId
      platform
      platformShopId
      shopName
      authStatus
      region
      platformAppId
      grantedScopes
      services {
        customerService
      }
      createdAt
      updatedAt
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

export const CREATE_SHOP_MUTATION = gql`
  mutation CreateShop($input: CreateShopInput!) {
    createShop(input: $input) {
      id
      userId
      platform
      platformShopId
      shopName
      authStatus
      region
      platformAppId
      grantedScopes
      services {
        customerService
      }
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_SHOP_MUTATION = gql`
  mutation UpdateShop($id: ID!, $input: UpdateShopInput!) {
    updateShop(id: $id, input: $input) {
      id
      userId
      platform
      platformShopId
      shopName
      authStatus
      region
      platformAppId
      grantedScopes
      services {
        customerService
      }
      createdAt
      updatedAt
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

export const COMPLETE_TIKTOK_OAUTH_MUTATION = gql`
  mutation CompleteTikTokOAuth($code: String!, $state: String!) {
    completeTikTokOAuth(code: $code, state: $state) {
      shopId
    }
  }
`;
