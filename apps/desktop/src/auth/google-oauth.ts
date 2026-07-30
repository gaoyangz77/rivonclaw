import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  startLoopbackOAuthCallback,
  type LoopbackOAuthCallback,
} from "@rivonclaw/gateway";
import { createLogger } from "@rivonclaw/logger";
import type { MarketingAttribution } from "../attribution/marketing-attribution.js";
import {
  GraphqlRequestError,
  type AuthSessionManager,
  type DesktopGoogleAuthConfig,
} from "./session.js";

const log = createLogger("desktop-google-auth");

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALLBACK_PATH = "/oauth/google/callback";
const FLOW_TTL_MS = 5 * 60 * 1000;

export type DesktopGoogleAuthStatus =
  | "pending"
  | "link_required"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

export interface DesktopGoogleAuthFlowView {
  flowId: string;
  status: DesktopGoogleAuthStatus;
  errorCode?: string;
}

export interface StartDesktopGoogleAuthInput {
  inviteCode?: string | null;
  attribution?: MarketingAttribution;
}

export interface LinkDesktopGoogleAuthInput {
  flowId: string;
  password: string;
  captchaToken: string;
  captchaAnswer: string;
}

interface PendingDesktopGoogleAuthFlow extends DesktopGoogleAuthFlowView {
  createdAt: number;
  nonce: string;
  inviteCode?: string | null;
  attribution?: MarketingAttribution;
  callback?: LoopbackOAuthCallback;
  idToken?: string;
}

interface GoogleTokenResponse {
  id_token?: unknown;
}

export interface DesktopGoogleAuthCoordinatorOptions {
  authSession: AuthSessionManager;
  fetchFn: (url: string | URL, init?: RequestInit) => Promise<Response>;
  openExternal: (url: string) => Promise<unknown>;
  onSuccess?: () => void | Promise<void>;
  now?: () => number;
}

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function publicFlow(flow: PendingDesktopGoogleAuthFlow): DesktopGoogleAuthFlowView {
  return {
    flowId: flow.flowId,
    status: flow.status,
    ...(flow.errorCode ? { errorCode: flow.errorCode } : {}),
  };
}

function errorCodeFor(error: unknown): string {
  if (error instanceof GraphqlRequestError && error.code) return error.code;
  const message = error instanceof Error ? error.message : "";
  if (/timed out/i.test(message)) return "GOOGLE_AUTH_TIMEOUT";
  if (/closed|cancel/i.test(message)) return "GOOGLE_AUTH_CANCELLED";
  return "GOOGLE_AUTH_FAILED";
}

export class DesktopGoogleAuthCoordinator {
  private activeFlow: PendingDesktopGoogleAuthFlow | null = null;
  private readonly now: () => number;

  constructor(private readonly options: DesktopGoogleAuthCoordinatorOptions) {
    this.now = options.now ?? Date.now;
  }

  async getConfig(): Promise<DesktopGoogleAuthConfig> {
    try {
      const config = await this.options.authSession.getDesktopGoogleAuthConfig();
      if (!config.enabled || !config.clientId) return { enabled: false };
      return config;
    } catch {
      return { enabled: false };
    }
  }

