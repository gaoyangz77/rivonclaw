import type { ApolloClient } from "@apollo/client";
import type { GQL } from "@rivonclaw/core";
import { ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY } from "../../api/shops-queries.js";

export type ProductOption = Pick<GQL.EcomProductSummary, "shopId" | "productId" | "title">;

export type ShopCatalogResult =
  | { shopId: string; status: "fulfilled"; products: ProductOption[] }
  | { shopId: string; status: "rejected"; error: unknown };

function waitForJitter(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(new Error("Product catalog request cancelled"));
    };
    // All shops get independent 0–150 ms delays, never a serial queue or worker limit.
    const timer = setTimeout(
      () => {
        signal.removeEventListener("abort", cancel);
        resolve();
      },
      Math.floor(Math.random() * 151),
    );
    if (signal.aborted) cancel();
    else signal.addEventListener("abort", cancel, { once: true });
  });
}

/** Start every shop concurrently; isolate failures and publish each settled shop immediately. */
export async function requestProductCatalogs(
  client: ApolloClient,
  shopIds: string[],
  signal: AbortSignal,
  onSettled: (result: ShopCatalogResult) => void,
) {
  await Promise.all(
    shopIds.map(async (shopId) => {
      let result: ShopCatalogResult;
      try {
        await waitForJitter(signal);
        const products = await requestProductCatalog(client, shopId, signal);
        result = { shopId, status: "fulfilled", products };
      } catch (error) {
        result = { shopId, status: "rejected", error };
      }
      if (!signal.aborted) onSettled(result);
    }),
  );
}

/** One complete shop catalog per request, bounded even if the transport stalls. */
export function requestProductCatalog(client: ApolloClient, shopId: string, signal: AbortSignal) {
  return new Promise<ProductOption[]>((resolve, reject) => {
    let subscription: { unsubscribe: () => void } | undefined;
    const transport = new AbortController();
    let settled = false;
    const finish = (error?: Error, products: ProductOption[] = []) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      subscription?.unsubscribe();
      transport.abort();
      if (error) reject(error);
      else resolve(products);
    };
    const cancel = () => finish(new Error("Product catalog request cancelled"));
    const timer = setTimeout(() => finish(new Error("Product catalog request timed out")), 30_000);
    if (signal.aborted) {
      cancel();
      return;
    }
    signal.addEventListener("abort", cancel, { once: true });
    try {
      subscription = client
        .watchQuery<{ ecommerceSearchProducts: ProductOption[] }>({
          query: ECOMMERCE_PRODUCT_FILTER_OPTIONS_QUERY,
          variables: { shopIds: [shopId] },
          fetchPolicy: "no-cache",
          context: { queryDeduplication: false, fetchOptions: { signal: transport.signal } },
        })
        .subscribe({
          next: (result) => {
            if (result.error) finish(result.error);
            else if (!result.loading && result.dataState === "complete") {
              finish(undefined, result.data.ecommerceSearchProducts ?? []);
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
