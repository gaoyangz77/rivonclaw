import { createClient, type Client } from "graphql-ws/client";
import { getApiBaseUrl, type GQL } from "@rivonclaw/core";
import { isNewerVersion } from "@rivonclaw/updater";
import { createLogger } from "@rivonclaw/logger";
import { proxyNetwork } from "../infra/proxy/proxy-aware-network.js";

const log = createLogger("backend-subscription");

const NON_RETRYABLE_WS_CLOSE_CODES = new Set([
  4004, // BadResponse
  4005, // InternalClientError
  4400, // BadRequest
  4401, // Unauthorized
  4403, // Forbidden
  4406, // SubprotocolNotAcceptable
  4409, // SubscriberAlreadyExists
  4429, // TooManyInitialisationRequests
]);

const UPDATE_SUBSCRIPTION = `
  subscription UpdateAvailable($clientVersion: String!) {
    updateAvailable(clientVersion: $clientVersion) {
      version
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
      alias
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
          platformSystemPrompt
        }
        customerServiceBilling {
          tier
          balance
          balanceExpiresAt
          periodEnd
        }
        wms {
          enabled
        }
      }
    }
  }
`;

const CS_ESCALATION_EVENT_SUBSCRIPTION = `
  subscription CsEscalationEvent {
    csEscalationEvent {
      escalation {
        id
        shopId
        conversationId
        buyerUserId
        orderId
        reason
        context
        status
        version
      }
      event {
        id
        type
        status
        decision
        instructions
        createdAt
        updatedAt
      }
    }
  }
`;

const CS_CONVERSATION_SIGNAL_SUBSCRIPTION = `
  subscription CsConversationSignal($shopIds: [ID!]) {
    csConversationSignal(shopIds: $shopIds) {
      type
      source
      shopId
      platformShopId
      conversationId
      messageId
      imUserId
      buyerUserId
      orderId
      messageType
      senderRole
      operatorInstruction
      eventTime
    }
  }
`;

const AFFILIATE_CONVERSATION_SIGNAL_SUBSCRIPTION = `
  subscription AffiliateConversationSignal {
    affiliateConversationSignal {
      type
      source
      shopId
      platformShopId
      conversationId
      messageId
      messageIndex
      messageType
      creatorImId
      senderRole
      senderId
      platformApplicationId
      platformTargetCollaborationId
      platformStatus
      creatorOpenId
      productId
      orderId
      platformProgramId
      notificationId
      eventTime
    }
  }
`;

export type UpdatePayload = GQL.UpdatePayload;
export type CsConversationSignalPayload = GQL.CsConversationSignal;
export type AffiliateConversationSignalPayload = GQL.AffiliateConversationSignal;

export type CsEscalationEventType =
  | "ESCALATION_CREATED"
  | "ESCALATION_UPDATED"
  | "ESCALATION_RESOLVED";

