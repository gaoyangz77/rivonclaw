import { getClient, trackedQuery } from "./apollo-client.js";
import {
  SHOPS_QUERY,
  SHOP_AUTH_STATUS_QUERY,
  PLATFORM_APPS_QUERY,
  CREATE_SHOP_MUTATION,
  UPDATE_SHOP_MUTATION,
  DELETE_SHOP_MUTATION,
  INITIATE_TIKTOK_OAUTH_MUTATION,
} from "./shops-queries.js";

export interface ShopServiceConfig {
  customerService: boolean;
}

export interface Shop {
  id: string;
  userId: string;
  platform: string;
  platformShopId: string;
  shopName: string;
  authStatus: string;
  region: string;
  platformAppId: string;
  grantedScopes: string[];
  services: ShopServiceConfig;
  createdAt: string;
  updatedAt: string;
}

export interface ShopAuthStatusInfo {
  hasToken: boolean;
  accessTokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
}

export interface PlatformAppInfo {
  id: string;
  platform: string;
  market: string;
  status: string;
  label: string;
  apiBaseUrl: string;
  authLinkUrl: string;
}

export async function fetchShops(): Promise<Shop[]> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ shops: Shop[] }>({
      query: SHOPS_QUERY,
      fetchPolicy: "network-only",
    });
    return result.data!.shops;
  });
}

export async function fetchShopAuthStatus(id: string): Promise<ShopAuthStatusInfo> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ shopAuthStatus: ShopAuthStatusInfo }>({
      query: SHOP_AUTH_STATUS_QUERY,
      variables: { id },
      fetchPolicy: "network-only",
    });
    return result.data!.shopAuthStatus;
  });
}

export async function fetchPlatformApps(): Promise<PlatformAppInfo[]> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ platformApps: PlatformAppInfo[] }>({
      query: PLATFORM_APPS_QUERY,
      fetchPolicy: "network-only",
    });
    return result.data!.platformApps;
  });
}

export async function updateShop(
  id: string,
  input: {
    shopName?: string;
    authStatus?: string;
    region?: string;
    grantedScopes?: string[];
    services?: { customerService?: boolean };
  },
): Promise<Shop> {
  return trackedQuery(async () => {
    const result = await getClient().mutate<{ updateShop: Shop }>({
      mutation: UPDATE_SHOP_MUTATION,
      variables: { id, input },
      refetchQueries: [{ query: SHOPS_QUERY }],
    });
    return result.data!.updateShop;
  });
}

export async function deleteShop(id: string): Promise<boolean> {
  return trackedQuery(async () => {
    const result = await getClient().mutate<{ deleteShop: boolean }>({
      mutation: DELETE_SHOP_MUTATION,
      variables: { id },
      refetchQueries: [{ query: SHOPS_QUERY }],
    });
    return result.data!.deleteShop;
  });
}

export async function initiateTikTokOAuth(platformAppId: string): Promise<{ authUrl: string; state: string }> {
  return trackedQuery(async () => {
    const result = await getClient().mutate<{
      initiateTikTokOAuth: { authUrl: string; state: string };
    }>({
      mutation: INITIATE_TIKTOK_OAUTH_MUTATION,
      variables: { platformAppId },
    });
    return result.data!.initiateTikTokOAuth;
  });
}
