import { createClient, type Client } from "graphql-ws/client";
import { getApiBaseUrl } from "@rivonclaw/core";
import { isNewerVersion } from "@rivonclaw/updater";
import { createLogger } from "@rivonclaw/logger";
import { proxyNetwork } from "../infra/proxy/proxy-aware-network.js";

const log = createLogger("backend-subscription");

const UPDATE_SUBSCRIPTION = `
  subscription UpdateAvailable($clientVersion: String!) {
    updateAvailable(clientVersion: $clientVersion) {
      version
      downloadUrl
    }
  }
`;

const OAUTH_COMPLETE_SUBSCRIPTION = `
  subscription OAuthComplete {
    oauthComplete {
      shopId
      shopName
      platform
    }
  }
`;

const SHOP_UPDATED_SUBSCRIPTION = `
  subscription ShopUpdated {
    shopUpdated {
      __typename
      id
      platform
      platformAppId
      platformShopId
      shopName
      authStatus
      region
      accessTokenExpiresAt
      refreshTokenExpiresAt
      services {
        customerService {
          enabled
          businessPrompt
          runProfileId
          csDeviceId
          csProviderOverride
          csModelOverride
          escalationChannelId
          escalationRecipientId
          assembledPrompt
        }
        customerServiceBilling {
          tier
          balance
          balanceExpiresAt
          periodEnd
        }
      }
    }
  }
`;

export interface UpdatePayload {
  version: string;
  downloadUrl?: string;
}

export interface OAuthCompletePayload {
  shopId: string;
  shopName: string;
  platform: string;
}

/**
 * Subscription config stored so that active subscriptions can be
 * re-established after a reconnect.
 */
interface SubscriptionConfig {
  key: string;
  subscribe: () => () => void;
}

/**
 * Unified GraphQL subscription client that manages a single shared
 * graphql-ws connection to the backend and exposes per-topic
 * subscribe methods.
 */
export class BackendSubscriptionClient {
  private client: Client | null = null;
  private getToken: (() => string | null) | null = null;

  /** Active unsubscribe functions keyed by subscription name. */
  private activeUnsubscribes = new Map<string, () => void>();

  /** Stored configs for re-subscribing after reconnect. */
  private subscriptionConfigs = new Map<string, SubscriptionConfig>();

  constructor(private readonly locale: string) {}

  connect(getToken: () => string | null): void {
    if (this.client) return;
    this.getToken = getToken;
    this.doConnect();
  }

  disconnect(): void {
    // Unsubscribe all active subscriptions
    for (const unsub of this.activeUnsubscribes.values()) {
      unsub();
    }
    this.activeUnsubscribes.clear();

    this.client?.dispose();
    this.client = null;
  }

  reconnect(): void {
    this.disconnect();
    this.doConnect();
  }

  /**
   * Subscribe to update-available events. Returns an unsubscribe function.
   */
  subscribeToUpdates(
    currentVersion: string,
    onUpdate: (payload: UpdatePayload) => void,
    onDismiss?: () => void,
  ): () => void {
    const key = "updates";

    const subscribe = (): () => void => {
      if (!this.client) return () => {};

      return this.client.subscribe<{ updateAvailable: UpdatePayload }>(
        {
          query: UPDATE_SUBSCRIPTION,
          variables: { clientVersion: currentVersion },
        },
        {
          next: (result) => {
            const payload = result.data?.updateAvailable;
            if (!payload) return;
            if (!isNewerVersion(currentVersion, payload.version)) {
              log.info(`Update dismissed: v${payload.version} is not newer than v${currentVersion}`);
              onDismiss?.();
              return;
            }
            log.info(`Update available via subscription: v${payload.version}`);
            onUpdate(payload);
          },
          error: (err) => {
            log.error("Update subscription error", { error: err instanceof Error ? err.message : JSON.stringify(err) });
          },
          complete: () => {
            log.warn("Update subscription completed by server");
          },
        },
      );
    };

    const config: SubscriptionConfig = { key, subscribe };
    this.subscriptionConfigs.set(key, config);

    const unsub = subscribe();
    this.activeUnsubscribes.set(key, unsub);

    return () => {
      this.activeUnsubscribes.get(key)?.();
      this.activeUnsubscribes.delete(key);
      this.subscriptionConfigs.delete(key);
    };
  }

