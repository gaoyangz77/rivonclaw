import { beforeEach, describe, expect, it } from "vitest";
import { applyPatch, getSnapshot, type IJsonPatch } from "mobx-state-tree";
import { RootStoreModel } from "@rivonclaw/core/models";
import { rootStore, subscribeToPatch } from "./desktop-store.js";

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
        deviceId: null,
        businessPrompt: null,
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
          deviceId: null,
          businessPrompt: null,
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

function payment(id: string, status = "SUCCEEDED") {
  return {
    __typename: "Payment",
    id,
    userId: "user-1",
    provider: "STRIPE",
    method: "CARD",
    status,
    currency: "USD",
    amountMinor: 2900,
    billingActivatedAt: null,
    billingPlanId: "LLM_PRO_MONTHLY",
    billingProduct: "LLM_USAGE",
    billingScopeId: "user-1",
    billingScopeType: "ACCOUNT",
    subject: `Payment ${id}`,
    description: null,
    merchantOrderId: `order-${id}`,
    providerPaymentId: null,
    providerOrderId: null,
    providerSubscriptionId: null,
    checkoutUrl: null,
    qrCode: null,
    lastError: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    paidAt: status === "SUCCEEDED" ? "2026-08-01T00:00:00.000Z" : null,
    expiresAt: null,
    lastProviderEventAt: null,
  };
}

/** Ingest through the proxy's entry point and collect the batches the SSE bus would broadcast. */
async function ingestAndCollect(data: Record<string, unknown>): Promise<IJsonPatch[][]> {
  const batches: IJsonPatch[][] = [];
  const unsubscribe = subscribeToPatch((patches) => batches.push(patches));
  try {
    rootStore.ingestGraphQLResponse(data);
    // Patches flush in a microtask; yield once so the batch is delivered.
    await Promise.resolve();
  } finally {
    unsubscribe();
  }
  return batches;
}

/**
 * The Panel never writes `payments` itself: Desktop ingests the `readPayments`
 * response and the Panel applies the `entity-patch` frames that fall out of it.
 * These tests replay that hand-off against a store with the same shape as the
 * Panel's, so a change to either ingestion or patch batching that stops the
 * rows from arriving fails here rather than on the billing page.
 */
describe("DesktopRootStore payment ingestion", () => {
  beforeEach(() => {
    rootStore.clearCloudEntities();
  });

  it("emits add patches for a first readPayments response that rebuild the list on a Panel-shaped store", async () => {
    const batches = await ingestAndCollect({
      readPayments: [payment("pay-1"), payment("pay-2"), payment("pay-3")],
    });

    expect(rootStore.payments.map((p) => p.id)).toEqual(["pay-1", "pay-2", "pay-3"]);
    expect(batches).toHaveLength(1);
    expect(batches[0].map((patch) => [patch.op, patch.path])).toEqual([
      ["add", "/payments/0"],
      ["add", "/payments/1"],
      ["add", "/payments/2"],
    ]);

    const panel = RootStoreModel.create({});
    applyPatch(panel, batches[0]);
    expect(getSnapshot(panel.payments)).toEqual(getSnapshot(rootStore.payments));
    expect(panel.payments[0].description).toBeNull();
  });

  it("emits field-level replace patches when a known payment changes status", async () => {
    await ingestAndCollect({ readPayments: [payment("pay-1", "PENDING")] });
    const panel = RootStoreModel.create({ payments: getSnapshot(rootStore.payments) });

    const batches = await ingestAndCollect({ readPayments: [payment("pay-1", "SUCCEEDED")] });

    expect(batches).toHaveLength(1);
    expect(batches[0].map((patch) => patch.path).sort()).toEqual(["/payments/0/paidAt", "/payments/0/status"]);
    applyPatch(panel, batches[0]);
    expect(panel.payments[0].status).toBe("SUCCEEDED");
    expect(panel.payments[0].paidAt).toBe("2026-08-01T00:00:00.000Z");
  });
});
