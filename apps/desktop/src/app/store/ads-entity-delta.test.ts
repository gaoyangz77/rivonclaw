import { beforeEach, describe, expect, it } from "vitest";
import { applyPatch, getSnapshot, isAlive } from "mobx-state-tree";
import { RootStoreModel } from "@rivonclaw/core/models";
import { rootStore, subscribeToPatch } from "./desktop-store.js";

const now = "2026-10-29T15:00:00.000Z";
const advertiser = (id: string, name = id) => ({
  __typename: "AdsAdvertiser",
  id,
  userId: "user",
  platform: "TIKTOK_ADS",
  ownerType: "SELLER",
  advertiserId: `platform-${id}`,
  advertiserName: name,
  auth: { status: "AUTHORIZED" },
  biSyncStatus: "ENABLED",
  createdAt: now,
  updatedAt: now,
});
const access = (id: string, adsAdvertiserId: string) => ({
  __typename: "AdsStoreAccess",
  id,
  userId: "user",
  platform: "TIKTOK_ADS",
  adsAdvertiserId,
  advertiserId: `platform-${adsAdvertiserId}`,
  storeId: `store-${id}`,
  createdAt: now,
  updatedAt: now,
});

describe("Ads scoped MST delta", () => {
  beforeEach(async () => {
    rootStore.clearCloudEntities();
    rootStore.ingestGraphQLResponse({
      adsAdvertisers: [advertiser("a"), advertiser("b"), advertiser("deleted")],
      adsStoreAccesses: [access("keep", "b"), access("archived", "a"), access("old", "deleted")],
    });
    await Promise.resolve();
  });

  it("adds, updates and removes scoped data; preserves other nodes and sends replayable Panel patches", async () => {
    const untouchedAccount = rootStore.adsAdvertisers[1];
    const untouchedAccess = rootStore.adsStoreBindings[0];
    const updatedAccount = rootStore.adsAdvertisers[0];
    const panel = RootStoreModel.create(getSnapshot(rootStore));
    const patches: any[] = [];
    const unsubscribe = subscribeToPatch((batch) => {
      patches.push(...batch);
      applyPatch(panel, batch);
    });
    const changed = advertiser("a", "Updated");
    const { biSyncStatus: _unselected, ...selected } = changed;
    rootStore.applyAdsEntityDelta(["a", "new", "deleted"], {
      adsAdvertisers: [selected, advertiser("new")],
      adsStoreAccesses: [access("new-access", "a")],
    });
    await Promise.resolve();
    unsubscribe();
    expect(rootStore.adsAdvertisers.map((row) => row.id)).toEqual(["a", "b", "new"]);
    expect(rootStore.adsStoreBindings.map((row) => row.id)).toEqual(["keep", "new-access"]);
    expect(rootStore.adsAdvertisers[0]).toBe(updatedAccount);
    expect(updatedAccount.advertiserName).toBe("Updated");
    expect(updatedAccount.biSyncStatus).toBe("ENABLED");
    expect(rootStore.adsAdvertisers[1]).toBe(untouchedAccount);
    expect(rootStore.adsStoreBindings[0]).toBe(untouchedAccess);
    expect(isAlive(untouchedAccount) && isAlive(untouchedAccess)).toBe(true);
    expect(patches.length).toBeGreaterThan(0);
    expect(
      patches.some(
        (patch) => patch.path === "/adsAdvertisers" || patch.path === "/adsStoreBindings",
      ),
    ).toBe(false);
    expect(getSnapshot(panel).adsAdvertisers).toEqual(getSnapshot(rootStore).adsAdvertisers);
    expect(getSnapshot(panel).adsStoreBindings).toEqual(getSnapshot(rootStore).adsStoreBindings);
  });

  it("removes only requested scopes when no active rows remain", () => {
    rootStore.applyAdsEntityDelta(["a"], { adsAdvertisers: [], adsStoreAccesses: [] });
    expect(rootStore.adsAdvertisers.map((row) => row.id)).toEqual(["b", "deleted"]);
    expect(rootStore.adsStoreBindings.map((row) => row.id)).toEqual(["keep", "old"]);
  });

  it("does not emit patches for an unchanged scoped snapshot", async () => {
    const patches: unknown[] = [];
    const unsubscribe = subscribeToPatch((batch) => patches.push(...batch));
    rootStore.applyAdsEntityDelta(["a"], {
      adsAdvertisers: [advertiser("a")],
      adsStoreAccesses: [access("archived", "a")],
    });
    await Promise.resolve();
    unsubscribe();
    expect(patches).toEqual([]);
  });

  it.each([
    { adsAdvertisers: [advertiser("b")], adsStoreAccesses: [] },
    {
      adsAdvertisers: [advertiser("a", "Changed")],
      adsStoreAccesses: [{ ...access("invalid", "a"), storeId: null }],
    },
    { adsAdvertisers: [], adsStoreAccesses: [access("keep", "a")] },
    { adsAdvertisers: [advertiser("a"), advertiser("a")], adsStoreAccesses: [] },
  ])(
    "rejects malformed, duplicate or conflicting deltas before either collection changes %#",
    (data) => {
      const previous = getSnapshot(rootStore);
      expect(() => rootStore.applyAdsEntityDelta(["a"], data)).toThrow();
      expect(getSnapshot(rootStore)).toEqual(previous);
    },
  );
});
