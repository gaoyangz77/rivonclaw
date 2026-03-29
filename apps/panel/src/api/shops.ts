import { GQL } from "@rivonclaw/core";
import { getClient, trackedQuery } from "./apollo-client.js";
import {
  SHOPS_QUERY,
  SHOP_AUTH_STATUS_QUERY,
  PLATFORM_APPS_QUERY,
  INITIATE_TIKTOK_OAUTH_MUTATION,
  MY_CREDITS_QUERY,
  CS_SESSION_STATS_QUERY,
  REDEEM_CREDIT_MUTATION,
  CS_SKILL_TEMPLATE_QUERY,
} from "./shops-queries.js";

export async function fetchShops(): Promise<GQL.Shop[]> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ shops: GQL.Shop[] }>({
      query: SHOPS_QUERY,
      fetchPolicy: "network-only",
    });
    return result.data!.shops;
  });
}

export async function fetchShopAuthStatus(id: string): Promise<GQL.ShopAuthStatusResponse> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ shopAuthStatus: GQL.ShopAuthStatusResponse }>({
      query: SHOP_AUTH_STATUS_QUERY,
      variables: { id },
      fetchPolicy: "network-only",
    });
    return result.data!.shopAuthStatus;
  });
}

export async function fetchPlatformApps(): Promise<GQL.PlatformApp[]> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ platformApps: GQL.PlatformApp[] }>({
      query: PLATFORM_APPS_QUERY,
      fetchPolicy: "network-only",
    });
    return result.data!.platformApps;
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

export async function fetchMyCredits(): Promise<GQL.ServiceCredit[]> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ myCredits: GQL.ServiceCredit[] }>({
      query: MY_CREDITS_QUERY,
      fetchPolicy: "network-only",
    });
    return result.data!.myCredits;
  });
}

export async function fetchCSSessionStats(shopId: string): Promise<GQL.CsSessionStats> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ csSessionStats: GQL.CsSessionStats }>({
      query: CS_SESSION_STATS_QUERY,
      variables: { shopId },
      fetchPolicy: "network-only",
    });
    return result.data!.csSessionStats;
  });
}

export async function redeemCredit(creditId: string, shopId: string): Promise<boolean> {
  return trackedQuery(async () => {
    const result = await getClient().mutate<{ redeemCredit: boolean }>({
      mutation: REDEEM_CREDIT_MUTATION,
      variables: { creditId, shopId },
    });
    return result.data!.redeemCredit;
  });
}

export async function fetchCsSkillTemplate(): Promise<string | null> {
  return trackedQuery(async () => {
    const result = await getClient().query<{ csSkillTemplate: string | null }>({
      query: CS_SKILL_TEMPLATE_QUERY,
      fetchPolicy: "network-only",
    });
    return result.data!.csSkillTemplate;
  });
}
