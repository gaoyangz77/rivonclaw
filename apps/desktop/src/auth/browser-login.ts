import { createHash, randomBytes, randomUUID } from "node:crypto";
import { hostname } from "node:os";
import {
  startLoopbackOAuthCallback,
  type LoopbackOAuthCallback,
} from "@rivonclaw/gateway";
import { getFirstPartyDomainRoute } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import {
  EXCHANGE_BROWSER_TO_DESKTOP_LOGIN_MUTATION,
  START_BROWSER_TO_DESKTOP_LOGIN_MUTATION,
} from "../cloud/auth-queries.js";
import type { AuthSessionManager } from "./session.js";

const log = createLogger("desktop-browser-login");
const CALLBACK_PATH = "/oauth/tkcopilot/callback";
const FLOW_TTL_MS = 5 * 60 * 1000;

export type DesktopBrowserLoginStatus =
  | "pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface DesktopBrowserLoginFlowView {
  flowId: string;
  status: DesktopBrowserLoginStatus;
  errorCode?: string;
}

export type DesktopBrowserAuthIntent = "LOGIN" | "REGISTER";

interface PendingFlow extends DesktopBrowserLoginFlowView {
  createdAt: number;
  callback?: LoopbackOAuthCallback;
}

export interface DesktopBrowserLoginCoordinatorOptions {
  authSession: AuthSessionManager;
  openExternal: (url: string) => Promise<unknown>;
  onSuccess?: () => void | Promise<void>;
  now?: () => number;
  deviceName?: string;
}

function publicFlow(flow: PendingFlow): DesktopBrowserLoginFlowView {
  return { flowId: flow.flowId, status: flow.status, errorCode: flow.errorCode };
}

export class DesktopBrowserLoginCoordinator {
  private activeFlow: PendingFlow | null = null;
  private readonly now: () => number;

  constructor(private readonly options: DesktopBrowserLoginCoordinatorOptions) {
    this.now = options.now ?? Date.now;
  }

  async start(
    input: { intent?: DesktopBrowserAuthIntent } = {},
  ): Promise<DesktopBrowserLoginFlowView> {
    this.cancelActive();
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(64).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const callback = await startLoopbackOAuthCallback({
      providerLabel: "TK Copilot",
      preferredPort: 53684,
      fallbackPorts: [53685],
      callbackPath: CALLBACK_PATH,
      expectedState: state,
      timeoutMs: FLOW_TTL_MS,
      allowEphemeralPort: true,
      successTitle: "TK Copilot Desktop connected",
      successBody: "You can close this window and return to the desktop app.",
    });
    const flow: PendingFlow = {
      flowId: randomUUID(),
      status: "pending",
      createdAt: this.now(),
      callback,
    };
    this.activeFlow = flow;

    try {
      const result = await this.options.authSession.graphqlFetch<{
        startBrowserToDesktopLogin: {
          authorizationUrl: string;
        };
      }>(
        START_BROWSER_TO_DESKTOP_LOGIN_MUTATION,
        {
          input: {
            redirectUri: callback.redirectUri,
            state,
            codeChallenge: challenge,
            deviceName: this.options.deviceName ?? hostname() ?? "TK Copilot Desktop",
            surface:
              getFirstPartyDomainRoute() === "cn-relay" ? "CN_RELAY" : "GLOBAL",
            intent: input.intent ?? "LOGIN",
          },
        },
        { autoRefresh: false, includeAccessToken: false },
      );
      void this.complete(flow, verifier, result.startBrowserToDesktopLogin.authorizationUrl);
      return publicFlow(flow);
    } catch (error) {
      callback.close(error instanceof Error ? error : new Error("Browser login failed"));
      flow.callback = undefined;
      flow.status = "failed";
      flow.errorCode = "BROWSER_AUTH_START_FAILED";
      throw error;
    }
  }

  status(flowId: string): DesktopBrowserLoginFlowView | null {
    const flow = this.activeFlow;
    if (!flow || flow.flowId !== flowId) return null;
    if (flow.status === "pending" && this.now() - flow.createdAt >= FLOW_TTL_MS) {
      flow.status = "expired";
      flow.errorCode = "BROWSER_AUTH_TIMEOUT";
      flow.callback?.close(new Error("Browser login expired"));
      flow.callback = undefined;
    }
    return publicFlow(flow);
  }

  cancel(flowId: string): DesktopBrowserLoginFlowView | null {
    if (!this.activeFlow || this.activeFlow.flowId !== flowId) return null;
    this.cancelActive();
    return publicFlow(this.activeFlow);
  }

  dispose(): void {
    this.cancelActive();
    this.activeFlow = null;
  }

  private async complete(flow: PendingFlow, verifier: string, authorizationUrl: string) {
    try {
      await this.options.openExternal(authorizationUrl);
      const callbackResult = await flow.callback!.waitForCallback;
      if (flow.status !== "pending") return;
      const result = await this.options.authSession.graphqlFetch<{
        exchangeBrowserToDesktopLoginCode: {
          accessToken: string;
          refreshToken: string;
          user: Parameters<AuthSessionManager["setCachedUser"]>[0];
        };
      }>(
        EXCHANGE_BROWSER_TO_DESKTOP_LOGIN_MUTATION,
        {
          input: {
            code: callbackResult.code,
            codeVerifier: verifier,
          },
        },
        { autoRefresh: false, includeAccessToken: false },
      );
      const payload = result.exchangeBrowserToDesktopLoginCode;
      await this.options.authSession.storeTokens(payload.accessToken, payload.refreshToken);
      this.options.authSession.setCachedUser(payload.user);
      flow.status = "completed";
      flow.errorCode = undefined;
      await this.options.onSuccess?.();
    } catch (error) {
      if (flow.status === "cancelled" || flow.status === "expired") return;
      flow.status = "failed";
      flow.errorCode = "BROWSER_AUTH_FAILED";
      log.warn("Browser-to-desktop login failed", {
        category: error instanceof Error ? error.name : "UnknownError",
      });
    } finally {
      flow.callback?.close();
      flow.callback = undefined;
    }
  }

  private cancelActive() {
    const flow = this.activeFlow;
    if (!flow || flow.status !== "pending") return;
    flow.status = "cancelled";
    flow.errorCode = "BROWSER_AUTH_CANCELLED";
    flow.callback?.close(new Error("Browser login cancelled"));
    flow.callback = undefined;
  }
}
