import type { GQL } from "@rivonclaw/core";
import { PRODUCT_CATEGORIES_QUERY, PRODUCT_CATEGORY_CACHE_TTL_MS } from "@rivonclaw/core/models";
import { rootStore } from "../app/store/desktop-store.js";
import { normalizeAppLocale } from "../i18n/locale.js";
import { createLogger } from "@rivonclaw/logger";
import { readProductCategoryCache, writeProductCategoryCache } from "./product-category-cache.js";

const log = createLogger("product-categories-sync");

interface CategorySession {
  graphqlFetch<T = Record<string, unknown>>(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<T>;
}
const inFlight = new Map<string, Promise<GQL.ProductCategoryCatalog>>();

export async function ensureDesktopCategories(
  authSession: CategorySession,
  localeInput: string,
  options: { force?: boolean } = {},
): Promise<GQL.ProductCategoryCatalog | null> {
  const userId = rootStore.currentUser?.userId;
  if (!userId) return null;
  const locale = normalizeAppLocale(localeInput);
  const session = rootStore.categorySession;
  const key = `${userId}:${session}:${locale}`;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const cached = rootStore.categories.get(locale);
  if (
    !options.force &&
    cached?.fetchedAt != null &&
    !cached.error &&
    Date.now() - cached.fetchedAt < PRODUCT_CATEGORY_CACHE_TTL_MS
  ) {
    return {
      locale,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
      items: [...cached.items.values()].map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        market: item.market,
        categoryVersion: item.categoryVersion,
        listingPlatform: item.listingPlatform,
        parentId: item.parentId,
        isLeaf: item.isLeaf,
        name: item.name,
      })),
      marketVersions: [...cached.marketVersions].map(([market, categoryVersion]) => ({
        market,
        categoryVersion,
      })),
      syncStatus: cached.syncStatus.map((item) => ({
        market: item.market,
        categoryVersion: item.categoryVersion,
        lastSuccessAt: item.lastSuccessAt,
        categoryCount: item.categoryCount,
      })),
    };
  }
  rootStore.beginCategoryLoad(locale);
  const task = (async () => {
    const startedAt = performance.now();
    try {
      if (!options.force) {
        try {
          const persisted = await readProductCategoryCache(locale);
          if (rootStore.categorySession !== session || rootStore.currentUser?.userId !== userId) {
            throw new Error("Category request belongs to an expired account session");
          }
          if (
            persisted &&
            Date.now() - new Date(persisted.fetchedAt).getTime() < PRODUCT_CATEGORY_CACHE_TTL_MS
          ) {
            rootStore.ingestCategoryCatalog(persisted);
            log.info("Product category catalog restored from disk", {
              locale,
              items: persisted.items.length,
              totalMs: Math.round(performance.now() - startedAt),
            });
            return persisted;
          }
        } catch (error) {
          if (rootStore.categorySession !== session || rootStore.currentUser?.userId !== userId) {
            throw error;
          }
          log.warn("Failed to restore product category disk cache; fetching catalog", error);
        }
      }
      const response = await authSession.graphqlFetch<{
        productCategories: GQL.ProductCategoryCatalog;
      }>(PRODUCT_CATEGORIES_QUERY, { locale });
      const fetchedAt = performance.now();
      const catalog = response.productCategories;
      if (
        !catalog ||
        catalog.locale !== locale ||
        !Array.isArray(catalog.items) ||
        !Array.isArray(catalog.marketVersions) ||
        !Array.isArray(catalog.syncStatus)
      ) {
        throw new Error("Invalid product category catalog response");
      }
      if (rootStore.categorySession !== session || rootStore.currentUser?.userId !== userId) {
        throw new Error("Category request belongs to an expired account session");
      }
      rootStore.ingestCategoryCatalog(catalog);
      const completedAt = performance.now();
      log.info("Product category catalog loaded", {
        locale,
        items: catalog.items.length,
        fetchMs: Math.round(fetchedAt - startedAt),
        ingestMs: Math.round(completedAt - fetchedAt),
        totalMs: Math.round(completedAt - startedAt),
      });
      try {
        await writeProductCategoryCache(catalog);
      } catch (error) {
        log.warn("Failed to persist product category disk cache", error);
      }
      return catalog;
    } catch (error) {
      if (rootStore.categorySession === session && rootStore.currentUser?.userId === userId) {
        rootStore.failCategoryLoad(locale, error instanceof Error ? error.message : String(error));
      }
      throw error;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, task);
  return task;
}
