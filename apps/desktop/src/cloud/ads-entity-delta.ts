import { ADS_ENTITY_DELTA_QUERY } from "./init-queries.js";

/** Plain GraphQL snapshots; validated against the MST models before ingestion. */
export interface AdsEntityDelta {
  adsAdvertisers: unknown[];
  adsStoreAccesses: unknown[];
}

export async function fetchAdsEntityDelta(
  client: { graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> },
  advertiserIds: readonly string[],
  signal?: AbortSignal,
): Promise<AdsEntityDelta> {
  const ids = [...new Set(advertiserIds)];
  const result: AdsEntityDelta = { adsAdvertisers: [], adsStoreAccesses: [] };
  // Keep each backend request bounded, including a large OAuth import. Accumulate
  // all chunks first: a failed chunk must not turn into partial cache deletion.
  for (let offset = 0; offset < ids.length; offset += 100) {
    signal?.throwIfAborted();
    const scope = ids.slice(offset, offset + 100);
    const data = await client.graphql<AdsEntityDelta>(ADS_ENTITY_DELTA_QUERY, { ids: scope });
    signal?.throwIfAborted();
    if (!Array.isArray(data?.adsAdvertisers) || !Array.isArray(data?.adsStoreAccesses)) {
      throw new Error("Incomplete Ads delta response");
    }
    const requested = new Set(scope);
    for (const row of data.adsAdvertisers) {
      if (
        !row ||
        typeof row !== "object" ||
        !requested.has(String((row as Record<string, unknown>).id))
      ) {
        throw new Error("Ads advertiser outside requested delta scope");
      }
    }
    for (const row of data.adsStoreAccesses) {
      if (
        !row ||
        typeof row !== "object" ||
        !requested.has(String((row as Record<string, unknown>).adsAdvertiserId))
      ) {
        throw new Error("Ads store access outside requested delta scope");
      }
    }
    result.adsAdvertisers.push(...data.adsAdvertisers);
    result.adsStoreAccesses.push(...data.adsStoreAccesses);
  }
  return result;
}
