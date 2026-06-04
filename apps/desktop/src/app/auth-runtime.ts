import type { SecretStore } from "@rivonclaw/secrets";
import { createLogger } from "@rivonclaw/logger";
import { AuthSessionManager } from "../auth/session.js";
import { setAuthSession } from "../auth/session-ref.js";
import { CloudClient } from "../cloud/cloud-client.js";
import { BackendSubscriptionClient } from "../cloud/backend-subscription-client.js";
import { rootStore } from "./store/desktop-store.js";
import type { BroadcastEvent } from "./panel-server.js";
import { registerCustomerServiceCloudEvents } from "../cs-bridge/customer-service-cloud-events.js";
import { handleAffiliateWorkItemChanged } from "../affiliate/affiliate-work-item-actuator.js";
import { uploadCurrentLog } from "../logs/upload-current-log.js";

const log = createLogger("auth-runtime");

export interface SetupAuthDeps {
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
  const { secretStore, locale, deviceId, proxyFetch, broadcastEvent } = deps;

  // Initialize auth session manager
  const authSession = new AuthSessionManager(secretStore, locale, proxyFetch);
  setAuthSession(authSession);
  await authSession.loadFromKeychain();
  // NOTE: validate() is deferred until after proxy router starts (caller's responsibility).
  const cloudClient = new CloudClient(authSession, locale, proxyFetch);

  // Initialize unified backend subscription client (single shared graphql-ws connection)
  const backendSubscription = new BackendSubscriptionClient(locale);
  const inFlightLogUploadRequests = new Set<string>();

  // Subscribe to OAuth completion events
  backendSubscription.subscribeToOAuthComplete((payload) => {
    if (payload.shops?.length) {
      rootStore.ingestGraphQLResponse({ shops: payload.shops });
    }
    broadcastEvent("oauth-complete", payload);
  });

  // Subscribe to shop-updated events (server push → MST upsert → SSE → Panel auto-updates)
  backendSubscription.subscribeToShopUpdated((shopData) => {
    const shopId = (shopData as any).id as string;
    rootStore.ingestGraphQLResponse({ shopUpdated: shopData });
    const shop = rootStore.findShopByObjectOrPlatformId(shopId, null);
    broadcastEvent("shop-updated", { shopId, shopName: shop?.shopName ?? shopId });
  });

  backendSubscription.subscribeToClientLogUploadRequests(deviceId, (request) => {
    if (inFlightLogUploadRequests.has(request.requestId)) return;
    inFlightLogUploadRequests.add(request.requestId);

    void uploadCurrentLog(cloudClient, { deviceId, requestId: request.requestId })
      .then((response) => {
        log.info("Uploaded client log after server-side request", {
          requestId: request.requestId,
          requestedAt: request.requestedAt,
          response,
        });
      })
      .catch((err) => {
        log.error("Failed to upload client log after server-side request", {
          requestId: request.requestId,
          requestedAt: request.requestedAt,
          reason: request.reason,
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      })
      .finally(() => {
        inFlightLogUploadRequests.delete(request.requestId);
      });
  });

  const getActiveCustomerServiceShopIds = (): string[] =>
    rootStore.getCustomerServiceShopIdsForDevice(deviceId);

  registerCustomerServiceCloudEvents({
    backendSubscription,
    authSession,
    deviceId,
    getShopIds: getActiveCustomerServiceShopIds,
    onEscalationEvent: (delivery) => {
      broadcastEvent("cs-escalation-event", { delivery });
    },
    onConversationChanged: (conversation) => {
      broadcastEvent("cs-conversation-changed", { conversation });
    },
  });

  backendSubscription.subscribeToAffiliateWorkItemChanges((workItem) => {
    broadcastEvent("affiliate-work-item-changed", { workItem });
    void handleAffiliateWorkItemChanged(deviceId, workItem);
  });

  backendSubscription.subscribeToAffiliateActionProposalChanges((proposal) => {
    broadcastEvent("affiliate-action-proposal-changed", { proposal });
  });

  return { authSession, backendSubscription };
}
