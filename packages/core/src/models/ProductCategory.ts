import { types } from "mobx-state-tree";
import type { ProductCategoryCatalog } from "../generated/graphql.js";

/** Backend-owned business data, represented as runtime MST state. */
export const ProductCategoryModel = types.model("ProductCategory", {
  id: types.identifier,
  categoryId: types.string,
  market: types.string,
  categoryVersion: types.string,
  listingPlatform: types.string,
  parentId: types.string,
  isLeaf: types.boolean,
  name: types.maybeNull(types.string),
});

export const ProductCategoryCacheModel = types.model("ProductCategoryCache", {
  locale: types.identifier,
  items: types.optional(types.map(ProductCategoryModel), {}),
  marketVersions: types.optional(types.map(types.string), {}),
  syncStatus: types.optional(
    types.array(
      types.model("ProductCategorySyncStatus", {
        market: types.string,
        categoryVersion: types.string,
        lastSuccessAt: types.maybeNull(types.string),
        categoryCount: types.number,
      }),
    ),
    [],
  ),
  fetchedAt: types.maybeNull(types.number),
  loading: types.optional(types.boolean, false),
  error: types.maybeNull(types.string),
});

export const PRODUCT_CATEGORY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export const PRODUCT_CATEGORIES_QUERY = `
  query ProductCategoriesSync($locale: String!) {
    productCategories(locale: $locale) {
      locale fetchedAt
      items { id categoryId market categoryVersion listingPlatform parentId isLeaf name }
      marketVersions { market categoryVersion }
      syncStatus { market categoryVersion lastSuccessAt categoryCount }
    }
  }
`;

export function productCategoryCacheSnapshot(catalog: ProductCategoryCatalog) {
  const fetchedAt = new Date(catalog.fetchedAt).getTime();
  if (!Number.isFinite(fetchedAt)) throw new Error("Category catalog has no valid fetchedAt");
  return {
    locale: catalog.locale,
    fetchedAt,
    loading: false,
    error: null,
    items: Object.fromEntries(
      catalog.items.map((item) => [
        item.id,
        {
          id: item.id,
          categoryId: item.categoryId,
          market: item.market,
          categoryVersion: item.categoryVersion,
          listingPlatform: item.listingPlatform,
          parentId: item.parentId,
          isLeaf: item.isLeaf,
          name: item.name ?? null,
        },
      ]),
    ),
    marketVersions: Object.fromEntries(
      catalog.marketVersions.map((item) => [item.market, item.categoryVersion]),
    ),
    syncStatus: catalog.syncStatus.map((item) => ({
      market: item.market,
      categoryVersion: item.categoryVersion,
      lastSuccessAt: item.lastSuccessAt ?? null,
      categoryCount: item.categoryCount,
    })),
  };
}
