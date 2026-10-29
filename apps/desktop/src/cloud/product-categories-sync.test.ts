import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GQL } from "@rivonclaw/core";
import { PRODUCT_CATEGORY_CACHE_TTL_MS, RootStoreModel } from "@rivonclaw/core/models";
import { applyPatch, getSnapshot } from "mobx-state-tree";
import { rootStore, subscribeToPatch } from "../app/store/desktop-store.js";
import { ensureDesktopCategories } from "./product-categories-sync.js";

const diskCache = vi.hoisted(() => ({ read: vi.fn(), write: vi.fn() }));
vi.mock("./product-category-cache.js", () => ({
  readProductCategoryCache: diskCache.read,
  writeProductCategoryCache: diskCache.write,
}));

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
  diskCache.read.mockReset().mockResolvedValue(null);
  diskCache.write.mockReset().mockResolvedValue(undefined);
  rootStore.clearCloudEntities();
  login();
});
afterEach(() => {
  rootStore.clearCloudEntities();
  vi.useRealTimers();
});

describe("Desktop category lifecycle", () => {
  it("deduplicates concurrent loads, caches for seven days and supports explicit refresh", async () => {
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
    vi.setSystemTime(Date.now() + 6 * 24 * 60 * 60 * 1000);
    await ensureDesktopCategories({ graphqlFetch }, "zh");
    expect(graphqlFetch).toHaveBeenCalledTimes(2);
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
    await vi.waitFor(() => expect(graphqlFetch).toHaveBeenCalledTimes(1));
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
    await vi.waitFor(() => expect(graphqlFetch).toHaveBeenCalledTimes(1));
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

  it("reuses the persisted catalog after clearing in-memory account state", async () => {
    const saved = catalog();
    const graphqlFetch = vi.fn().mockResolvedValue({ productCategories: saved });
    await ensureDesktopCategories({ graphqlFetch }, "zh");
    expect(diskCache.write).toHaveBeenCalledWith(saved);

    rootStore.clearCloudEntities();
    login();
    diskCache.read.mockResolvedValue(saved);
    await ensureDesktopCategories({ graphqlFetch }, "zh");

    expect(graphqlFetch).toHaveBeenCalledTimes(1);
    expect(rootStore.productCategoryName("zh", "FR", "601450")).toBe("美妆个护");
    expect(rootStore.categories.get("zh")?.fetchedAt).toBe(Date.parse(saved.fetchedAt));
  });

  it("refreshes an expired disk catalog and bypasses disk on explicit refresh", async () => {
    const expired = {
      ...catalog(),
      fetchedAt: new Date(Date.now() - PRODUCT_CATEGORY_CACHE_TTL_MS - 1).toISOString(),
    };
    diskCache.read.mockResolvedValue(expired);
    const fresh = catalog();
    const graphqlFetch = vi.fn().mockResolvedValue({ productCategories: fresh });
    await ensureDesktopCategories({ graphqlFetch }, "zh");
    expect(graphqlFetch).toHaveBeenCalledTimes(1);
    expect(diskCache.write).toHaveBeenCalledWith(fresh);

    diskCache.read.mockClear();
    await ensureDesktopCategories({ graphqlFetch }, "zh", { force: true });
    expect(diskCache.read).not.toHaveBeenCalled();
    expect(graphqlFetch).toHaveBeenCalledTimes(2);
  });

  it("recovers from a corrupt disk cache and keeps fresh data when cache writes fail", async () => {
    diskCache.read.mockRejectedValue(new Error("invalid gzip"));
    diskCache.write.mockRejectedValue(new Error("disk full"));
    const graphqlFetch = vi.fn().mockResolvedValue({ productCategories: catalog() });
    await ensureDesktopCategories({ graphqlFetch }, "zh");
    expect(rootStore.productCategoryName("zh", "FR", "601450")).toBe("美妆个护");
    expect(rootStore.categories.get("zh")?.error).toBeNull();
  });

  it("does not restore a disk result from an expired account session", async () => {
    let release!: (value: GQL.ProductCategoryCatalog) => void;
    diskCache.read.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const graphqlFetch = vi.fn();
    const pending = ensureDesktopCategories({ graphqlFetch }, "zh");
    rootStore.clearUser();
    login();
    release(catalog());
    await expect(pending).rejects.toThrow("expired account session");
    expect(graphqlFetch).not.toHaveBeenCalled();
    expect(rootStore.categories.size).toBe(0);
  });
});
