import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootstrapDesktopAuthState } from "../src/app/bootstrap-auth-state.js";
import {
  INIT_CREDITS_QUERY,
  INIT_INVENTORY_GOODS_QUERY,
  INIT_PLATFORM_APPS_QUERY,
  INIT_RUN_PROFILES_QUERY,
  INIT_SHOPS_QUERY,
  INIT_SURFACES_QUERY,
  INIT_WAREHOUSES_QUERY,
  INIT_WMS_ACCOUNTS_QUERY,
  TOOL_SPECS_SYNC_QUERY,
} from "../src/cloud/init-queries.js";

function createStore() {
  const state = {
    currentUser: null as Record<string, unknown> | null,
    shops: [{ id: "stale-shop" }] as Array<Record<string, unknown>>,
    platformApps: [{ id: "stale-app" }] as Array<Record<string, unknown>>,
    credits: [{ id: "stale-credit" }] as Array<Record<string, unknown>>,
    wmsAccounts: [{ id: "stale-wms" }] as Array<Record<string, unknown>>,
    warehouses: [{ id: "stale-warehouse" }] as Array<Record<string, unknown>>,
    inventoryGoods: [{ id: "stale-good" }] as Array<Record<string, unknown>>,
    runProfiles: [{ id: "stale-profile" }] as Array<Record<string, unknown>>,
    surfaces: [{ id: "stale-surface" }] as Array<Record<string, unknown>>,
    entitledTools: [{ id: "stale-tool" }] as Array<Record<string, unknown>>,
    authBootstrap: { status: "idle", error: null as string | null },
  };

  const store = {
    state,
    clearCloudEntities: vi.fn(() => {
      state.currentUser = null;
      state.shops = [];
      state.platformApps = [];
      state.credits = [];
      state.wmsAccounts = [];
      state.warehouses = [];
      state.inventoryGoods = [];
      state.runProfiles = [];
      state.surfaces = [];
      state.entitledTools = [];
      state.authBootstrap = { status: "signed_out", error: null };
    }),
    clearCloudDataExceptUser: vi.fn(() => {
      state.shops = [];
      state.platformApps = [];
      state.credits = [];
      state.wmsAccounts = [];
      state.warehouses = [];
      state.inventoryGoods = [];
      state.runProfiles = [];
      state.surfaces = [];
      state.entitledTools = [];
    }),
    setAuthBootstrap: vi.fn((status: string, error: string | null = null) => {
      state.authBootstrap = { status, error };
    }),
    ingestGraphQLResponse: vi.fn((data: Record<string, unknown>) => {
      if (data.me) state.currentUser = data.me as Record<string, unknown>;
      if (data.shops) state.shops = data.shops as Array<Record<string, unknown>>;
      if (data.platformApps) state.platformApps = data.platformApps as Array<Record<string, unknown>>;
      if (data.myCredits) state.credits = data.myCredits as Array<Record<string, unknown>>;
      if (data.readWmsAccounts) state.wmsAccounts = data.readWmsAccounts as Array<Record<string, unknown>>;
      if (data.readWarehouses) state.warehouses = data.readWarehouses as Array<Record<string, unknown>>;
      if (data.readInventoryGoods) state.inventoryGoods = data.readInventoryGoods as Array<Record<string, unknown>>;
      if (data.runProfiles) state.runProfiles = data.runProfiles as Array<Record<string, unknown>>;
      if (data.surfaces) state.surfaces = data.surfaces as Array<Record<string, unknown>>;
      if (data.toolSpecs) state.entitledTools = data.toolSpecs as Array<Record<string, unknown>>;
    }),
  };

  return store;
}

