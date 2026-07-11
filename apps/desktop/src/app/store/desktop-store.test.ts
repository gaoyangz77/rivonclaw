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

function customerServiceShop(id: string, name: string) {
  return {
    ...shop(id, name),
    services: {
      customerService: {
        enabled: true,
        unpaidOrderReachoutEnabled: true,
        unpaidOrderReachoutStages: [{ id: "stage-1", enabled: true, delayMinutes: 12, messageTemplate: "Order {{order_id}} has {{product_count}} item(s)." }],
        unpaidOrderReachoutExperiment: { enabled: false, holdoutPercent: 5, experimentId: null, startedAt: null },
        businessPrompt: "original prompt",
        runProfileId: "CUSTOMER_SERVICE",
        csDeviceId: "device-1",
        csProviderOverride: null,
        csModelOverride: null,
        escalationChannelId: null,
        escalationRecipientId: null,
        platformSystemPrompt: "platform prompt",
      },
      wms: { enabled: false },
      affiliateService: {
        enabled: false,
        runProfileId: null,
        csDeviceId: null,
        businessPrompt: null,
        modelUsageScope: "USER_LEVEL",
        decisionThresholds: null,
      },
    },
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

  it("preserves existing service fields omitted by partial shop push payloads", () => {
    rootStore.replaceShopsFromGraphQL([
      customerServiceShop("shop-1", "Shop 1"),
    ], "initial");

    rootStore.upsertShopFromGraphQL({
      ...shop("shop-1", "Shop 1 Updated"),
      services: {
        customerService: {
          enabled: true,
          businessPrompt: "updated prompt",
          runProfileId: "CUSTOMER_SERVICE",
          csDeviceId: "device-1",
          csProviderOverride: null,
          csModelOverride: null,
          escalationChannelId: null,
          escalationRecipientId: null,
          platformSystemPrompt: "platform prompt",
        },
        wms: { enabled: false },
        affiliateService: {
          enabled: false,
          runProfileId: null,
          csDeviceId: null,
          businessPrompt: null,
          modelUsageScope: "USER_LEVEL",
          decisionThresholds: null,
        },
      },
    }, "shop-updated-partial");

    const cs = rootStore.getShop("shop-1")?.services?.customerService;
    expect(rootStore.getShop("shop-1")?.shopName).toBe("Shop 1 Updated");
    expect(cs?.businessPrompt).toBe("updated prompt");
    expect(cs?.unpaidOrderReachoutEnabled).toBe(true);
    expect(cs?.unpaidOrderReachoutStages[0]?.delayMinutes).toBe(12);
    expect(cs?.unpaidOrderReachoutStages[0]?.messageTemplate).toBe("Order {{order_id}} has {{product_count}} item(s).");
  });

  it("accepts nullable customer-service business prompt from GraphQL", () => {
    rootStore.replaceShopsFromGraphQL([
      {
        ...customerServiceShop("shop-1", "Shop 1"),
        services: {
          ...customerServiceShop("shop-1", "Shop 1").services,
          customerService: {
            ...customerServiceShop("shop-1", "Shop 1").services.customerService,
            businessPrompt: null,
          },
        },
      },
    ], "graphql:shops");

    expect(rootStore.getShop("shop-1")?.services?.customerService?.businessPrompt).toBeNull();
  });
});
