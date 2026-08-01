import { API } from "@rivonclaw/core/api-contract";
import { getFirstPartyDomainRoute } from "@rivonclaw/core";
import { createLogger } from "@rivonclaw/logger";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { parseBody, sendJson } from "../infra/api/route-utils.js";
import { rootStore } from "../app/store/desktop-store.js";
import {
  clearStoredMarketingAttribution,
  readStoredMarketingAttribution,
} from "../attribution/marketing-attribution.js";
import { CREATE_DESKTOP_TO_WEB_LOGIN_MUTATION } from "../cloud/auth-queries.js";
import { GraphqlRequestError } from "./session.js";

const log = createLogger("auth-api");

function truthyEnv(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "TRUE" || value === "yes" || value === "on";
}

function isProductionBuildOrMode(): boolean {
  if (process.env.NODE_ENV === "production" || truthyEnv(process.env.RIVONCLAW_PRODUCTION)) {
    return true;
  }
  const electronProcess = process as NodeJS.Process & { defaultApp?: boolean };
  if (process.versions.electron && electronProcess.defaultApp !== true) {
    return true;
  }
  return false;
}

function isDeterministicCaptchaMode(): boolean {
  if (isProductionBuildOrMode()) return false;
  return (
    truthyEnv(process.env.RIVONCLAW_STAGING)
    || truthyEnv(process.env.RIVONCLAW_E2E)
    || truthyEnv(process.env.RIVONCLAW_TUTORIAL)
    || truthyEnv(process.env.RIVONCLAW_DEV_AUTH_TEST)
    || process.env.NODE_ENV === "test"
    || process.env.NODE_ENV === "development"
  );
}

function getDeterministicCaptchaToken(): string | null {
  const token = process.env.STAGING_CAPTCHA_BYPASS_TOKEN;
  if (!token || !isDeterministicCaptchaMode()) return null;
  return token;
}

