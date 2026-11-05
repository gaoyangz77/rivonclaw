import { useQuery } from "@apollo/client/react";
import type { GQL } from "@rivonclaw/core";
import { AFFILIATE_CREATOR_PERFORMANCE_PROJECTION_STATES_QUERY } from "../../../api/shops-queries.js";
import {
  resolveCreatorPerformanceFreshness,
  type CreatorPerformanceFreshness,
} from "../creator-performance-snapshot.js";

/**
 * Per-shop "data as of" of the Creator performance snapshot. `shopId` empty
 * means every authorized shop. `loaded` stays false until the query answered,
 * so a missing watermark is never confused with one still on its way.
 */
export function useCreatorPerformanceFreshness(shopId: string): {
  freshness: CreatorPerformanceFreshness | null;
  loaded: boolean;
} {
  const { data } = useQuery<
    {
      affiliateCreatorPerformanceProjectionStates: GQL.AffiliateCreatorPerformanceProjectionState[];
    },
    { shopIds: string[] | null }
  >(AFFILIATE_CREATOR_PERFORMANCE_PROJECTION_STATES_QUERY, {
    variables: { shopIds: shopId ? [shopId] : null },
    fetchPolicy: "cache-and-network",
  });
  const states = data?.affiliateCreatorPerformanceProjectionStates;
  return {
    freshness: states ? resolveCreatorPerformanceFreshness(states, shopId) : null,
    loaded: Boolean(states),
  };
}
