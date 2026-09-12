import type { ApolloClient } from "@apollo/client";
import type { GQL } from "@rivonclaw/core";
import { ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY } from "../../api/shops-queries.js";

export type ProductOption = GQL.UserProductSearchItem;

/** Exactly one network operation per submitted search, regardless of shop count. No retries. */
export function requestUserProducts(
  client: ApolloClient,
  keywordOrId: string,
  signal: AbortSignal,
) {
  return new Promise<GQL.UserProductSearchResult>((resolve, reject) => {
    let subscription: { unsubscribe: () => void } | undefined;
    const transport = new AbortController();
    let settled = false;
    const finish = (error?: Error, result?: GQL.UserProductSearchResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      subscription?.unsubscribe();
      transport.abort();
      if (error) reject(error);
      else if (result) resolve(result);
      else reject(new Error("Missing user product search response"));
    };
    const cancel = () => finish(new Error("Product search cancelled"));
    const timer = setTimeout(() => finish(new Error("Product search timed out")), 45_000);
    if (signal.aborted) {
      cancel();
      return;
    }
    signal.addEventListener("abort", cancel, { once: true });
    try {
      subscription = client
        .watchQuery<Pick<GQL.Query, "searchProductsForUser">>({
          query: ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY,
          variables: { keywordOrId },
          fetchPolicy: "no-cache",
          context: { queryDeduplication: false, fetchOptions: { signal: transport.signal } },
        })
        .subscribe({
          next: (result) => {
            if (result.error) finish(result.error);
            else if (!result.loading && result.dataState === "complete") {
              finish(undefined, result.data.searchProductsForUser);
            }
          },
          error: (error: Error) => finish(error),
        });
      if (settled) subscription.unsubscribe();
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
