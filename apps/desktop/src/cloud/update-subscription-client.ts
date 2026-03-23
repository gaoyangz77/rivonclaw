import { createClient, type Client } from "graphql-ws/client";
import WebSocket from "ws";
import { getApiBaseUrl } from "@rivonclaw/core";
import { isNewerVersion } from "@rivonclaw/updater";
import { createLogger } from "@rivonclaw/logger";

const log = createLogger("update-subscription");

const UPDATE_SUBSCRIPTION = `
  subscription UpdateAvailable($clientVersion: String!) {
    updateAvailable(clientVersion: $clientVersion) {
      version
      downloadUrl
    }
  }
`;

export interface UpdatePayload {
  version: string;
  downloadUrl?: string;
}

export class UpdateSubscriptionClient {
  private client: Client | null = null;
  private unsubscribe: (() => void) | null = null;
  private getToken: (() => string | null) | null = null;

  constructor(
    private readonly locale: string,
    private readonly currentVersion: string,
    private readonly onUpdate: (payload: UpdatePayload) => void,
    private readonly onDismiss?: () => void,
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
        connected: () => log.info("Update subscription WebSocket connected"),
        closed: () => log.info("Update subscription WebSocket closed"),
        error: (err) => log.error("Update subscription WebSocket error", { error: String(err) }),
      },
    });

    this.subscribe();
  }

  private subscribe(): void {
    if (!this.client) return;

    this.unsubscribe = this.client.subscribe<{ updateAvailable: UpdatePayload }>(
      {
        query: UPDATE_SUBSCRIPTION,
        variables: { clientVersion: this.currentVersion },
      },
      {
        next: (result) => {
          const payload = result.data?.updateAvailable;
          if (!payload) return;
          if (!isNewerVersion(this.currentVersion, payload.version)) {
            log.info(`Update dismissed: v${payload.version} is not newer than v${this.currentVersion}`);
            this.onDismiss?.();
            return;
          }
          log.info(`Update available via subscription: v${payload.version}`);
          this.onUpdate(payload);
        },
        error: (err) => {
          log.error("Update subscription error", { error: String(err) });
        },
        complete: () => {
          log.info("Update subscription completed");
        },
      },
    );
  }
}
