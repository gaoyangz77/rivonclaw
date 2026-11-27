import {
  INIT_ADS_ADVERTISERS_QUERY,
  INIT_BILLING_OVERVIEW_QUERY,
  INIT_INVENTORY_GOODS_QUERY,
  INIT_ME_QUERY,
  INIT_PLATFORM_APPS_QUERY,
  INIT_RUN_PROFILES_QUERY,
  INIT_SHOPS_QUERY,
  INIT_SURFACES_QUERY,
  INIT_WAREHOUSES_QUERY,
  INIT_WMS_ACCOUNTS_QUERY,
  TOOL_SPECS_SYNC_QUERY,
} from "@rivonclaw/core";
import type { GraphQLRequester } from "./web-graphql.js";

const ECOMMERCE_MODULE_ID = "GLOBAL_ECOMMERCE_SELLER";

/**
 * The part of the entity store the web host writes. MST actions of the Panel
 * store; the host never keeps a node.
 */
export interface WebHostStore {
  clearCloudEntities(): void;
  clearCloudDataExceptUser(options?: { preserveShops?: boolean }): void;
  setAuthBootstrap(status: "signed_out" | "loading" | "ready" | "error", error?: string | null): void;
  ingestGraphQLResponse(data: Record<string, unknown>): void;
  removeEntity(typeName: string, id: string): void;
  upsertShopsFromGraphQL(rawShops: unknown[], reason: string): void;
  /** Ids of the shops the user can see, read at call time. */
  shopIds(): string[];
}

/**
 * What Desktop's startup loads (`apps/desktop/src/app/bootstrap-auth-state.ts`),
 * from the same documents, ingested through the same store actions. Returns
 * false when there is no account behind the session.
 */
export async function bootstrapEntities(
  store: WebHostStore,
  request: GraphQLRequester,
): Promise<boolean> {
  store.setAuthBootstrap("loading", null);
  try {
    const { me } = await request<{ me?: { enrolledModules?: string[] } | null }>(INIT_ME_QUERY);
    if (!me) {
      store.clearCloudEntities();
      store.setAuthBootstrap("signed_out", null);
      return false;
    }

    const hasEcommerce = me.enrolledModules?.includes(ECOMMERCE_MODULE_ID) ?? false;
    const queries: Array<[string, string]> = [
      ["ToolSpecsSync", TOOL_SPECS_SYNC_QUERY],
      ["Surfaces", INIT_SURFACES_QUERY],
      ["RunProfiles", INIT_RUN_PROFILES_QUERY],
      ["PlatformApps", INIT_PLATFORM_APPS_QUERY],
      ["BillingOverview", INIT_BILLING_OVERVIEW_QUERY],
      ...(hasEcommerce
        ? ([
            ["Shops", INIT_SHOPS_QUERY],
            ["AdsAdvertisers", INIT_ADS_ADVERTISERS_QUERY],
            ["WmsAccounts", INIT_WMS_ACCOUNTS_QUERY],
            ["Warehouses", INIT_WAREHOUSES_QUERY],
            ["InventoryGoods", INIT_INVENTORY_GOODS_QUERY],
          ] as Array<[string, string]>)
        : []),
    ];

    store.ingestGraphQLResponse({ me });
    const results = await Promise.allSettled(queries.map(([, query]) => request(query)));

    store.clearCloudDataExceptUser({ preserveShops: hasEcommerce });
    results.forEach((result, index) => {
      if (result.status === "fulfilled") store.ingestGraphQLResponse(result.value);
      else console.error(`[web-host] startup query ${queries[index]![0]} failed`, result.reason);
    });

    store.setAuthBootstrap("ready", null);
    return true;
  } catch (error) {
    store.setAuthBootstrap("error", error instanceof Error ? error.message : String(error));
    throw error;
  }
}