describe("bootstrapDesktopAuthState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("re-fetches ecommerce account state after clearing stale cloud caches", async () => {
    const store = createStore();
    const queryResults = new Map<string, Record<string, unknown>>([
      [TOOL_SPECS_SYNC_QUERY, { toolSpecs: [{ id: "tool-1" }] }],
      [INIT_SURFACES_QUERY, { surfaces: [{ id: "surface-1", name: "Surface", userId: "u1", allowedToolIds: [], createdAt: "2026-04-22", updatedAt: "2026-04-22" }] }],
      [INIT_RUN_PROFILES_QUERY, { runProfiles: [{ id: "profile-1", name: "Profile", userId: "u1", surfaceId: "surface-1", selectedToolIds: [] }] }],
      [INIT_SHOPS_QUERY, { shops: [{ id: "shop-1", platform: "tiktok", platformAppId: "app-1", platformShopId: "p-shop-1", shopName: "Shop 1", authStatus: "ok", region: "US", accessTokenExpiresAt: null, refreshTokenExpiresAt: null, services: null }] }],
      [INIT_PLATFORM_APPS_QUERY, { platformApps: [{ id: "app-1", platform: "tiktok", market: "US", status: "ACTIVE", label: "TikTok US", apiBaseUrl: "https://example.com", authLinkUrl: "https://example.com/auth" }] }],
      [INIT_CREDITS_QUERY, { myCredits: [{ id: "credit-1", service: "cs", quota: 1, status: "active", expiresAt: null, source: "grant" }] }],
      [INIT_WMS_ACCOUNTS_QUERY, { readWmsAccounts: [{ id: "wms-1", label: "WMS 1", provider: "YEJOIN", endpoint: "https://wms.example.com", status: "ACTIVE", userId: "u1", createdAt: "2026-04-22", updatedAt: "2026-04-22" }] }],
      [INIT_WAREHOUSES_QUERY, { readWarehouses: [{ id: "warehouse-1", name: "Warehouse 1", provider: "YEJOIN", warehouseType: "THIRD_PARTY_WMS", status: "ACTIVE", userId: "u1", createdAt: "2026-04-22", updatedAt: "2026-04-22" }] }],
      [INIT_INVENTORY_GOODS_QUERY, { readInventoryGoods: [{ id: "good-1", userId: "u1", sku: "SKU-1", name: "Good 1", status: "ACTIVE", createdAt: "2026-04-22", updatedAt: "2026-04-22" }] }],
    ]);

    const authSession = {
      getAccessToken: vi.fn(() => "token"),
      validate: vi.fn(async () => ({
        userId: "u1",
        enrolledModules: ["GLOBAL_ECOMMERCE_SELLER"],
      })),
      graphqlFetch: vi.fn(async (query: string) => {
        const result = queryResults.get(query);
        if (!result) throw new Error(`Unexpected query: ${query}`);
        return result;
      }),
    };

    await bootstrapDesktopAuthState(authSession, store);

    expect(store.clearCloudDataExceptUser).toHaveBeenCalledTimes(1);
    expect(authSession.graphqlFetch).toHaveBeenCalledWith(INIT_SHOPS_QUERY);
    expect(authSession.graphqlFetch).toHaveBeenCalledWith(INIT_PLATFORM_APPS_QUERY);
    expect(authSession.graphqlFetch).toHaveBeenCalledWith(INIT_CREDITS_QUERY);
    expect(authSession.graphqlFetch).toHaveBeenCalledWith(INIT_WMS_ACCOUNTS_QUERY);
    expect(authSession.graphqlFetch).toHaveBeenCalledWith(INIT_WAREHOUSES_QUERY);
    expect(authSession.graphqlFetch).toHaveBeenCalledWith(INIT_INVENTORY_GOODS_QUERY);
    expect(store.state.shops).toEqual(queryResults.get(INIT_SHOPS_QUERY)?.shops);
    expect(store.state.platformApps).toEqual(queryResults.get(INIT_PLATFORM_APPS_QUERY)?.platformApps);
    expect(store.state.credits).toEqual(queryResults.get(INIT_CREDITS_QUERY)?.myCredits);
    expect(store.state.wmsAccounts).toEqual(queryResults.get(INIT_WMS_ACCOUNTS_QUERY)?.readWmsAccounts);
    expect(store.state.warehouses).toEqual(queryResults.get(INIT_WAREHOUSES_QUERY)?.readWarehouses);
    expect(store.state.inventoryGoods).toEqual(queryResults.get(INIT_INVENTORY_GOODS_QUERY)?.readInventoryGoods);
    expect(store.state.authBootstrap).toEqual({ status: "ready", error: null });
  });

  it("does not fetch ecommerce account state for non-ecommerce users", async () => {
    const store = createStore();
    const authSession = {
      getAccessToken: vi.fn(() => "token"),
      validate: vi.fn(async () => ({
        userId: "u1",
        enrolledModules: [],
      })),
      graphqlFetch: vi.fn(async (query: string) => {
        if (query === TOOL_SPECS_SYNC_QUERY) return { toolSpecs: [] };
        if (query === INIT_SURFACES_QUERY) return { surfaces: [] };
        if (query === INIT_RUN_PROFILES_QUERY) return { runProfiles: [] };
        throw new Error(`Unexpected query: ${query}`);
      }),
    };

    await bootstrapDesktopAuthState(authSession, store);

    expect(authSession.graphqlFetch).not.toHaveBeenCalledWith(INIT_SHOPS_QUERY);
    expect(authSession.graphqlFetch).not.toHaveBeenCalledWith(INIT_PLATFORM_APPS_QUERY);
    expect(authSession.graphqlFetch).not.toHaveBeenCalledWith(INIT_CREDITS_QUERY);
    expect(authSession.graphqlFetch).not.toHaveBeenCalledWith(INIT_WMS_ACCOUNTS_QUERY);
    expect(authSession.graphqlFetch).not.toHaveBeenCalledWith(INIT_WAREHOUSES_QUERY);
    expect(authSession.graphqlFetch).not.toHaveBeenCalledWith(INIT_INVENTORY_GOODS_QUERY);
  });
});
