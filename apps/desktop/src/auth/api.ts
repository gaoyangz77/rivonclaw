import { GQL } from "@rivonclaw/core";
import { API } from "@rivonclaw/core/api-contract";
import { createLogger } from "@rivonclaw/logger";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { parseBody, sendJson } from "../infra/api/route-utils.js";
import { rootStore } from "../app/store/desktop-store.js";

const log = createLogger("auth-api");

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

function runAuthChangeInBackground(ctx: ApiContext): void {
  const onAuthChange = ctx.onAuthChange;
  if (!onAuthChange) return;

  try {
    void Promise.resolve(onAuthChange()).catch((err: unknown) => {
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
    runAuthChangeInBackground(ctx);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : "Login failed" });
  }
};

const register: EndpointHandler = async (req, res, _url, _params, ctx: ApiContext) => {
  if (!ctx.authSession) {
    sendJson(res, 501, { error: "Auth not available" });
    return;
  }
  const body = await parseBody(req) as { email: string; password: string; name?: string; captchaToken?: string; captchaAnswer?: string };
  if (!body.email || !body.password) {
    sendJson(res, 400, { error: "Missing email or password" });
    return;
  }
  try {
    await ctx.authSession.registerWithCredentials(body);
    await ctx.onAuthChange?.();
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
    const captcha = await ctx.authSession.requestCaptcha();
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
      user = { userId: (payload.sub as string) ?? "", email: payload.email, name: null, plan: ((payload.plan as string) ?? "") as GQL.UserPlan, enrolledModules: [], entitlementKeys: [], createdAt: new Date().toISOString() };
      ctx.authSession.setCachedUser(user);
    }
  }
  await ctx.onAuthChange?.();
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
  await ctx.onAuthChange?.();
  sendJson(res, 200, { ok: true });
};

export function registerAuthHandlers(registry: RouteRegistry): void {
  registry.register(API["auth.session"], getSession);
  registry.register(API["auth.login"], login);
  registry.register(API["auth.register"], register);
  registry.register(API["auth.requestCaptcha"], requestCaptcha);
  registry.register(API["auth.storeTokens"], storeTokens);
  registry.register(API["auth.refresh"], refresh);
  registry.register(API["auth.logout"], logout);
}
