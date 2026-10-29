import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { applySnapshot } from "mobx-state-tree";
import { entityStore } from "./entity-store.js";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("../api/apollo-client.js", () => ({ getClient: () => ({ query }) }));
const catalog = {
  locale: "zh",
  fetchedAt: new Date().toISOString(),
  items: [
    {
      id: "TIKTOK_SHOP:FR:v2:TIKTOK_SHOP:601450",
      categoryId: "601450",
      market: "FR",
      categoryVersion: "v2",
      listingPlatform: "TIKTOK_SHOP",
      parentId: "0",
      isLeaf: false,
      name: "美妆个护",
    },
  ],
  marketVersions: [{ market: "FR", categoryVersion: "v2" }],
  syncStatus: [],
};
beforeEach(() => {
  entityStore.clearAuth();
  query.mockReset();
  applySnapshot(entityStore, {
    currentUser: { userId: "owner", email: "test@example.com", createdAt: "2026-10-23" },
  } as any);
});
afterEach(() => {
  entityStore.clearAuth();
  vi.useRealTimers();
});

it("ingests immediately without SSE, merges requests and preserves names on failure", async () => {
  query.mockResolvedValueOnce({ data: { productCategories: catalog } });
  await Promise.all([entityStore.ensureCategories("zh"), entityStore.ensureCategories("zh")]);
  expect(query).toHaveBeenCalledTimes(1);
  expect(entityStore.productCategoryName("zh", "FR", "601450")).toBe("美妆个护");
  await entityStore.ensureCategories("zh");
  expect(query).toHaveBeenCalledTimes(1);
  query.mockRejectedValueOnce(new Error("offline"));
  await expect(entityStore.ensureCategories("zh", { force: true })).rejects.toThrow("offline");
  expect(entityStore.productCategoryName("zh", "FR", "601450")).toBe("美妆个护");
  query.mockResolvedValueOnce({ data: { productCategories: catalog } });
  await entityStore.ensureCategories("zh");
  expect(query).toHaveBeenCalledTimes(3);
});

it("does not ingest a late response after logout", async () => {
  let release!: (value: unknown) => void;
  query.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve;
      }),
  );
  const pending = entityStore.ensureCategories("zh");
  entityStore.clearAuth();
  release({ data: { productCategories: catalog } });
  await pending;
  expect(entityStore.categories.size).toBe(0);
});

it("does not let a concurrent lazy request suppress an explicit refresh", async () => {
  query.mockResolvedValue({ data: { productCategories: catalog } });
  await Promise.all([
    entityStore.ensureCategories("zh"),
    entityStore.ensureCategories("zh", { force: true }),
  ]);
  expect(query).toHaveBeenCalledTimes(2);
  expect(query.mock.calls[1][0].context.forceCategoriesRefresh).toBe(true);
});

it("reuses a six-day-old locale when switching back to it", async () => {
  query.mockResolvedValueOnce({ data: { productCategories: catalog } });
  await entityStore.ensureCategories("zh");
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 6 * 24 * 60 * 60 * 1000);
  await entityStore.ensureCategories("zh");
  expect(query).toHaveBeenCalledTimes(1);
});