  async start(input: StartDesktopGoogleAuthInput = {}): Promise<DesktopGoogleAuthFlowView> {
    this.cancelActive("GOOGLE_AUTH_CANCELLED");
    const config = await this.options.authSession.getDesktopGoogleAuthConfig();
    if (!config.enabled || !config.clientId) {
      throw new GraphqlRequestError(
        "Google sign-in is unavailable",
        "GOOGLE_AUTH_UNAVAILABLE",
      );
    }

    const state = base64Url(randomBytes(32));
    const nonce = base64Url(randomBytes(32));
    const verifier = base64Url(randomBytes(64));
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const callback = await startLoopbackOAuthCallback({
      providerLabel: "Google",
      preferredPort: 53682,
      fallbackPorts: [53683],
      callbackPath: GOOGLE_CALLBACK_PATH,
      expectedState: state,
      timeoutMs: FLOW_TTL_MS,
      allowEphemeralPort: true,
      successTitle: "Google sign-in complete",
      successBody: "You can close this window and return to TK Copilot.",
    });
    const flow: PendingDesktopGoogleAuthFlow = {
      flowId: randomUUID(),
      status: "pending",
      createdAt: this.now(),
      nonce,
      inviteCode: input.inviteCode,
      attribution: input.attribution,
      callback,
    };
    this.activeFlow = flow;

    const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_URL);
    authorizationUrl.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: callback.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      nonce,
      prompt: "select_account",
    }).toString();

    void this.completeBrowserFlow(
      flow,
      config.clientId,
      verifier,
      authorizationUrl.toString(),
    );
    return publicFlow(flow);
  }

  status(flowId: string): DesktopGoogleAuthFlowView | null {
    const flow = this.activeFlow;
    if (!flow || flow.flowId !== flowId) return null;
    if (
      flow.status !== "completed"
      && flow.status !== "failed"
      && flow.status !== "cancelled"
      && this.now() - flow.createdAt >= FLOW_TTL_MS
    ) {
      flow.status = "expired";
      flow.errorCode = "GOOGLE_AUTH_TIMEOUT";
      this.clearSensitive(flow);
      flow.callback?.close(new Error("Google OAuth flow expired"));
    }
    return publicFlow(flow);
  }

  async link(input: LinkDesktopGoogleAuthInput): Promise<DesktopGoogleAuthFlowView> {
    const flow = this.activeFlow;
    if (
      !flow
      || flow.flowId !== input.flowId
      || flow.status !== "link_required"
      || !flow.idToken
    ) {
      throw new GraphqlRequestError("Google sign-in flow not found", "GOOGLE_AUTH_FLOW_NOT_FOUND");
    }
    if (this.now() - flow.createdAt >= FLOW_TTL_MS) {
      flow.status = "expired";
      flow.errorCode = "GOOGLE_AUTH_TIMEOUT";
      this.clearSensitive(flow);
      return publicFlow(flow);
    }

    try {
      await this.options.authSession.loginWithGoogle({
        idToken: flow.idToken,
        nonce: flow.nonce,
        link: {
          password: input.password,
          captchaToken: input.captchaToken,
          captchaAnswer: input.captchaAnswer,
        },
      });
      flow.status = "completed";
      flow.errorCode = undefined;
      this.clearSensitive(flow);
      await this.notifySuccess();
    } catch (error) {
      flow.errorCode = errorCodeFor(error);
      if (flow.errorCode === "GOOGLE_ACCOUNT_LINK_REQUIRED") {
        flow.status = "link_required";
      }
      throw error;
    }
    return publicFlow(flow);
  }

  cancel(flowId: string): DesktopGoogleAuthFlowView | null {
    const flow = this.activeFlow;
    if (!flow || flow.flowId !== flowId) return null;
    this.cancelActive("GOOGLE_AUTH_CANCELLED");
    return publicFlow(flow);
  }

  dispose(): void {
    this.cancelActive("GOOGLE_AUTH_CANCELLED");
    this.activeFlow = null;
  }

  private async completeBrowserFlow(
    flow: PendingDesktopGoogleAuthFlow,
    clientId: string,
    verifier: string,
    authorizationUrl: string,
  ): Promise<void> {
    try {
      await this.options.openExternal(authorizationUrl);
      const callbackResult = await flow.callback!.waitForCallback;
      if (flow.status !== "pending") return;
      const tokenResponse = await this.options.fetchFn(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          code: callbackResult.code,
          code_verifier: verifier,
          grant_type: "authorization_code",
          redirect_uri: flow.callback!.redirectUri,
        }),
      });
      if (!tokenResponse.ok) throw new Error("Google OAuth token exchange failed");
      const tokenJson = await tokenResponse.json() as GoogleTokenResponse;
      if (typeof tokenJson.id_token !== "string" || tokenJson.id_token.length > 20_000) {
        throw new Error("Google OAuth token exchange did not return an ID token");
      }
      flow.idToken = tokenJson.id_token;
      try {
        await this.options.authSession.loginWithGoogle({
          idToken: flow.idToken,
          nonce: flow.nonce,
          inviteCode: flow.inviteCode,
          attribution: flow.attribution,
        });
        flow.status = "completed";
        flow.errorCode = undefined;
        this.clearSensitive(flow);
        await this.notifySuccess();
      } catch (error) {
        if (
          error instanceof GraphqlRequestError
          && error.code === "GOOGLE_ACCOUNT_LINK_REQUIRED"
        ) {
          flow.status = "link_required";
          flow.errorCode = error.code;
          return;
        }
        throw error;
      }
    } catch (error) {
      if (flow.status === "cancelled" || flow.status === "expired") return;
      flow.status = "failed";
      flow.errorCode = errorCodeFor(error);
      this.clearSensitive(flow);
      log.warn("Desktop Google sign-in failed", { category: flow.errorCode });
    } finally {
      flow.callback?.close();
      flow.callback = undefined;
    }
  }

  private cancelActive(errorCode: string): void {
    const flow = this.activeFlow;
    if (!flow || ["completed", "failed", "cancelled", "expired"].includes(flow.status)) return;
    flow.status = "cancelled";
    flow.errorCode = errorCode;
    this.clearSensitive(flow);
    flow.callback?.close(new Error("Google OAuth flow cancelled"));
    flow.callback = undefined;
  }

  private clearSensitive(flow: PendingDesktopGoogleAuthFlow): void {
    flow.idToken = undefined;
    flow.nonce = "";
    flow.inviteCode = undefined;
    flow.attribution = undefined;
  }

  private async notifySuccess(): Promise<void> {
    try {
      await this.options.onSuccess?.();
    } catch (error) {
      log.warn("Desktop Google sign-in post-success cleanup failed", {
        category: error instanceof Error ? error.name : "UnknownError",
      });
    }
  }
}
