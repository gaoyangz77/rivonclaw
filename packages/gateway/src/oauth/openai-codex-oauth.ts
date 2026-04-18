import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createLogger } from "@rivonclaw/logger";
import { decodeJwtPayload, type ProviderKeyEntry } from "@rivonclaw/core";
import type { OAuthFlowCallbacks, OAuthFlowResult } from "./oauth-flow.js";
import { resolveVendorDir } from "../vendor/vendor.js";

const log = createLogger("gateway:openai-codex-oauth");

export interface OpenAICodexOAuthCredentials {
  access: string;
  refresh: string;
  expires: number;
  accountId: string;
}

export interface AcquiredCodexOAuthCredentials {
  credentials: OpenAICodexOAuthCredentials;
  email?: string;
  tokenPreview: string;
}

/**
 * Mask a token for display: show first 10 chars + "••••••••".
 */
function maskToken(token: string): string {
  if (token.length <= 10) return "••••••••••••";
  return token.slice(0, 10) + "••••••••";
}

/** loginOpenAICodex function signature from pi-ai. */
type LoginFn = (options: {
  onAuth: (info: { url: string; instructions: string }) => void;
  onProgress?: (msg: string) => void;
  onPrompt?: (opts: { message: string }) => Promise<string>;
  onManualCodeInput?: () => Promise<string>;
  originator?: string;
}) => Promise<OpenAICodexOAuthCredentials>;

/**
 * Resolve and load loginOpenAICodex from the extracted vendor helper.
 * Falls back to the upstream pi-ai subpath in dev if the extracted file
 * has not been generated yet.
 */
