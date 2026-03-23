import { createClient, type Client } from "graphql-ws/client";
import WebSocket from "ws";
import { getApiBaseUrl } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("oauth-subscription");

const OAUTH_COMPLETE_SUBSCRIPTION = `
  subscription OAuthComplete {
    oauthComplete {
      shopId
      shopName
      platform
    }
  }
`;

export interface OAuthCompletePayload {
  shopId: string;
  shopName: string;
  platform: string;
}

export class OAuthSubscriptionClient {
  private client: Client | null = null;
  private unsubscribe: (() => void) | null = null;
  private getToken: (() => string | null) | null = null;

  constructor(
    private readonly locale: string,
    private readonly onOAuthComplete: (payload: OAuthCompletePayload) => void,
  ) {}

  connect(getToken: () => string | null): void {
    this.getToken = getToken;
    this.doConnect();
  }

  disconnect(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.client?.dispose();
    this.client = null;
  }

  reconnect(): void {
    this.disconnect();
    this.doConnect();
  }

  private doConnect(): void {
    if (!this.getToken) return;

    const baseUrl = getApiBaseUrl(this.locale);
    const wsUrl = baseUrl.replace(/^http/, "ws") + "/graphql";

    this.client = createClient({
      url: wsUrl,
      webSocketImpl: WebSocket as any,
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
        connected: () => log.info("OAuth subscription WebSocket connected"),
        closed: () => log.info("OAuth subscription WebSocket closed"),
        error: (err) => log.error("OAuth subscription WebSocket error", { error: String(err) }),
      },
    });

    this.subscribe();
  }

  private subscribe(): void {
    if (!this.client) return;

    this.unsubscribe = this.client.subscribe<{ oauthComplete: OAuthCompletePayload }>(
      {
        query: OAUTH_COMPLETE_SUBSCRIPTION,
      },
      {
        next: (result) => {
          const payload = result.data?.oauthComplete;
          if (!payload) return;
          log.info("OAuth complete event received via subscription", { payload });
          this.onOAuthComplete(payload);
        },
        error: (err) => {
          log.error("OAuth subscription error", { error: String(err) });
        },
        complete: () => {
          log.info("OAuth subscription completed");
        },
      },
    );
  }
}
