import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import { AuthSessionManager } from "../auth/session.js";
import { setAuthSession } from "../auth/session-ref.js";
import { syncCloudProviderKey } from "../providers/cloud-provider-sync.js";
import { BackendSubscriptionClient } from "../cloud/backend-subscription-client.js";
import { rootStore } from "./store/desktop-store.js";
import type { BroadcastEvent } from "./panel-server.js";
import { registerCustomerServiceCloudEvents } from "../cs-bridge/customer-service-cloud-events.js";
import { handleAffiliateConversationSignal } from "../affiliate/affiliate-conversation-signal-actuator.js";

export interface SetupAuthDeps {
  storage: Storage;
  secretStore: SecretStore;
  locale: string;
  deviceId: string;
  proxyFetch: (url: string | URL, init?: RequestInit) => Promise<Response>;
  /** Broadcast an event to every Panel SSE client (routed through the unified `/api/events` bus). */
  broadcastEvent: BroadcastEvent;
}

export interface AuthRuntime {
  authSession: AuthSessionManager;
  backendSubscription: BackendSubscriptionClient;
}

/**
 * Create the auth session manager, load from keychain, wire up the
 * backend subscription client and its event subscriptions.
 */
export async function setupAuth(deps: SetupAuthDeps): Promise<AuthRuntime> {
  const { storage, secretStore, locale, deviceId, proxyFetch, broadcastEvent } = deps;

  // Initialize auth session manager
  const authSession = new AuthSessionManager(secretStore, locale, proxyFetch);
  setAuthSession(authSession);
  authSession.onUserChanged((user) => syncCloudProviderKey(user, storage, secretStore));
  await authSession.loadFromKeychain();
  // NOTE: validate() is deferred until after proxy router starts (caller's responsibility).

  // Initialize unified backend subscription client (single shared graphql-ws connection)
  const backendSubscription = new BackendSubscriptionClient(locale);

  // Start/stop authenticated subscriptions on auth lifecycle changes. Public
  // subscriptions are allowed to remain connected while signed out.
  authSession.onUserChanged((user) => {
    if (user) {
      backendSubscription.enableAuthenticatedSubscriptions();
    } else {
      backendSubscription.disableAuthenticatedSubscriptions();
    }
  });

  // Subscribe to OAuth completion events
  backendSubscription.subscribeToOAuthComplete((payload) => {
    broadcastEvent("oauth-complete", payload);
  });

  // Subscribe to shop-updated events (server push → MST upsert → SSE → Panel auto-updates)
  backendSubscription.subscribeToShopUpdated((shopData) => {
    const shopId = (shopData as any).id as string;
    rootStore.ingestGraphQLResponse({ shopUpdated: shopData });
    const shop = rootStore.shops.find((s: any) => s.id === shopId);
    broadcastEvent("shop-updated", { shopId, shopName: shop?.shopName ?? shopId });
    backendSubscription.refreshCsConversationSignals();
  });

  const getActiveCustomerServiceShopIds = (): string[] =>
    rootStore.shops
      .filter((shop: any) => {
        const cs = shop.services?.customerService;
        return !!(cs?.enabled && cs.csDeviceId === deviceId);
      })
      .map((shop: any) => shop.id)
      .filter((shopId: unknown): shopId is string => typeof shopId === "string" && shopId.length > 0);

  registerCustomerServiceCloudEvents({
    backendSubscription,
    authSession,
    deviceId,
    getShopIds: getActiveCustomerServiceShopIds,
  });

  backendSubscription.subscribeToAffiliateConversationSignals((signal) => {
    void handleAffiliateConversationSignal(signal);
  });

  return { authSession, backendSubscription };
}
