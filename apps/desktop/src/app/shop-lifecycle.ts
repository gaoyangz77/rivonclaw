import { createLogger } from "@rivonclaw/logger";
import { INIT_SHOPS_QUERY } from "../cloud/init-queries.js";
import { rootStore } from "./store/desktop-store.js";

const log = createLogger("shop-lifecycle");
const ECOMMERCE_MODULE_ID = "GLOBAL_ECOMMERCE_SELLER";

export interface ShopLifecycleAuthSession {
  graphqlFetch<T = Record<string, unknown>>(query: string): Promise<T>;
}

export async function refreshShopLifecycle(
  authSession: ShopLifecycleAuthSession,
  reason: string,
): Promise<void> {
  if (!rootStore.isModuleEnrolled(ECOMMERCE_MODULE_ID)) {
    log.info(`Skipped shop lifecycle refresh (reason=${reason}, module=not_enrolled)`);
    return;
  }

  rootStore.beginShopRefresh(reason);
  try {
    const data = await authSession.graphqlFetch<Record<string, unknown>>(INIT_SHOPS_QUERY);
    rootStore.ingestGraphQLResponse(data);
    const shopCount = Array.isArray(data.shops) ? data.shops.length : 0;
    const csShopCount = rootStore.customerServiceEnabledShopCount;
    log.info(`Refreshed shop lifecycle (reason=${reason}, shops=${shopCount}, csEnabled=${csShopCount})`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rootStore.markShopRefreshFailed(reason, message);
    log.warn(`Failed to refresh shop lifecycle (reason=${reason}): ${message}`);
    throw err;
  }
}