  /**
   * Subscribe to OAuth-complete events. Returns an unsubscribe function.
   */
  subscribeToOAuthComplete(
    onComplete: (payload: OAuthCompletePayload) => void,
  ): () => void {
    const key = "oauth-complete";

    const subscribe = (): () => void => {
      if (!this.client) return () => {};

      return this.client.subscribe<{ oauthComplete: OAuthCompletePayload }>(
        {
          query: OAUTH_COMPLETE_SUBSCRIPTION,
        },
        {
          next: (result) => {
            const payload = result.data?.oauthComplete;
            if (!payload) return;
            log.info("OAuth complete event received via subscription", { payload });
            onComplete(payload);
          },
          error: (err) => {
            log.error("OAuth subscription error", { error: err instanceof Error ? err.message : JSON.stringify(err) });
          },
          complete: () => {
            log.warn("OAuth subscription completed by server");
          },
        },
      );
    };

    const config: SubscriptionConfig = { key, subscribe };
    this.subscriptionConfigs.set(key, config);

    const unsub = subscribe();
    this.activeUnsubscribes.set(key, unsub);

    return () => {
      this.activeUnsubscribes.get(key)?.();
      this.activeUnsubscribes.delete(key);
      this.subscriptionConfigs.delete(key);
    };
  }

  /**
   * Subscribe to shop-updated events. Returns an unsubscribe function.
   * Payload includes __typename so callers can feed it directly into ingestGraphQLResponse.
   */
  subscribeToShopUpdated(
    onShopUpdated: (data: Record<string, unknown>) => void,
  ): () => void {
    const key = "shop-updated";

    const subscribe = (): () => void => {
      if (!this.client) return () => {};

      return this.client.subscribe<{ shopUpdated: Record<string, unknown> }>(
        {
          query: SHOP_UPDATED_SUBSCRIPTION,
        },
        {
          next: (result) => {
            const payload = result.data?.shopUpdated;
            if (!payload) return;
            log.info("Shop updated event received via subscription", { shopId: payload.id });
            onShopUpdated(payload);
          },
          error: (err) => {
            log.error("Shop updated subscription error", { error: err instanceof Error ? err.message : JSON.stringify(err) });
          },
          complete: () => {
            log.warn("Shop updated subscription completed by server");
          },
        },
      );
    };

    const config: SubscriptionConfig = { key, subscribe };
    this.subscriptionConfigs.set(key, config);

    const unsub = subscribe();
    this.activeUnsubscribes.set(key, unsub);

    return () => {
      this.activeUnsubscribes.get(key)?.();
      this.activeUnsubscribes.delete(key);
      this.subscriptionConfigs.delete(key);
    };
  }

  private doConnect(): void {
    if (!this.getToken) return;

    const baseUrl = getApiBaseUrl(this.locale);
    const wsUrl = baseUrl.replace(/^http/, "ws") + "/graphql";

    this.client = createClient({
      url: wsUrl,
      webSocketImpl: proxyNetwork.createProxiedWebSocketClass() as any,
      connectionParams: () => {
        const token = this.getToken?.();
        return token ? { authorization: `Bearer ${token}` } : {};
      },
      retryAttempts: Infinity,
      retryWait: async (retries: number) => {
        const delay = Math.min(1000 * 2 ** retries, 30_000);
        await new Promise((r) => setTimeout(r, delay));
      },
      on: {
        connected: () => log.info("Backend subscription WebSocket connected"),
        closed: () => log.info("Backend subscription WebSocket closed"),
        error: (err) => log.error("Backend subscription WebSocket error", { error: err instanceof Error ? err.message : JSON.stringify(err) }),
      },
    });

    // Re-establish previously registered subscriptions (e.g. after disconnect → connect cycle)
    for (const config of this.subscriptionConfigs.values()) {
      const unsub = config.subscribe();
      this.activeUnsubscribes.set(config.key, unsub);
    }
  }
}