export interface CsEscalationEventPayload {
  id: string;
  type: CsEscalationEventType;
  status: string;
  decision?: string | null;
  instructions?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CsEscalationPayload {
  id: string;
  shopId: string;
  conversationId: string;
  buyerUserId: string;
  orderId?: string | null;
  reason: string;
  context?: string | null;
  version: number;
  status: string;
}

export interface CsEscalationEventDeliveryPayload {
  escalation: CsEscalationPayload;
  event: CsEscalationEventPayload;
}

const CHECK_UPDATE_QUERY = `
  query CheckUpdate($clientVersion: String!) {
    checkUpdate(clientVersion: $clientVersion) {
      version
    }
  }
`;

/**
 * One-shot GraphQL query to check for updates (public endpoint, no auth needed).
 * Used at startup before the WebSocket subscription is established.
 *
 * Returns `null` when the backend has no update for this version.
 * Throws on network errors, non-2xx HTTP, or GraphQL-level errors.
 */
export async function queryCheckUpdate(
  locale: string,
  currentVersion: string,
  fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response> = fetch,
): Promise<UpdatePayload | null> {
  const baseUrl = getApiBaseUrl(locale);
  const res = await fetchFn(`${baseUrl}/graphql`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: CHECK_UPDATE_QUERY,
      variables: { clientVersion: currentVersion },
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Update check query failed: HTTP ${res.status}`);
  const body = (await res.json()) as {
    data?: { checkUpdate?: UpdatePayload } | null;
    errors?: Array<{ message?: string }>;
  };
  if (body.errors?.length) {
    const messages = body.errors.map((e) => e.message ?? "(no message)").join("; ");
    throw new Error(`Update check query returned GraphQL errors: ${messages}`);
  }
  return body.data?.checkUpdate ?? null;
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
  authRequired?: boolean;
}

interface ConnectOptions {
  refreshAuth?: () => Promise<void>;
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

  /** Whether authenticated subscription configs should be active. */
  private authenticatedSubscriptionsEnabled = false;

  /** Token used by the current authenticated subscription connection. */
  private authenticatedSubscriptionToken: string | null = null;

  /** Optional auth refresh hook supplied by the app auth runtime. */
  private refreshAuth: (() => Promise<void>) | null = null;

  /** Single-flight recovery for operation-level subscription auth errors. */
  private authRecoveryPromise: Promise<void> | null = null;

  private authRecoveryRetryTimer: ReturnType<typeof setTimeout> | null = null;

  private authRecoveryFailures = 0;

  /** Monotonic per-subscription attempt counters for log correlation. */
  private subscriptionAttemptCounters = new Map<string, number>();

  constructor(private readonly locale: string) {}

  isConnected(): boolean {
    return this.client !== null;
  }

  connect(getToken: () => string | null, options?: ConnectOptions): void {
    if (this.client) return;
    this.getToken = getToken;
    this.refreshAuth = options?.refreshAuth ?? null;
    this.doConnect();
  }

  disconnect(): void {
    for (const unsub of this.activeUnsubscribes.values()) {
      unsub();
    }
    this.activeUnsubscribes.clear();

    this.client?.dispose();
    this.client = null;
    if (this.authRecoveryRetryTimer) {
      clearTimeout(this.authRecoveryRetryTimer);
      this.authRecoveryRetryTimer = null;
    }
  }

  reconnect(): void {
    this.disconnect();
    this.doConnect();
  }

  enableAuthenticatedSubscriptions(): void {
    const token = this.getToken?.() ?? null;
    if (!token) {
      this.disableAuthenticatedSubscriptions();
      return;
    }

    const wasEnabled = this.authenticatedSubscriptionsEnabled;
    const tokenChanged = this.authenticatedSubscriptionToken !== token;
    this.authenticatedSubscriptionsEnabled = true;
    this.authenticatedSubscriptionToken = token;

    if (!this.client) {
      this.doConnect();
      return;
    }

    if (!wasEnabled || tokenChanged) {
      this.reconnect();
    }
  }

  disableAuthenticatedSubscriptions(): void {
    if (!this.authenticatedSubscriptionsEnabled && !this.authenticatedSubscriptionToken) {
      return;
    }

    this.authenticatedSubscriptionsEnabled = false;
    this.authenticatedSubscriptionToken = null;

    if (this.client) {
      this.reconnect();
    }
  }

  private nextAttempt(key: string): number {
    const next = (this.subscriptionAttemptCounters.get(key) ?? 0) + 1;
    this.subscriptionAttemptCounters.set(key, next);
    return next;
  }

  private formatUnknownError(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
      return {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    }

    if (typeof err === "object" && err !== null) {
      const record = err as Record<string, unknown>;
      return {
        type: err.constructor?.name ?? "object",
        message: typeof record.message === "string" ? record.message : undefined,
        code: record.code,
        reason: record.reason,
        details: JSON.stringify(record),
      };
    }

    return { value: String(err) };
  }

  private collectErrorMessages(err: unknown): string[] {
    if (!err) return [];
    if (err instanceof Error) return [err.message];
    if (Array.isArray(err)) return err.flatMap((item) => this.collectErrorMessages(item));
    if (typeof err === "object") {
      const record = err as Record<string, unknown>;
      const messages: string[] = [];
      if (typeof record.message === "string") messages.push(record.message);
      if (Array.isArray(record.errors)) messages.push(...this.collectErrorMessages(record.errors));
      if (messages.length > 0) return messages;
    }
    return [String(err)];
  }

  private isAuthError(err: unknown): boolean {
    return this.collectErrorMessages(err).some((message) =>
      /Not authenticated|Authentication required|Invalid token|Token expired/i.test(message),
    );
  }

  private handleSubscriptionError(key: string, attempt: number, label: string, err: unknown): void {
    log.warn(label, {
      subscription: key,
      attempt,
      ...this.formatUnknownError(err),
    });
    if (this.isAuthError(err)) {
      this.recoverAuthenticatedSubscriptions(key);
    }
  }

  private handleResultErrors(
    key: string,
    attempt: number,
    label: string,
    errors: Array<{ message?: string }> | undefined,
  ): void {
    if (!errors?.length) return;
    log.warn(label, {
      subscription: key,
      attempt,
      errorMessages: errors.map((err) => err.message ?? "(no message)"),
    });
    if (this.isAuthError(errors)) {
      this.recoverAuthenticatedSubscriptions(key);
    }
  }

  private recoverAuthenticatedSubscriptions(source: string): void {
    if (!this.authenticatedSubscriptionsEnabled || !this.refreshAuth) return;
    if (this.authRecoveryPromise) return;

    if (this.authRecoveryRetryTimer) {
      clearTimeout(this.authRecoveryRetryTimer);
      this.authRecoveryRetryTimer = null;
    }

    this.authRecoveryPromise = (async () => {
      try {
        log.info(`Refreshing auth after subscription auth error: ${source}`);
        await this.refreshAuth!();
        this.authRecoveryFailures = 0;

        if (!this.getToken?.()) {
          this.disableAuthenticatedSubscriptions();
          return;
        }

        // Prefer the normal lifecycle method: authSession.refresh() usually
        // emits userChanged, which may already have reconnected us. This call is
        // idempotent when that happened, and performs the reconnect when it did not.
        this.enableAuthenticatedSubscriptions();
      } catch (err) {
        this.authRecoveryFailures += 1;
        log.warn("Backend subscription auth refresh failed", {
          source,
          failureCount: this.authRecoveryFailures,
          ...this.formatUnknownError(err),
        });

        if (!this.getToken?.()) {
          this.disableAuthenticatedSubscriptions();
          return;
        }

        const delay = Math.min(1000 * 2 ** Math.min(this.authRecoveryFailures - 1, 5), 30_000);
        this.authRecoveryRetryTimer = setTimeout(() => {
          this.authRecoveryRetryTimer = null;
          this.recoverAuthenticatedSubscriptions(source);
        }, delay);
      } finally {
        this.authRecoveryPromise = null;
      }
    })();
  }

  private shouldRetryConnection(errOrCloseEvent: unknown): boolean {
    const code = typeof errOrCloseEvent === "object" && errOrCloseEvent !== null
      ? (errOrCloseEvent as { code?: unknown }).code
      : undefined;

    if (typeof code === "number" && NON_RETRYABLE_WS_CLOSE_CODES.has(code)) {
      return false;
    }

    // `ws` surfaces failed HTTP upgrades (for example a deployment-window 502)
    // as ErrorEvent objects rather than CloseEvents. graphql-ws does not retry
    // those by default, so treat them as transient unless they carry one of the
    // explicit fatal close codes above.
    return true;
  }

  private logUnexpectedResult(
    key: string,
    attempt: number,
    fieldName: string,
    result: { data?: Record<string, unknown> | null; errors?: Array<{ message?: string }>; extensions?: unknown },
  ): void {
    const dataKeys = result.data ? Object.keys(result.data) : [];
    const errorMessages = result.errors?.map((err) => err.message ?? "(no message)") ?? [];
    const extensionKeys =
      result.extensions && typeof result.extensions === "object"
        ? Object.keys(result.extensions as Record<string, unknown>)
        : [];

    log.warn("Backend subscription next payload missing expected field", {
      subscription: key,
      attempt,
      expectedField: fieldName,
      hasData: !!result.data,
      dataKeys,
      errorMessages,
      extensionKeys,
    });
  }

  private shouldSubscribe(config: SubscriptionConfig): boolean {
    return !config.authRequired || this.authenticatedSubscriptionsEnabled;
  }

  private startSubscription(config: SubscriptionConfig): void {
    if (!this.client || !this.shouldSubscribe(config)) return;
    this.activeUnsubscribes.get(config.key)?.();
    const unsub = config.subscribe();
    this.activeUnsubscribes.set(config.key, unsub);
  }

  private registerSubscription(config: SubscriptionConfig): () => void {
    this.subscriptionConfigs.set(config.key, config);
    this.startSubscription(config);

    return () => {
      this.activeUnsubscribes.get(config.key)?.();
      this.activeUnsubscribes.delete(config.key);
      this.subscriptionConfigs.delete(config.key);
    };
  }

  refreshCsConversationSignals(): void {
    const config = this.subscriptionConfigs.get("cs-conversation-signals");
    if (config) this.startSubscription(config);
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
      const attempt = this.nextAttempt(key);

      return this.client.subscribe<{ updateAvailable: UpdatePayload }>(
        {
          query: UPDATE_SUBSCRIPTION,
          variables: { clientVersion: currentVersion },
        },
        {
          next: (result) => {
            if (result.errors?.length) {
              log.warn("Update subscription next contained GraphQL errors", {
                subscription: key,
                attempt,
                errorMessages: result.errors.map((err) => err.message ?? "(no message)"),
              });
            }
            const payload = result.data?.updateAvailable;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "updateAvailable", result as any);
              return;
            }
            if (!isNewerVersion(currentVersion, payload.version)) {
              onDismiss?.();
              return;
            }
            onUpdate(payload);
          },
          error: (err) => {
            log.warn("Update subscription error", {
              subscription: key,
              attempt,
              ...this.formatUnknownError(err),
            });
          },
          complete: () => {},
        },
      );
    };

    return this.registerSubscription({ key, subscribe });
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
      const attempt = this.nextAttempt(key);

      return this.client.subscribe<{ oauthComplete: OAuthCompletePayload }>(
        {
          query: OAUTH_COMPLETE_SUBSCRIPTION,
        },
        {
          next: (result) => {
            if (result.errors?.length) {
              log.warn("OAuth subscription next contained GraphQL errors", {
                subscription: key,
                attempt,
                errorMessages: result.errors.map((err) => err.message ?? "(no message)"),
              });
            }
            const payload = result.data?.oauthComplete;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "oauthComplete", result as any);
              return;
            }
            onComplete(payload);
          },
          error: (err) => {
            log.warn("OAuth subscription error", {
              subscription: key,
              attempt,
              ...this.formatUnknownError(err),
            });
          },
          complete: () => {},
        },
      );
    };

    return this.registerSubscription({ key, subscribe });
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
      const attempt = this.nextAttempt(key);

      return this.client.subscribe<{ shopUpdated: Record<string, unknown> }>(
        {
          query: SHOP_UPDATED_SUBSCRIPTION,
        },
        {
          next: (result) => {
            this.handleResultErrors(key, attempt, "Shop updated subscription next contained GraphQL errors", result.errors);
            const payload = result.data?.shopUpdated;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "shopUpdated", result as any);
              return;
            }
            onShopUpdated(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "Shop updated subscription error", err);
          },
          complete: () => {},
        },
      );
    };

    return this.registerSubscription({ key, subscribe, authRequired: true });
  }

  /**
   * Subscribe to CS escalation side-effect events.
   *
   * The backend only streams newly-published events. Airflow/admin publish
   * mutations handle missed-event replay, and callers claim + ack each event
   * before/after executing the local side effect.
   */
  subscribeToCsEscalationEvents(
    onEvent: (delivery: CsEscalationEventDeliveryPayload) => void,
  ): () => void {
    const key = "cs-escalation-events";

    const subscribe = (): () => void => {
      if (!this.client) return () => {};
      const attempt = this.nextAttempt(key);

      return this.client.subscribe<{ csEscalationEvent: CsEscalationEventDeliveryPayload }>(
        {
          query: CS_ESCALATION_EVENT_SUBSCRIPTION,
        },
        {
          next: (result) => {
            this.handleResultErrors(key, attempt, "CS escalation subscription next contained GraphQL errors", result.errors);
            const payload = result.data?.csEscalationEvent;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "csEscalationEvent", result as any);
              return;
            }
            onEvent(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "CS escalation subscription error", err);
          },
          complete: () => {},
        },
      );
    };

    return this.registerSubscription({ key, subscribe, authRequired: true });
  }

  subscribeToCsConversationSignals(
    onSignal: (signal: CsConversationSignalPayload) => void,
    options?: { getShopIds?: () => string[] },
  ): () => void {
    const key = "cs-conversation-signals";

    const subscribe = (): () => void => {
      if (!this.client) return () => {};
      const attempt = this.nextAttempt(key);
      const shopIds = Array.from(new Set(options?.getShopIds?.() ?? []))
        .filter((shopId) => typeof shopId === "string" && shopId.length > 0);

      return this.client.subscribe<{ csConversationSignal: CsConversationSignalPayload }>(
        {
          query: CS_CONVERSATION_SIGNAL_SUBSCRIPTION,
          variables: { shopIds },
        },
        {
          next: (result) => {
            this.handleResultErrors(key, attempt, "CS conversation signal subscription next contained GraphQL errors", result.errors);
            const payload = result.data?.csConversationSignal;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "csConversationSignal", result as any);
              return;
            }
            onSignal(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "CS conversation signal subscription error", err);
          },
          complete: () => {},
        },
      );
    };

    return this.registerSubscription({ key, subscribe, authRequired: true });
  }

  subscribeToAffiliateConversationSignals(
    onSignal: (signal: AffiliateConversationSignalPayload) => void,
  ): () => void {
    const key = "affiliate-conversation-signals";

    const subscribe = (): () => void => {
      if (!this.client) return () => {};
      const attempt = this.nextAttempt(key);

      return this.client.subscribe<{ affiliateConversationSignal: AffiliateConversationSignalPayload }>(
        { query: AFFILIATE_CONVERSATION_SIGNAL_SUBSCRIPTION },
        {
          next: (result) => {
            this.handleResultErrors(key, attempt, "Affiliate conversation signal subscription next contained GraphQL errors", result.errors);
            const payload = result.data?.affiliateConversationSignal;
            if (!payload) {
              this.logUnexpectedResult(key, attempt, "affiliateConversationSignal", result as any);
              return;
            }
            onSignal(payload);
          },
          error: (err) => {
            this.handleSubscriptionError(key, attempt, "Affiliate conversation signal subscription error", err);
          },
          complete: () => {},
        },
      );
    };

    return this.registerSubscription({ key, subscribe, authRequired: true });
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
      shouldRetry: (errOrCloseEvent) => this.shouldRetryConnection(errOrCloseEvent),
      on: {
        connected: (_socket, _payload, retrying) => {
          log.info(`Backend subscription WebSocket connected${retrying ? " after retry" : ""}`);
        },
        closed: (event) => {
          log.info("Backend subscription WebSocket closed", this.formatUnknownError(event));
        },
        error: (err) => log.warn("Backend subscription WebSocket error (will auto-retry)", this.formatUnknownError(err)),
      },
    });

    // Establish previously registered subscriptions (e.g. after disconnect → connect cycle)
    for (const config of this.subscriptionConfigs.values()) {
      this.startSubscription(config);
    }
  }
}
