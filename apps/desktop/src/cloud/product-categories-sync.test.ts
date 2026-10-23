import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GQL } from "@rivonclaw/core";
import { PRODUCT_CATEGORY_CACHE_TTL_MS, RootStoreModel } from "@rivonclaw/core/models";
import { applyPatch, getSnapshot } from "mobx-state-tree";
import { rootStore, subscribeToPatch } from "../app/store/desktop-store.js";
import { ensureDesktopCategories } from "./product-categories-sync.js";

const catalog = (locale = "zh", name = "美妆个护"): GQL.ProductCategoryCatalog => ({
  locale,
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
      name,
    },
  ],
  marketVersions: [{ market: "FR", categoryVersion: "v2" }],
  syncStatus: [],
});
function login(userId = "owner") {
  rootStore.ingestGraphQLResponse({
    me: { userId, email: "test@example.com", createdAt: "2026-10-23T00:00:00Z" },
  });
}
beforeEach(() => {
  rootStore.clearCloudEntities();
  login();
});
afterEach(() => {
  rootStore.clearCloudEntities();
  vi.useRealTimers();
});

describe("Desktop category lifecycle", () => {
  it("deduplicates concurrent loads, caches for 24 hours and supports forced language reloads", async () => {
    const graphqlFetch = vi.fn().mockResolvedValue({ productCategories: catalog() });
    await Promise.all([
      ensureDesktopCategories({ graphqlFetch }, "zh"),
      ensureDesktopCategories({ graphqlFetch }, "zh"),
    ]);
    expect(graphqlFetch).toHaveBeenCalledTimes(1);
    await ensureDesktopCategories({ graphqlFetch }, "zh");
    expect(graphqlFetch).toHaveBeenCalledTimes(1);
    await ensureDesktopCategories({ graphqlFetch }, "zh", { force: true });
    expect(graphqlFetch).toHaveBeenCalledTimes(2);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + PRODUCT_CATEGORY_CACHE_TTL_MS + 1);
    await ensureDesktopCategories({ graphqlFetch }, "zh");
    expect(graphqlFetch).toHaveBeenCalledTimes(3);
    expect(rootStore.productCategoryName("zh", "FR", "601450")).toBe("美妆个护");
    expect(rootStore.productCategoryName("zh", "MX", "601450")).toBeNull();
  });

  it("keeps language buckets independent when responses arrive out of order", async () => {
    let release!: (value: unknown) => void;
    const graphqlFetch = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValueOnce({ productCategories: catalog("en", "Beauty & Personal Care") });
    const chinese = ensureDesktopCategories({ graphqlFetch }, "zh");
    await ensureDesktopCategories({ graphqlFetch }, "en");
    release({ productCategories: catalog() });
    await chinese;
    expect(rootStore.productCategoryName("en", "FR", "601450")).toBe("Beauty & Personal Care");
    expect(rootStore.productCategoryName("zh", "FR", "601450")).toBe("美妆个护");
  });

  it("retains cached names on failure and retries on the next use", async () => {
    const graphqlFetch = vi
      .fn()
      .mockResolvedValueOnce({ productCategories: catalog() })
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce({ productCategories: catalog() });
    await ensureDesktopCategories({ graphqlFetch }, "zh");
    await expect(ensureDesktopCategories({ graphqlFetch }, "zh", { force: true })).rejects.toThrow(
      "offline",
    );
    expect(rootStore.productCategoryName("zh", "FR", "601450")).toBe("美妆个护");
    expect(rootStore.categories.get("zh")?.error).toBe("offline");
    await ensureDesktopCategories({ graphqlFetch }, "zh");
    expect(graphqlFetch).toHaveBeenCalledTimes(3);
    expect(rootStore.categories.get("zh")?.error).toBeNull();
  });

  it("discards late results after logout/account replacement, including replacement with the same user", async () => {
    let release!: (value: unknown) => void;
    const graphqlFetch = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const pending = ensureDesktopCategories({ graphqlFetch }, "zh");
    rootStore.clearUser();
    login();
    release({ productCategories: catalog() });
    await expect(pending).rejects.toThrow("expired account session");
    expect(rootStore.categories.size).toBe(0);
  });

  it("sends category updates through the normal MST patch stream", async () => {
    const panel = RootStoreModel.create(getSnapshot(rootStore) as any);
    const stop = subscribeToPatch((patches) =>
      patches.forEach((patch) => applyPatch(panel, patch)),
    );
    try {
      await ensureDesktopCategories(
        { graphqlFetch: vi.fn().mockResolvedValue({ productCategories: catalog() }) },
        "zh",
      );
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(panel.productCategoryName("zh", "FR", "601450")).toBe("美妆个护");
    } finally {
      stop();
    }
  });
});
