import { readExistingConfig, resolveOpenClawConfigPath } from "@rivonclaw/gateway";
import {
  getFeishuApplicationAbilityUrl,
  getFeishuApplicationConfigUrl,
  getFeishuApplicationInfoUrl,
  getFeishuApplicationPublishUrl,
  getFeishuApplicationVersionsUrl,
  getFeishuTokenUrl,
} from "@rivonclaw/core";

/**
 * Direct Feishu/Lark Open API transport for the Desktop main process.
 *
 * This module configures Feishu applications without routing card callbacks through
 * the Gateway. Errors are thrown, never swallowed; callers decide retry policy.
 */

const TOKEN_EXPIRY_SKEW_SECONDS = 60;
const DEFAULT_TOKEN_TTL_SECONDS = 7200;
const FEISHU_REQUEST_TIMEOUT_MS = 15_000;
const CALLBACK_ACTIVATION_ATTEMPTS = 8;
const CALLBACK_ACTIVATION_POLL_MS = 500;
export const FEISHU_CS_CALLBACK_PERMISSION = "application:application:patch";
const FEISHU_PERMISSION_REQUIRED_CODE = 99991672;

export interface FeishuAccountCredentials {
  appId: string;
  appSecret: string;
  domain: string;
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Resolve credentials for one Feishu account from the gateway config.
 *
 * The vendored plugin merges the channel-root config under `channels.feishu` with
 * `channels.feishu.accounts[accountId]`, account-specific winning
 * (`vendor/openclaw/extensions/feishu/src/accounts.ts`). EasyClaw additionally mirrors
 * the default account's credentials up to the channel root
 * (`mirrorFeishuDefaultAccountToChannelRoot` in `channel-manager.ts`), so the same
 * merge order is required here.
 */
export function resolveFeishuAccountCredentials(accountId: string): FeishuAccountCredentials {
  const config = readExistingConfig(resolveOpenClawConfigPath());
  const channels = (config.channels ?? {}) as Record<string, unknown>;
  const channel = (channels.feishu ?? {}) as Record<string, unknown>;
  const accounts = (channel.accounts ?? {}) as Record<string, unknown>;
  const account = (accounts[accountId] ?? {}) as Record<string, unknown>;
  const merged = { ...channel, ...account };

  const appId = readString(merged, "appId");
  const appSecret = readString(merged, "appSecret");
  if (!appId || !appSecret) {
    throw new Error(`Feishu account "${accountId}" has no appId/appSecret in the gateway config`);
  }
  return { appId, appSecret, domain: readString(merged, "domain") ?? "feishu" };
}

type CachedToken = { token: string; expiresAt: number };

const tokenCache = new Map<string, CachedToken>();

/**
 * Fetch (and cache) a tenant access token. Cached per `appId`+`domain` so multiple
 * Feishu accounts never hand each other the wrong tenant's token.
 */
export async function getFeishuTenantAccessToken(
  appId: string,
  appSecret: string,
  domain: string,
): Promise<string> {
  const cacheKey = `${domain}\u0000${appId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.token;

  const res = await fetchFeishu(
    getFeishuTokenUrl(domain),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
    "Feishu tenant token request",
  );
  const body = await readFeishuBody(res, "Feishu tenant token request");
  const token = body.tenant_access_token;
  if (typeof token !== "string" || !token) {
    throw new Error("Feishu tenant token request returned no tenant_access_token");
  }
  const ttl = typeof body.expire === "number" ? body.expire : DEFAULT_TOKEN_TTL_SECONDS;
  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + Math.max(ttl - TOKEN_EXPIRY_SKEW_SECONDS, 0) * 1000,
  });
  return token;
}

/** Drop cached tokens. Exposed for tests only. */
export function resetFeishuTokenCacheForTests(): void {
  tokenCache.clear();
}

type FeishuResponseBody = {
  code?: unknown;
  msg?: unknown;
  tenant_access_token?: unknown;
  expire?: unknown;
  data?: {
    items?: Array<{ version?: unknown }>;
    app?: {
      callback_info?: {
        callback_type?: unknown;
        request_url?: unknown;
        subscribed_callbacks?: unknown;
      };
    };
    version?: unknown;
    version_id?: unknown;
  };
};

export class FeishuApiError extends Error {
  constructor(
    message: string,
    readonly code: unknown,
    readonly apiMessage: string,
  ) {
    super(message);
    this.name = "FeishuApiError";
  }
}

export class FeishuCallbackPermissionRequiredError extends Error {
  readonly permission = FEISHU_CS_CALLBACK_PERMISSION;

  constructor(
    readonly appId: string,
    readonly domain: string,
    readonly permissionUrl: string,
    options?: ErrorOptions,
  ) {
    super(`Feishu application requires ${FEISHU_CS_CALLBACK_PERMISSION}`, options);
    this.name = "FeishuCallbackPermissionRequiredError";
  }
}

export function getFeishuCallbackPermissionUrl(params: { appId: string; domain: string }): string {
  const baseUrl =
    params.domain === "lark" ? "https://open.larksuite.com" : "https://open.feishu.cn";
  const url = new URL(`${baseUrl}/app/${encodeURIComponent(params.appId)}/auth`);
  url.searchParams.set("q", FEISHU_CS_CALLBACK_PERMISSION);
  url.searchParams.set("op_from", "openapi");
  url.searchParams.set("token_type", "tenant");
  return url.toString();
}

export function isFeishuCallbackPermissionRequiredError(
  error: unknown,
): error is FeishuCallbackPermissionRequiredError {
  return error instanceof FeishuCallbackPermissionRequiredError;
}

/**
 * Feishu answers API-level failures with HTTP 200 and a non-zero `code` in the body,
 * so the status line alone proves nothing.
 */
async function readFeishuBody(res: Response, label: string): Promise<FeishuResponseBody> {
  const raw = await res.text();
  let body: FeishuResponseBody;
  try {
    body = JSON.parse(raw) as FeishuResponseBody;
  } catch {
    if (!res.ok) {
      throw new Error(`${label} failed: HTTP ${res.status} ${raw.slice(0, 300)}`);
    }
    throw new Error(`${label} returned a non-JSON body: ${raw.slice(0, 300)}`);
  }
  if (!res.ok) {
    const apiMessage = String(body.msg ?? "");
    throw new FeishuApiError(
      `${label} failed: HTTP ${res.status} code=${String(body.code)} msg=${apiMessage}`,
      body.code,
      apiMessage,
    );
  }
  if (body.code !== 0) {
    const apiMessage = String(body.msg ?? "");
    throw new FeishuApiError(
      `${label} failed: code=${String(body.code)} msg=${apiMessage}`,
      body.code,
      apiMessage,
    );
  }
  return body;
}

/**
 * `fetch` with a hard deadline, so no caller can hang forever. An aborted request
 * surfaces as a normal `Error` rather than a bare `TimeoutError` DOMException, keeping
 * it on the same failure path as an HTTP or Feishu-code failure.
 */
async function fetchFeishu(url: string, init: RequestInit, label: string): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(FEISHU_REQUEST_TIMEOUT_MS) });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new Error(`${label} timed out after ${FEISHU_REQUEST_TIMEOUT_MS}ms`, { cause: error });
    }
    throw error;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function nextFeishuApplicationVersion(versions: unknown[]): string {
  const parsed = versions
    .filter((value): value is string => typeof value === "string")
    .map((value) => {
      const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
      return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
    })
    .filter((value): value is [number, number, number] => value !== null)
    .sort((left, right) => right[0] - left[0] || right[1] - left[1] || right[2] - left[2]);
  const latest = parsed[0];
  if (latest) return `${latest[0]}.${latest[1]}.${latest[2] + 1}`;
  return `1.0.${Math.floor(Date.now() / 1000)}`;
}

async function verifyFeishuCardCallbackActive(params: {
  appId: string;
  domain: string;
  token: string;
  callbackUrl: string;
}): Promise<void> {
  for (let attempt = 0; attempt < CALLBACK_ACTIVATION_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(CALLBACK_ACTIVATION_POLL_MS);
    const label = `Feishu card callback activation check app=${params.appId.slice(-6)}`;
    const response = await fetchFeishu(
      getFeishuApplicationInfoUrl(params.domain, params.appId),
      { headers: { Authorization: `Bearer ${params.token}` } },
      label,
    );
    const body = await readFeishuBody(response, label);
    const callback = body.data?.app?.callback_info;
    const callbacks = Array.isArray(callback?.subscribed_callbacks)
      ? callback.subscribed_callbacks
      : [];
    if (
      callback?.callback_type === "webhook" &&
      callback.request_url === params.callbackUrl &&
      callbacks.includes("card.action.trigger")
    ) {
      return;
    }
  }
  throw new Error(
    `Feishu card callback was not activated after publishing app=${params.appId.slice(-6)}`,
  );
}

/** Subscribe this application to Schema 2.0 card actions and remove the legacy callback. */
export async function configureFeishuCardActionCallback(params: {
  appId: string;
  appSecret: string;
  domain: string;
  callbackUrl: string;
}): Promise<void> {
  const token = await getFeishuTenantAccessToken(params.appId, params.appSecret, params.domain);
  try {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
    const configLabel = `Feishu card callback subscription update app=${params.appId.slice(-6)}`;
    const configResponse = await fetchFeishu(
      getFeishuApplicationConfigUrl(params.domain, params.appId),
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          callback: {
            callback_type: "webhook",
            request_url: params.callbackUrl,
            add_callbacks: ["card.action.trigger"],
          },
        }),
      },
      configLabel,
    );
    await readFeishuBody(configResponse, configLabel);

    const abilityLabel = `Feishu legacy card callback removal app=${params.appId.slice(-6)}`;
    const abilityResponse = await fetchFeishu(
      getFeishuApplicationAbilityUrl(params.domain, params.appId),
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          bot: {
            enable: true,
            message_card_callback_url: "",
          },
        }),
      },
      abilityLabel,
    );
    await readFeishuBody(abilityResponse, abilityLabel);

    const versionsLabel = `Feishu application versions request app=${params.appId.slice(-6)}`;
    const versionsResponse = await fetchFeishu(
      getFeishuApplicationVersionsUrl(params.domain, params.appId),
      { headers: { Authorization: `Bearer ${token}` } },
      versionsLabel,
    );
    const versionsBody = await readFeishuBody(versionsResponse, versionsLabel);
    const version = nextFeishuApplicationVersion(
      versionsBody.data?.items?.map((item) => item.version) ?? [],
    );

    const publishLabel = `Feishu application publish app=${params.appId.slice(-6)}`;
    const publishResponse = await fetchFeishu(
      getFeishuApplicationPublishUrl(params.domain, params.appId),
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          mobile_default_ability: "bot",
          pc_default_ability: "bot",
          remark: "Enable RivonClaw customer-service card callback",
          changelog: "Route customer-service card actions to RivonClaw backend",
          version,
        }),
      },
      publishLabel,
    );
    await readFeishuBody(publishResponse, publishLabel);
    await verifyFeishuCardCallbackActive({
      appId: params.appId,
      domain: params.domain,
      token,
      callbackUrl: params.callbackUrl,
    });
  } catch (error) {
    if (
      error instanceof FeishuApiError &&
      (error.code === FEISHU_PERMISSION_REQUIRED_CODE ||
        error.apiMessage.includes(FEISHU_CS_CALLBACK_PERMISSION))
    ) {
      throw new FeishuCallbackPermissionRequiredError(
        params.appId,
        params.domain,
        getFeishuCallbackPermissionUrl(params),
        { cause: error },
      );
    }
    throw error;
  }
}