/** Decode the payload of a JWT without verification (already validated elsewhere). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1];
    if (!base64) return null;
    const json = Buffer.from(base64, "base64url").toString("utf-8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function runAuthChangeInBackground(ctx: ApiContext, action: string): void {
  const onAuthChange = ctx.onAuthChange;
  if (!onAuthChange) return;

  try {
    void Promise.resolve(onAuthChange(action)).catch((err: unknown) => {
      log.warn("Background auth change failed:", err);
    });
  } catch (err) {
    log.warn("Background auth change failed:", err);
  }
}

const getSession: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  const authBootstrap = (rootStore as any).authBootstrap as { status: string; error: string | null };
  if (!ctx.authSession) {
    sendJson(res, 200, {
      authenticated: false,
      bootstrapStatus: authBootstrap.status,
      error: authBootstrap.error,
    });
    return;
  }
  sendJson(res, 200, {
    authenticated: rootStore.authenticated,
    bootstrapStatus: authBootstrap.status,
    error: authBootstrap.error,
    tokenPresent: !!ctx.authSession.getAccessToken(),
  });
};

const login: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.authSession) {
    sendJson(res, 501, { error: "Auth not available" });
    return;
  }
  const body = await parseBody(req) as { email: string; password: string; captchaToken?: string; captchaAnswer?: string };
  if (!body.email || !body.password) {
    sendJson(res, 400, { error: "Missing email or password" });
    return;
  }
  try {
    await ctx.authSession.loginWithCredentials(body);
    sendJson(res, 200, { ok: true });
    runAuthChangeInBackground(ctx, "login");
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : "Login failed" });
  }
};

const register: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.authSession) {
    sendJson(res, 501, { error: "Auth not available" });
    return;
  }
  const body = await parseBody(req) as { email: string; password: string; name?: string; captchaToken?: string; captchaAnswer?: string; inviteCode?: string | null };
  if (!body.email || !body.password) {
    sendJson(res, 400, { error: "Missing email or password" });
    return;
  }
  try {
    const attribution = readStoredMarketingAttribution(ctx.storage.settings);
    await ctx.authSession.registerWithCredentials({
      ...body,
      ...(attribution ? { attribution } : {}),
    });
    clearStoredMarketingAttribution(ctx.storage.settings);
    await ctx.onAuthChange?.("register");
    sendJson(res, 200, { ok: true });
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : "Registration failed" });
  }
};

const requestCaptcha: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.authSession) {
    sendJson(res, 501, { error: "Auth not available" });
    return;
  }
  try {
    const deterministicToken = getDeterministicCaptchaToken();
    const captcha = deterministicToken
      ? await ctx.authSession.requestCaptcha({ deterministicToken })
      : await ctx.authSession.requestCaptcha();
    sendJson(res, 200, captcha);
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Captcha request failed" });
  }
};

const storeTokens: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.authSession) {
    sendJson(res, 501, { error: "Auth not available" });
    return;
  }
  const body = await parseBody(req) as { accessToken?: string; refreshToken?: string };
  if (!body.accessToken || !body.refreshToken) {
    sendJson(res, 400, { error: "Missing accessToken or refreshToken" });
    return;
  }
  await ctx.authSession.storeTokens(body.accessToken, body.refreshToken);
  // Validate the session to cache user info
  let user = await ctx.authSession.validate();
  // Fallback: extract email from JWT payload when validate() fails (e.g. network error)
  if (!user) {
    const payload = decodeJwtPayload(body.accessToken);
    if (payload && typeof payload.email === "string") {
      user = {
        userId: (payload.sub as string) ?? "",
        email: payload.email,
        name: null,
        enrolledModules: [],
        entitlementKeys: [],
        defaultRunProfileId: null,
        createdAt: new Date().toISOString(),
      };
      ctx.authSession.setCachedUser(user);
    }
  }
  await ctx.onAuthChange?.("store-tokens");
  sendJson(res, 200, { ok: true });
};

const refresh: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.authSession) {
    sendJson(res, 501, { error: "Auth not available" });
    return;
  }
  try {
    const accessToken = await ctx.authSession.refresh();
    sendJson(res, 200, { accessToken });
  } catch {
    sendJson(res, 401, { error: "Token refresh failed" });
  }
};

const logout: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.authSession) {
    sendJson(res, 501, { error: "Auth not available" });
    return;
  }
  await ctx.authSession.logout();
  rootStore.clearUser();
  await ctx.onAuthChange?.("logout");
  sendJson(res, 200, { ok: true });
};

function googleErrorCode(error: unknown): string {
  return error instanceof GraphqlRequestError && error.code
    ? error.code
    : "GOOGLE_AUTH_FAILED";
}

function isTrustedPanelOrigin(req: Parameters<EndpointHandler>[0]): boolean {
  const origin = req.headers?.origin;
  if (!origin) return true;
  try {
    const url = new URL(origin);
    return url.protocol === "http:"
      && (url.hostname === "127.0.0.1" || url.hostname === "localhost");
  } catch {
    return false;
  }
}

function rejectUntrustedGoogleRequest(
  req: Parameters<EndpointHandler>[0],
  res: Parameters<EndpointHandler>[1],
): boolean {
  if (isTrustedPanelOrigin(req)) return false;
  sendJson(res, 403, { errorCode: "GOOGLE_AUTH_UNTRUSTED_ORIGIN" });
  return true;
}

const googleConfig: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  const config = await ctx.googleAuthCoordinator?.getConfig();
  sendJson(res, 200, { enabled: config?.enabled === true });
};

const googleStart: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (rejectUntrustedGoogleRequest(req, res)) return;
  if (!ctx.googleAuthCoordinator) {
    sendJson(res, 501, { errorCode: "GOOGLE_AUTH_UNAVAILABLE" });
    return;
  }
  const body = await parseBody(req) as { inviteCode?: string | null };
  try {
    const flow = await ctx.googleAuthCoordinator.start({
      inviteCode: body.inviteCode?.trim().toUpperCase() || null,
      attribution: readStoredMarketingAttribution(ctx.storage.settings) ?? undefined,
    });
    sendJson(res, 200, flow);
  } catch (error) {
    sendJson(res, 400, { errorCode: googleErrorCode(error) });
  }
};

const googleStatus: EndpointHandler = async (_req, res, url, _params, ctx: ApiContext) => {
  const flowId = url.searchParams.get("flowId")?.trim();
  if (!flowId || !ctx.googleAuthCoordinator) {
    sendJson(res, 404, { errorCode: "GOOGLE_AUTH_FLOW_NOT_FOUND" });
    return;
  }
  const flow = ctx.googleAuthCoordinator.status(flowId);
  if (!flow) {
    sendJson(res, 404, { errorCode: "GOOGLE_AUTH_FLOW_NOT_FOUND" });
    return;
  }
  sendJson(res, 200, flow);
};

const googleLink: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (rejectUntrustedGoogleRequest(req, res)) return;
  if (!ctx.googleAuthCoordinator) {
    sendJson(res, 501, { errorCode: "GOOGLE_AUTH_UNAVAILABLE" });
    return;
  }
  const body = await parseBody(req) as {
    flowId?: string;
    password?: string;
    captchaToken?: string;
    captchaAnswer?: string;
  };
  if (!body.flowId || !body.password || !body.captchaToken || !body.captchaAnswer) {
    sendJson(res, 400, { errorCode: "GOOGLE_AUTH_LINK_INPUT_REQUIRED" });
    return;
  }
  try {
    const flow = await ctx.googleAuthCoordinator.link({
      flowId: body.flowId,
      password: body.password,
      captchaToken: body.captchaToken,
      captchaAnswer: body.captchaAnswer,
    });
    sendJson(res, 200, flow);
  } catch (error) {
    sendJson(res, 400, { errorCode: googleErrorCode(error) });
  }
};

const googleCancel: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (rejectUntrustedGoogleRequest(req, res)) return;
  const body = await parseBody(req) as { flowId?: string };
  if (!body.flowId || !ctx.googleAuthCoordinator) {
    sendJson(res, 404, { errorCode: "GOOGLE_AUTH_FLOW_NOT_FOUND" });
    return;
  }
  const flow = ctx.googleAuthCoordinator.cancel(body.flowId);
  if (!flow) {
    sendJson(res, 404, { errorCode: "GOOGLE_AUTH_FLOW_NOT_FOUND" });
    return;
  }
  sendJson(res, 200, flow);
};

const browserStart: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (!isTrustedPanelOrigin(req)) {
    sendJson(res, 403, { errorCode: "BROWSER_AUTH_UNTRUSTED_ORIGIN" });
    return;
  }
  if (!ctx.browserLoginCoordinator) {
    sendJson(res, 501, { errorCode: "BROWSER_AUTH_UNAVAILABLE" });
    return;
  }
  try {
    const body = await parseBody(req) as { intent?: unknown };
    if (body.intent !== undefined && body.intent !== "LOGIN" && body.intent !== "REGISTER") {
      sendJson(res, 400, { errorCode: "BROWSER_AUTH_INVALID_INTENT" });
      return;
    }
    sendJson(
      res,
      200,
      await ctx.browserLoginCoordinator.start({
        intent: body.intent === "REGISTER" ? "REGISTER" : "LOGIN",
      }),
    );
  } catch {
    sendJson(res, 400, { errorCode: "BROWSER_AUTH_START_FAILED" });
  }
};

const browserStatus: EndpointHandler = async (req, res, url, _params, ctx: ApiContext) => {
  if (!isTrustedPanelOrigin(req)) {
    sendJson(res, 403, { errorCode: "BROWSER_AUTH_UNTRUSTED_ORIGIN" });
    return;
  }
  const flowId = url.searchParams.get("flowId")?.trim();
  if (!flowId || !ctx.browserLoginCoordinator) {
    sendJson(res, 404, { errorCode: "BROWSER_AUTH_FLOW_NOT_FOUND" });
    return;
  }
  const flow = ctx.browserLoginCoordinator.status(flowId);
  if (!flow) {
    sendJson(res, 404, { errorCode: "BROWSER_AUTH_FLOW_NOT_FOUND" });
    return;
  }
  sendJson(res, 200, flow);
};

const browserCancel: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (!isTrustedPanelOrigin(req)) {
    sendJson(res, 403, { errorCode: "BROWSER_AUTH_UNTRUSTED_ORIGIN" });
    return;
  }
  const body = await parseBody(req) as { flowId?: string };
  if (!body.flowId || !ctx.browserLoginCoordinator) {
    sendJson(res, 404, { errorCode: "BROWSER_AUTH_FLOW_NOT_FOUND" });
    return;
  }
  const flow = ctx.browserLoginCoordinator.cancel(body.flowId);
  if (!flow) {
    sendJson(res, 404, { errorCode: "BROWSER_AUTH_FLOW_NOT_FOUND" });
    return;
  }
  sendJson(res, 200, flow);
};

function websiteHomepage(): string {
  return getFirstPartyDomainRoute() === "cn-relay"
    ? "https://www.tkjiang.cn/"
    : "https://www.tkcopilot.com/";
}

const webOpen: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (!isTrustedPanelOrigin(req)) {
    sendJson(res, 403, { errorCode: "WEB_OPEN_UNTRUSTED_ORIGIN" });
    return;
  }
  if (!ctx.openExternal) {
    sendJson(res, 501, { errorCode: "WEB_OPEN_UNAVAILABLE" });
    return;
  }

  if (!ctx.authSession?.getAccessToken()) {
    await ctx.openExternal(websiteHomepage());
    sendJson(res, 200, { authenticated: false });
    return;
  }

  try {
    const result = await ctx.authSession.graphqlFetch<{
      createDesktopToWebLogin: {
        authorizationUrl: string;
      };
    }>(
      CREATE_DESKTOP_TO_WEB_LOGIN_MUTATION,
      {
        returnPath: "/",
        surface: getFirstPartyDomainRoute() === "cn-relay" ? "CN_RELAY" : "GLOBAL",
      },
    );
    await ctx.openExternal(result.createDesktopToWebLogin.authorizationUrl);
    sendJson(res, 200, { authenticated: true });
  } catch (error) {
    log.warn("Failed to open an authenticated website session", {
      category: error instanceof Error ? error.name : "UnknownError",
    });
    try {
      await ctx.openExternal(websiteHomepage());
      sendJson(res, 200, { authenticated: false });
    } catch {
      sendJson(res, 400, { errorCode: "WEB_OPEN_FAILED" });
    }
  }
};

export function registerAuthHandlers(registry: RouteRegistry): void {
  registry.register(API["auth.session"], getSession);
  registry.register(API["auth.login"], login);
  registry.register(API["auth.register"], register);
  registry.register(API["auth.requestCaptcha"], requestCaptcha);
  registry.register(API["auth.storeTokens"], storeTokens);
  registry.register(API["auth.refresh"], refresh);
  registry.register(API["auth.logout"], logout);
  registry.register(API["auth.googleConfig"], googleConfig);
  registry.register(API["auth.googleStart"], googleStart);
  registry.register(API["auth.googleStatus"], googleStatus);
  registry.register(API["auth.googleLink"], googleLink);
  registry.register(API["auth.googleCancel"], googleCancel);
  registry.register(API["auth.browserStart"], browserStart);
  registry.register(API["auth.browserStatus"], browserStatus);
  registry.register(API["auth.browserCancel"], browserCancel);
  registry.register(API["auth.webOpen"], webOpen);
}
