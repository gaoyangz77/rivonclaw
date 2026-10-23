import type { GQL } from "@rivonclaw/core";
import { PRODUCT_CATEGORIES_QUERY, PRODUCT_CATEGORY_CACHE_TTL_MS } from "@rivonclaw/core/models";
import { rootStore } from "../app/store/desktop-store.js";
import { normalizeAppLocale } from "../i18n/locale.js";

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
    try {
      const response = await authSession.graphqlFetch<{
        productCategories: GQL.ProductCategoryCatalog;
      }>(PRODUCT_CATEGORIES_QUERY, { locale });
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
