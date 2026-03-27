import { createLogger } from "@rivonclaw/logger";
import type { AuthSessionManager } from "../auth/auth-session.js";
import type { CustomerServiceBridge, CSShopContext } from "./customer-service-bridge.js";

const log = createLogger("cs-bridge");

interface ShopData {
  id: string;
  platformShopId: string;
  shopName: string;
  services?: {
    customerService?: {
      enabled?: boolean;
      businessPrompt?: string;
      csDeviceId?: string | null;
      csModelOverride?: string | null;
    };
  };
}

interface PromptData {
  csAssemblePrompt: {
    systemPrompt: string;
    version: string;
  };
}

const SHOPS_QUERY = `query { shops { id platformShopId shopName services { customerService { enabled businessPrompt csDeviceId csModelOverride } } } }`;
const PROMPT_QUERY = `query($shopId: String!) { csAssemblePrompt(shopId: $shopId) { systemPrompt version } }`;

/**
 * Refresh a single shop's CS context (prompt + IDs).
 * Called by Panel after businessPrompt is saved or device binding changes.
 */
export async function refreshCSShopContext(
  bridge: CustomerServiceBridge,
  authSession: AuthSessionManager,
  shopId: string,
  deviceId: string,
): Promise<void> {
  try {
    const result = await authSession.graphqlFetch<{ shop: ShopData | null }>(
      `query($id: ID!) { shop(id: $id) { id platformShopId shopName services { customerService { enabled businessPrompt csDeviceId csModelOverride } } } }`,
      { id: shopId },
    );
    const shop = result.shop;
    if (!shop) {
      log.warn(`Shop ${shopId} not found during refresh`);
      bridge.removeShopContext(shopId);
      return;
    }
    if (!shop.services?.customerService?.enabled || shop.services?.customerService?.csDeviceId !== deviceId) {
      log.info(`Shop ${shop.shopName} CS disabled or not bound to this device, removing context`);
      bridge.removeShopContext(shop.platformShopId);
      return;
    }
    const promptResult = await authSession.graphqlFetch<PromptData>(PROMPT_QUERY, { shopId: shop.id });
    bridge.setShopContext({
      objectId: shop.id,
      platformShopId: shop.platformShopId,
      systemPrompt: promptResult.csAssemblePrompt.systemPrompt,
      csModelOverride: shop.services?.customerService?.csModelOverride ?? undefined,
    });
    log.info(`Refreshed CS context for shop ${shop.shopName}`);
  } catch (err) {
    log.error(`Failed to refresh CS context for shop ${shopId}:`, err);
  }
}

/**
 * Load CS shop contexts from the backend and register them with the bridge.
 * Called once on startup; also callable on shop config changes.
 * Only loads shops where csDeviceId matches the current device.
 */
export async function loadCSShopContexts(
  bridge: CustomerServiceBridge,
  authSession: AuthSessionManager,
  deviceId: string,
): Promise<void> {
  log.info("loadCSShopContexts: starting");
  // 1. Fetch all shops
  let shops: ShopData[];
  try {
    const result = await authSession.graphqlFetch<{ shops: ShopData[] }>(SHOPS_QUERY);
    shops = result.shops ?? [];
  } catch (err) {
    log.error("Failed to fetch shops for CS bridge:", err);
    return;
  }

  // 2. For each CS-enabled shop bound to this device, fetch assembled prompt and register context
  const csShops = shops.filter(s =>
    s.services?.customerService?.enabled &&
    s.services?.customerService?.csDeviceId === deviceId
  );
  log.info(`Found ${csShops.length} CS-enabled shop(s) bound to this device out of ${shops.length} total`);

  for (const shop of csShops) {
    try {
      const promptResult = await authSession.graphqlFetch<PromptData>(PROMPT_QUERY, { shopId: shop.id });
      const ctx: CSShopContext = {
        objectId: shop.id,
        platformShopId: shop.platformShopId,
        systemPrompt: promptResult.csAssemblePrompt.systemPrompt,
        csModelOverride: shop.services?.customerService?.csModelOverride ?? undefined,
      };
      bridge.setShopContext(ctx);
    } catch (err) {
      log.warn(`Failed to load prompt for shop ${shop.shopName} (${shop.id}):`, err);
    }
  }
}
