import type { Storage } from "@rivonclaw/storage";
import type { SecretStore } from "@rivonclaw/secrets";
import { createLogger } from "@rivonclaw/logger";
import { AuthSessionManager } from "../auth/session.js";
import { setAuthSession } from "../auth/session-ref.js";
import { syncCloudProviderKey } from "../providers/cloud-provider-sync.js";
import { BackendSubscriptionClient } from "../cloud/backend-subscription-client.js";
import { rootStore, getSnapshot } from "./store/desktop-store.js";
import type { pushChatSSE as PushChatSSEFn } from "./panel-server.js";

const log = createLogger("auth-runtime");

export interface SetupAuthDeps {
  storage: Storage;
  secretStore: SecretStore;
  locale: string;
  proxyFetch: (url: string | URL, init?: RequestInit) => Promise<Response>;
  pushChatSSE: typeof PushChatSSEFn;
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
  const { storage, secretStore, locale, proxyFetch, pushChatSSE } = deps;

  // Initialize auth session manager
  const authSession = new AuthSessionManager(secretStore, locale, proxyFetch);
  setAuthSession(authSession);
  authSession.onUserChanged((user) => syncCloudProviderKey(user, storage, secretStore));
  await authSession.loadFromKeychain();
  // NOTE: validate() is deferred until after proxy router starts (caller's responsibility).

  // Initialize unified backend subscription client (single shared graphql-ws connection)
  const backendSubscription = new BackendSubscriptionClient(locale);

  // Connect/disconnect with auth lifecycle
  authSession.onUserChanged((user) => {
    if (user) {
      backendSubscription.connect(() => authSession.getAccessToken());
    } else {
      backendSubscription.disconnect();
    }
  });

  // Initial connect if already authenticated
  backendSubscription.connect(() => authSession.getAccessToken());

  // Subscribe to OAuth completion events
  backendSubscription.subscribeToOAuthComplete((payload) => {
    log.info("OAuth complete notification received, forwarding to Panel", { payload });
    pushChatSSE("oauth-complete", payload);
  });

  // Subscribe to shop-updated events (server push → MST upsert → SSE → Panel auto-updates)
  backendSubscription.subscribeToShopUpdated((shopData) => {
    const shopId = (shopData as any).id as string;
    const existing = rootStore.shops.find((s: any) => s.id === shopId);
    const before = existing ? JSON.stringify(getSnapshot(existing)) : null;

    rootStore.ingestGraphQLResponse({ shopUpdated: shopData });

    const updated = rootStore.shops.find((s: any) => s.id === shopId);
    const after = updated ? JSON.stringify(getSnapshot(updated)) : null;

    if (before !== after) {
      pushChatSSE("shop-updated", { shopId, shopName: updated?.shopName ?? shopId });
    }
  });

  return { authSession, backendSubscription };
}