async function loadLoginOpenAICodex(vendorDir?: string): Promise<LoginFn> {
  const vendor = resolveVendorDir(vendorDir);
  const extractedHelperPath = join(vendor, "dist", "vendor-codex-oauth.js");
  const fallbackHelperPath = join(
    vendor,
    "node_modules",
    "@mariozechner",
    "pi-ai",
    "dist",
    "utils",
    "oauth",
    "openai-codex.js",
  );
  const helperPath = existsSync(extractedHelperPath) ? extractedHelperPath : fallbackHelperPath;

  try {
    const mod = (await import(pathToFileURL(helperPath).href)) as { loginOpenAICodex?: LoginFn };
    if (typeof mod.loginOpenAICodex !== "function") {
      throw new Error("loginOpenAICodex not exported from helper");
    }
    return mod.loginOpenAICodex;
  } catch (err) {
    throw new Error(
      `OpenAI Codex OAuth helper is unavailable in vendor/openclaw. ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Step 1: Acquire OAuth tokens from OpenAI Codex (opens browser).
 * Does NOT create provider key or store in keychain.
 * Returns raw credentials for the caller to hold temporarily.
 */
export async function acquireCodexOAuthToken(
  callbacks: OAuthFlowCallbacks,
  vendorDir?: string,
): Promise<AcquiredCodexOAuthCredentials> {
  log.info("Starting OpenAI Codex OAuth flow (acquire only)");

  const loginOpenAICodex = await loadLoginOpenAICodex(vendorDir);

  const creds = await loginOpenAICodex({
    onAuth: (info) => {
      log.info("OpenAI Codex OAuth: opening browser for auth");
      callbacks.openUrl(info.url);
      callbacks.onStatusUpdate?.(info.instructions || "Complete sign-in in browser…");
    },
    onProgress: (msg) => {
      log.info(`OAuth: ${msg}`);
      callbacks.onStatusUpdate?.(msg);
    },
  });

  log.info(`OpenAI Codex OAuth acquire complete, accountId=${creds.accountId}`);

  return {
    credentials: creds,
    email: undefined, // Codex OAuth doesn't return email
    tokenPreview: maskToken(creds.access ?? ""),
  };
}

export interface HybridCodexOAuthFlow {
  /** Auth URL for the user to open in any browser. */
  authUrl: string;
  /** Resolve the manual input promise with the callback URL the user pasted. */
  resolveManualInput: (callbackUrl: string) => void;
  /** Reject the manual input promise (e.g. flow cancelled). */
  rejectManualInput: (err: Error) => void;
  /** Resolves with acquired credentials when either auto or manual flow completes. */
  completionPromise: Promise<AcquiredCodexOAuthCredentials>;
}

export async function startHybridCodexOAuthFlow(
  callbacks: OAuthFlowCallbacks,
  vendorDir?: string,
): Promise<HybridCodexOAuthFlow> {
  log.info("Starting hybrid OpenAI Codex OAuth flow");

  const loginOpenAICodex = await loadLoginOpenAICodex(vendorDir);

  // Deferred for the auth URL (resolved by onAuth callback)
  let resolveAuthUrl: (url: string) => void;
  let rejectAuthUrl: (err: Error) => void;
  const authUrlPromise = new Promise<string>((resolve, reject) => {
    resolveAuthUrl = resolve;
    rejectAuthUrl = reject;
  });

  // Deferred for manual code input (resolved externally when user pastes callback URL)
  let resolveManualInput: (url: string) => void;
  let rejectManualInput: (err: Error) => void;
  const manualInputPromise = new Promise<string>((resolve, reject) => {
    resolveManualInput = resolve;
    rejectManualInput = reject;
  });

  // Start the vendor OAuth flow in the background
  const completionPromise = loginOpenAICodex({
    onAuth: (info) => {
      log.info("Codex hybrid OAuth: auth URL received");
      callbacks.openUrl(info.url);
      callbacks.onStatusUpdate?.(info.instructions || "Complete sign-in in browser…");
      resolveAuthUrl!(info.url);
    },
    onProgress: (msg) => {
      log.info(`OAuth: ${msg}`);
      callbacks.onStatusUpdate?.(msg);
    },
    onPrompt: async () => {
      // Fallback prompt — should not be reached in hybrid mode since onManualCodeInput is provided
      log.warn("Codex OAuth: onPrompt called unexpectedly in hybrid mode");
      return manualInputPromise;
    },
    onManualCodeInput: () => manualInputPromise,
  }).then((creds) => {
    log.info(`Codex hybrid OAuth complete, accountId=${creds.accountId}`);
    return {
      credentials: creds,
      email: undefined,
      tokenPreview: maskToken(creds.access ?? ""),
    } as AcquiredCodexOAuthCredentials;
  });

  // If the vendor flow fails before calling onAuth, reject the auth URL promise
  completionPromise.catch((err) => {
    rejectAuthUrl!(err instanceof Error ? err : new Error(String(err)));
  });

  // Wait for the auth URL to be available before returning
  let authUrl: string;
  try {
    authUrl = await authUrlPromise;
  } catch (err) {
    throw err instanceof Error ? err : new Error(`Failed to start Codex OAuth: ${err}`);
  }

  return {
    authUrl,
    resolveManualInput: resolveManualInput!,
    rejectManualInput: rejectManualInput!,
    completionPromise,
  };
}

/**
 * Step 2: Validate an OpenAI Codex access token.
 * Makes a lightweight request to OpenAI to verify the token is valid.
 */
export async function validateCodexAccessToken(
  accessToken: string,
  proxyUrl?: string,
): Promise<{ valid: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let dispatcher: any;
  if (proxyUrl) {
    const { ProxyAgent } = await import("undici");
    dispatcher = new ProxyAgent(proxyUrl);
    log.info(`Validating Codex OAuth token through proxy: ${proxyUrl}`);
  }

  try {
    // Use the OpenAI models endpoint as a lightweight validation check
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
      ...(dispatcher && { dispatcher }),
    });

    log.info(`Codex OAuth token validation response: ${res.status} ${res.statusText}`);

    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid or expired OAuth token" };
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { valid: false, error: `OpenAI API returned ${res.status}: ${body.slice(0, 200)}` };
    }
    return { valid: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error("Codex OAuth validation failed:", msg);
    if (msg.includes("abort")) {
      return { valid: false, error: "Validation timed out — check your network connection" };
    }
    return { valid: false, error: `Network error: ${msg}` };
  } finally {
    clearTimeout(timeout);
  }
}

const OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token";
// Copied from pi-ai's openai-codex OAuth module. If pi-ai rotates this client
// id, we'll start getting "invalid_client" on the id_token capture — the fix
// is to re-sync this constant from `@mariozechner/pi-ai` dist.
const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";

const ID_TOKEN_CAPTURE_TIMEOUT_MS = 8000;

/**
 * Exchange a refresh token for a fresh token bundle that includes `id_token`.
 *
 * Why this exists: pi-ai's `loginOpenAICodex` / refresh helpers discard the
 * `id_token` from OpenAI's token response. The id_token is the only place
 * the `chatgpt_subscription_active_until` claim appears (not in access_token;
 * refresh_token is opaque). Without it the Providers UI has no signal to
 * display "subscription expires on ...".
 *
 * IMPORTANT: this call rotates the refresh_token on OpenAI's side — the
 * returned `refresh_token` is v2; the caller's original refresh_token is now
 * invalid. Caller must persist the rotated creds atomically with the expiry.
 *
 * Returns `undefined` on any error so the caller can fall through to storing
 * pi-ai's original credentials (best effort — subscription expiry won't show,
 * OAuth main flow still works unless OpenAI finished the rotation before our
 * response read failed, in which case the user's next LLM turn will 401 and
 * they'll need to Re-authenticate).
 */
/**
 * Discriminated capture result.
 *
 *   `success` — token endpoint returned a usable bundle. Subscription expiry
 *     may still be undefined if the id_token was absent / unparseable, but
 *     OAuth state is consistent (the rotated v2 tokens ARE the stored state).
 *   `failed` — the extra call failed network-/HTTP-wise. We persist pi-ai's
 *     original v1 creds. There is a **narrow race window** here: if OpenAI
 *     server-side rotated to v2 before our response read failed, v1 is now
 *     invalid on their side. The caller propagates this flag to the UI so
 *     the user is warned rather than silently hitting 401 on the next LLM
 *     turn.
 */
type IdTokenCaptureResult =
  | {
      kind: "success";
      access: string;
      refresh: string;
      expiresMs: number;
      subscriptionActiveUntilMs: number | undefined;
    }
  | { kind: "failed" };

async function captureIdTokenViaRefresh(
  refreshToken: string,
  fetchFn: typeof fetch,
): Promise<IdTokenCaptureResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ID_TOKEN_CAPTURE_TIMEOUT_MS);
  try {
    // Routed through the caller-supplied fetch — `auth.openai.com` is blocked
    // in several regions and must go via proxy-router / system proxy.
    const res = await fetchFn(OPENAI_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: OPENAI_CLIENT_ID,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      log.warn(
        `Codex id_token capture: token endpoint returned ${res.status} ${res.statusText}: ${body.slice(0, 200)}`,
      );
      return { kind: "failed" };
    }
    const body = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      expires_in?: number;
    };
    if (
      typeof body.access_token !== "string" ||
      typeof body.refresh_token !== "string" ||
      typeof body.expires_in !== "number"
    ) {
      log.warn("Codex id_token capture: response missing required fields");
      return { kind: "failed" };
    }
    const subscriptionActiveUntilMs = body.id_token
      ? extractCodexSubscriptionActiveUntilMs(body.id_token)
      : undefined;
    return {
      kind: "success",
      access: body.access_token,
      refresh: body.refresh_token,
      expiresMs: Date.now() + body.expires_in * 1000,
      subscriptionActiveUntilMs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Codex id_token capture failed: ${msg}`);
    return { kind: "failed" };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extract `chatgpt_subscription_active_until` from a Codex id_token JWT and
 * return it as ms since epoch. The claim is an ISO-8601 string in OpenAI's
 * `https://api.openai.com/auth` namespace (e.g. "2026-05-15T21:39:45+00:00").
 */
export function extractCodexSubscriptionActiveUntilMs(idToken: string): number | undefined {
  const payload = decodeJwtPayload(idToken);
  if (!payload) return undefined;
  const authInfo = payload["https://api.openai.com/auth"];
  if (!authInfo || typeof authInfo !== "object") return undefined;
  const until = (authInfo as Record<string, unknown>).chatgpt_subscription_active_until;
  if (typeof until !== "string") return undefined;
  const ms = Date.parse(until);
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * Write OAuth credentials for an existing Codex key — overwrite the keychain
 * credential JSON in place. Does NOT touch the provider_keys row's
 * label/model/isDefault/proxy; only the stored credential is rotated.
 *
 * Side effect: attempts to capture the id_token by calling OpenAI's token
 * endpoint once with the refresh_token. OpenAI rotates the refresh_token on
 * that call, so the persisted credentials are v2 (not pi-ai's original v1).
 * If the capture fails, we fall back to pi-ai's original credentials and the
 * caller won't see a subscription expiry in the UI.
 *
 * Returns the subscription-active-until timestamp (ms since epoch) so the
 * caller can persist it on the row as `oauth_expires_at`.
 *
 * Used by both:
 *   - `saveCodexOAuthCredentials` (fresh key creation) — for the credential write step
 *   - Desktop's `onOAuthReauth` — to rotate credentials on the existing key
 */
export async function refreshCodexOAuthCredentials(
  keyId: string,
  credentials: OpenAICodexOAuthCredentials,
  secretStore: {
    set(key: string, value: string): Promise<void>;
  },
  fetchFn: typeof fetch,
): Promise<{ oauthExpiresAt: number | undefined; idTokenCaptureFailed: boolean }> {
  const captured = await captureIdTokenViaRefresh(credentials.refresh, fetchFn);
  const effectiveCreds: OpenAICodexOAuthCredentials =
    captured.kind === "success"
      ? {
          access: captured.access,
          refresh: captured.refresh,
          expires: captured.expiresMs,
          accountId: credentials.accountId,
        }
      : credentials;
  await secretStore.set(`oauth-cred-${keyId}`, JSON.stringify(effectiveCreds));

  const oauthExpiresAt =
    captured.kind === "success" ? captured.subscriptionActiveUntilMs : undefined;
  const idTokenCaptureFailed = captured.kind === "failed";
  log.info(
    `Wrote Codex OAuth credentials for key ${keyId}` +
      (oauthExpiresAt
        ? `, subscription active until ${new Date(oauthExpiresAt).toISOString()}`
        : idTokenCaptureFailed
          ? " (id_token capture failed — v1 creds persisted; may 401 if OpenAI rotated mid-flight)"
          : " (subscription expiry unavailable)"),
  );
  return { oauthExpiresAt, idTokenCaptureFailed };
}

/**
 * Step 3: Store OAuth credentials in keychain and create provider_keys row.
 * Call after validation succeeds.
 */
export async function saveCodexOAuthCredentials(
  credentials: OpenAICodexOAuthCredentials,
  storage: {
    providerKeys: {
      create(entry: ProviderKeyEntry): ProviderKeyEntry;
      getByProvider(provider: string): ProviderKeyEntry[];
      setDefault(id: string): void;
    };
  },
  secretStore: {
    set(key: string, value: string): Promise<void>;
  },
  options?: {
    proxyBaseUrl?: string | null;
    proxyCredentials?: string | null;
    label?: string;
    model?: string;
    /** Proxy-aware fetch used for the id_token capture step. Defaults to the
     * global `fetch` — callers in Desktop should pass `proxyNetwork.fetch` so
     * blocked-region users reach `auth.openai.com`. */
    fetchFn?: typeof fetch;
  },
): Promise<OAuthFlowResult> {
  const provider = "openai-codex";
  const model = options?.model || "gpt-5.2-codex";
  const id = randomUUID();

  // Store credential JSON in Keychain + derive refresh-token expiry
  const { oauthExpiresAt } = await refreshCodexOAuthCredentials(
    id,
    credentials,
    secretStore,
    options?.fetchFn ?? fetch,
  );

  // Store proxy credentials if provided
  if (options?.proxyCredentials) {
    await secretStore.set(`proxy-auth-${id}`, options.proxyCredentials);
  }

  // Create provider_keys row
  const label = options?.label || "OpenAI Codex OAuth";
  const entry = storage.providerKeys.create({
    id,
    provider,
    label,
    model,
    isDefault: false,
    authType: "oauth",
    proxyBaseUrl: options?.proxyBaseUrl ?? null,
    oauthExpiresAt,
    createdAt: "",
    updatedAt: "",
  });

  // Set as default for this provider
  storage.providerKeys.setDefault(entry.id);

  log.info(`Created OAuth provider key ${id} for ${provider}`);

  return {
    providerKeyId: id,
    email: undefined,
    provider,
  };
}
