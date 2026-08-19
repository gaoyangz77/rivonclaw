import { readExistingConfig, resolveOpenClawConfigPath } from "@rivonclaw/gateway";
import {
  getFeishuMessagePatchUrl,
  getFeishuMessageUrl,
  getFeishuTokenUrl,
  type FeishuReceiveIdType,
} from "@rivonclaw/core";

/**
 * Direct Feishu/Lark Open API transport for the Desktop main process.
 *
 * The gateway process serves `message.action` for the same operations, but its event
 * loop can stall for tens of seconds on busy machines. Calls that must land promptly
 * (card write-backs for interactive callbacks) go out from Desktop over plain HTTP
 * instead. Errors are thrown, never swallowed — callers decide what is best-effort.
 */

const CHAT_ID_PREFIX = "oc_";
const OPEN_ID_PREFIX = "ou_";
const TOKEN_EXPIRY_SKEW_SECONDS = 60;
const DEFAULT_TOKEN_TTL_SECONDS = 7200;
/**
 * Every call here must settle. `CsEscalationResponseProcessor` releases its per-card
 * `inflight` key in a `finally`, so a request that never settles never releases it, and
 * every later submission on that card is dropped as a duplicate while its submit button
 * stays frozen. Feishu calls from these hosts have been observed taking ~100s, so the
 * bound is not hypothetical. Generous against a measured ~75ms round trip.
 */
const FEISHU_REQUEST_TIMEOUT_MS = 15_000;

export interface FeishuAccountCredentials {
  appId: string;
  appSecret: string;
  domain: string;
}

/**
 * Mirror of the vendored plugin's `resolveReceiveIdType` prefix rule
 * (`vendor/openclaw/extensions/feishu/src/targets.ts`). Callback payloads carry raw
 * Feishu ids, so only the prefix branch applies here — the `chat:` / `user:` / `dm:`
 * textual prefixes are a gateway-side input convention.
 */
export function resolveFeishuReceiveIdType(receiveId: string): FeishuReceiveIdType {
  const trimmed = receiveId.trim();
  if (trimmed.startsWith(CHAT_ID_PREFIX)) return "chat_id";
  if (trimmed.startsWith(OPEN_ID_PREFIX)) return "open_id";
  return "user_id";
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
};

/**
 * Feishu answers API-level failures with HTTP 200 and a non-zero `code` in the body,
 * so the status line alone proves nothing.
 */
async function readFeishuBody(res: Response, label: string): Promise<FeishuResponseBody> {
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`${label} failed: HTTP ${res.status} ${raw.slice(0, 300)}`);
  }
  let body: FeishuResponseBody;
  try {
    body = JSON.parse(raw) as FeishuResponseBody;
  } catch {
    throw new Error(`${label} returned a non-JSON body: ${raw.slice(0, 300)}`);
  }
  if (body.code !== 0) {
    throw new Error(`${label} failed: code=${String(body.code)} msg=${String(body.msg ?? "")}`);
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

async function authHeaders(accountId: string): Promise<{
  domain: string;
  headers: Record<string, string>;
}> {
  const { appId, appSecret, domain } = resolveFeishuAccountCredentials(accountId);
  const token = await getFeishuTenantAccessToken(appId, appSecret, domain);
  return {
    domain,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
  };
}

/**
 * Update an interactive card this app previously sent.
 *
 * `PATCH /open-apis/im/v1/messages/{message_id}` with `{ content: JSON.stringify(card) }`.
 * The card must declare `config.update_multi: true`. Note this is PATCH, not the PUT
 * method on the same path — PUT only supports text and post messages.
 */
export async function patchFeishuCardMessage(params: {
  accountId: string;
  messageId: string;
  card: Record<string, unknown>;
}): Promise<void> {
  const { domain, headers } = await authHeaders(params.accountId);
  const res = await fetchFeishu(
    getFeishuMessagePatchUrl(domain, params.messageId),
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ content: JSON.stringify(params.card) }),
    },
    `Feishu card update message=${params.messageId}`,
  );
  await readFeishuBody(res, `Feishu card update message=${params.messageId}`);
}

/** Send a plain-text message. `receive_id_type` is derived from the id's prefix. */
export async function sendFeishuTextMessage(params: {
  accountId: string;
  receiveId: string;
  text: string;
}): Promise<void> {
  const { domain, headers } = await authHeaders(params.accountId);
  const res = await fetchFeishu(
    getFeishuMessageUrl(domain, resolveFeishuReceiveIdType(params.receiveId)),
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        receive_id: params.receiveId,
        msg_type: "text",
        content: JSON.stringify({ text: params.text }),
      }),
    },
    `Feishu text send to=${params.receiveId}`,
  );
  await readFeishuBody(res, `Feishu text send to=${params.receiveId}`);
}
