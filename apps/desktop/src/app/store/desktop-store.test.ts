import { beforeEach, describe, expect, it } from "vitest";
import { rootStore } from "./desktop-store.js";

function shop(id: string, name: string) {
  return {
    __typename: "Shop",
    id,
    platform: "TIKTOK_SHOP",
    platformAppId: "app-1",
    platformShopId: `platform-${id}`,
    shopName: name,
    alias: null,
    authStatus: "AUTHORIZED",
    region: "US",
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    services: null,
  };
}

describe("DesktopRootStore shop ingestion", () => {
  beforeEach(() => {
    rootStore.clearCloudEntities();
  });

  it("bulk-upserts pushed shops without replacing the existing shop cache", () => {
    rootStore.replaceShopsFromGraphQL([
      shop("shop-1", "Shop 1"),
      shop("shop-2", "Shop 2"),
    ], "initial");
    const generationBefore = rootStore.shopLifecycle.generation;

    rootStore.upsertShopsFromGraphQL([
      shop("shop-2", "Shop 2 Updated"),
      shop("shop-3", "Shop 3"),
    ], "oauth-complete");

    expect(rootStore.shops.map((item) => item.id)).toEqual(["shop-1", "shop-2", "shop-3"]);
    expect(rootStore.getShop("shop-1")?.shopName).toBe("Shop 1");
    expect(rootStore.getShop("shop-2")?.shopName).toBe("Shop 2 Updated");
    expect(rootStore.getShop("shop-3")?.shopName).toBe("Shop 3");
    expect(rootStore.shopLifecycle.generation).toBe(generationBefore + 1);
    expect(rootStore.shopLifecycle.lastRefreshReason).toBe("oauth-complete");
  });
});
