import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createLogger } from "@rivonclaw/logger";
import { decodeJwtPayload, type ProviderKeyEntry } from "@rivonclaw/core";
import type { OAuthFlowCallbacks, OAuthFlowResult } from "./oauth-flow.js";
import { startLoopbackOAuthCallback } from "./loopback-oauth.js";

const log = createLogger("gateway:openai-codex-oauth");

const CODEX_CALLBACK_PATH = "/auth/callback";
const CODEX_PREFERRED_CALLBACK_PORT = 1455;
const CODEX_FALLBACK_CALLBACK_PORT = 1457;
const CODEX_LOCAL_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
// OpenAI registers this Codex client against literal localhost callback ports.
// Do not change it to 127.0.0.1 or an arbitrary dynamic port; Hydra rejects the authorize request.
function codexRedirectUriForPort(port: number): string {
  return `http://localhost:${port}${CODEX_CALLBACK_PATH}`;
}
const OPENAI_AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
const OPENAI_TOKEN_URL = "https://auth.openai.com/oauth/token";
// Copied from pi-ai's openai-codex OAuth module. If OpenAI rotates this client
// id, the authorization-code and refresh-token exchanges will start returning
// invalid_client; the fix is to re-sync this constant from `@mariozechner/pi-ai`.
const OPENAI_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const OPENAI_CODEX_SCOPE = "openid profile email offline_access";
const OPENAI_AUTH_CLAIM_PATH = "https://api.openai.com/auth";

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

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function buildCodexAuthUrl(params: {
  challenge: string;
  state: string;
  redirectUri: string;
  originator?: string;
}): string {
  const url = new URL(OPENAI_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", OPENAI_CLIENT_ID);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("scope", OPENAI_CODEX_SCOPE);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", params.state);
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  url.searchParams.set("originator", params.originator ?? "openclaw");
  return url.toString();
}

function parseAuthorizationInput(input: string): { code?: string; state?: string } {
  const value = input.trim();
  if (!value) return {};
  try {
    const url = new URL(value);
    return {
      code: url.searchParams.get("code") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
    };
  } catch {
    // Not a URL; fall through to code-only formats.
  }
  if (value.includes("#")) {
    const [code, state] = value.split("#", 2);
    return { code, state };
  }
  if (value.includes("code=")) {
    const params = new URLSearchParams(value);
    return {
      code: params.get("code") ?? undefined,
      state: params.get("state") ?? undefined,
    };
  }
  return { code: value };
}

async function exchangeCodexAuthorizationCode(params: {
  code: string;
  verifier: string;
  redirectUri: string;
  proxyUrl?: string;
}): Promise<OpenAICodexOAuthCredentials> {
  let dispatcher: any;
  if (params.proxyUrl) {
    const { ProxyAgent } = await import("undici");
    dispatcher = new ProxyAgent(params.proxyUrl);
  }

  const res = await fetch(OPENAI_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: OPENAI_CLIENT_ID,
      code: params.code,
      code_verifier: params.verifier,
      redirect_uri: params.redirectUri,
    }),
    ...(dispatcher && { dispatcher }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI Codex token exchange failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };
  if (
    typeof body.access_token !== "string" ||
    typeof body.refresh_token !== "string" ||
    typeof body.expires_in !== "number"
  ) {
    throw new Error("OpenAI Codex token response missing required fields");
  }
  const payload = decodeJwtPayload(body.access_token);
  const auth = payload?.[OPENAI_AUTH_CLAIM_PATH];
  const accountId =
    auth && typeof auth === "object"
      ? (auth as Record<string, unknown>).chatgpt_account_id
      : undefined;
  if (typeof accountId !== "string" || !accountId) {
    throw new Error("Failed to extract accountId from OpenAI Codex token");
  }
  return {
    access: body.access_token,
    refresh: body.refresh_token,
    expires: Date.now() + body.expires_in * 1000,
    accountId,
  };
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

  const flow = await startHybridCodexOAuthFlow(callbacks, vendorDir);
  return await flow.completionPromise;
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
  /** Cancel the local callback server and pending completion promise. */
  cancel: () => void;
}

export async function startHybridCodexOAuthFlow(
  callbacks: OAuthFlowCallbacks,
  _vendorDir?: string,
): Promise<HybridCodexOAuthFlow> {
  log.info("Starting hybrid OpenAI Codex OAuth flow");

  const { verifier, challenge } = generatePkce();
  const state = randomBytes(16).toString("hex");
  let callbackServer: Awaited<ReturnType<typeof startLoopbackOAuthCallback>> | undefined;
  try {
    callbackServer = await startLoopbackOAuthCallback({
      providerLabel: "OpenAI Codex",
      preferredPort: CODEX_PREFERRED_CALLBACK_PORT,
      fallbackPorts: [CODEX_FALLBACK_CALLBACK_PORT],
      callbackPath: CODEX_CALLBACK_PATH,
      expectedState: state,
      timeoutMs: CODEX_LOCAL_CALLBACK_TIMEOUT_MS,
      allowEphemeralPort: false,
      onProgress: (message) => log.info(message),
      successTitle: "Authentication Complete",
      successBody: "You can close this window.",
      staleTitle: "OAuth Error",
      staleBody: "State mismatch. Return to the app and retry sign-in.",
    });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code !== "EADDRINUSE" && code !== "EACCES") {
      throw err;
    }
    log.warn(
      `Codex callback port ${CODEX_PREFERRED_CALLBACK_PORT} unavailable (${code}); ` +
        "continuing with manual callback URL paste",
    );
  }
  const authUrl = buildCodexAuthUrl({
    challenge,
    state,
    redirectUri: codexRedirectUriForPort(callbackServer?.port ?? CODEX_PREFERRED_CALLBACK_PORT),
  });
  const redirectUri = codexRedirectUriForPort(callbackServer?.port ?? CODEX_PREFERRED_CALLBACK_PORT);

  // Deferred for manual code input (resolved externally when user pastes callback URL)
  let resolveManualInput: (url: string) => void;
  let rejectManualInput: (err: Error) => void;
  const manualInputPromise = new Promise<string>((resolve, reject) => {
    resolveManualInput = resolve;
    rejectManualInput = reject;
  });

  callbacks.onStatusUpdate?.(
    callbackServer
      ? callbackServer.usedPreferredPort
        ? "Complete sign-in in browser..."
        : `Callback port ${CODEX_PREFERRED_CALLBACK_PORT} is busy; using ${CODEX_FALLBACK_CALLBACK_PORT} instead.`
      : `Callback ports ${CODEX_PREFERRED_CALLBACK_PORT} and ${CODEX_FALLBACK_CALLBACK_PORT} are busy. Complete sign-in in browser, then paste the callback URL manually.`,
  );
  try {
    await callbacks.openUrl(authUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Codex OAuth browser open failed; returning auth URL for manual opening: ${msg}`);
    callbacks.onStatusUpdate?.("Open the authorization URL manually to continue sign-in.");
  }

  const exchange = async (code: string) =>
    exchangeCodexAuthorizationCode({
      code,
      verifier,
      redirectUri,
      proxyUrl: callbacks.proxyUrl,
    });

  const autoCompletion = callbackServer
    ? callbackServer.waitForCallback.then(async ({ code }) => {
        log.info(`Codex OAuth callback received on ${callbackServer.redirectUri}`);
        return exchange(code);
      })
    : new Promise<OpenAICodexOAuthCredentials>(() => {});
  const manualCompletion = manualInputPromise.then(async (input) => {
    const parsed = parseAuthorizationInput(input);
    if (parsed.state && parsed.state !== state) {
      throw new Error("State mismatch");
    }
    if (!parsed.code) {
      throw new Error("Missing authorization code");
    }
    return exchange(parsed.code);
  });
  autoCompletion.catch(() => {});
  manualCompletion.catch(() => {});

  let completed = false;
  const completionPromise = Promise.race([autoCompletion, manualCompletion]).then((creds) => {
    completed = true;
    log.info(`Codex hybrid OAuth complete, accountId=${creds.accountId}`);
    return {
      credentials: creds,
      email: undefined,
      tokenPreview: maskToken(creds.access ?? ""),
    } as AcquiredCodexOAuthCredentials;
  }).finally(() => callbackServer?.close());

  return {
    authUrl,
    resolveManualInput: resolveManualInput!,
    rejectManualInput: rejectManualInput!,
    completionPromise,
    cancel: () => {
      if (!completed) {
        rejectManualInput!(new Error("Flow cancelled"));
      }
      callbackServer?.close(new Error("Flow cancelled"));
    },
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

const TOKEN_REFRESH_TIMEOUT_MS = 8000;

/**
 * Exchange a refresh token for a fresh token bundle.
 *
 * IMPORTANT: this call rotates the refresh_token on OpenAI's side — the
 * returned `refresh_token` is v2; the caller's original refresh_token is now
 * invalid. Caller must persist the rotated creds atomically with the expiry.
 *
 * Returns `undefined` on any error so the caller can fall through to storing
 * pi-ai's original credentials (best effort — token expiry may not show,
 * OAuth main flow still works unless OpenAI finished the rotation before our
 * response read failed, in which case the user's next LLM turn will 401 and
 * they'll need to Re-authenticate).
 */
/**
 * Discriminated capture result.
 *
 *   `success` — token endpoint returned a usable bundle. OAuth state is
 *     consistent (the rotated v2 tokens ARE the stored state).
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
    }
  | { kind: "failed" };

async function captureIdTokenViaRefresh(
  refreshToken: string,
  fetchFn: typeof fetch,
): Promise<IdTokenCaptureResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOKEN_REFRESH_TIMEOUT_MS);
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
        `Codex token refresh: token endpoint returned ${res.status} ${res.statusText}: ${body.slice(0, 200)}`,
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
      log.warn("Codex token refresh: response missing required fields");
      return { kind: "failed" };
    }
    return {
      kind: "success",
      access: body.access_token,
      refresh: body.refresh_token,
      expiresMs: Date.now() + body.expires_in * 1000,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.warn(`Codex token refresh failed: ${msg}`);
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
 * Extract the expiry of a JWT token itself from its standard `exp` claim.
 * OpenAI Codex refresh tokens may be opaque; when they are not parseable JWTs,
 * return undefined and let the UI report the credential expiry as unknown.
 */
export function extractJwtExpiresAtMs(token: string): number | undefined {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp) || exp <= 0) {
    return undefined;
  }
  return exp * 1000;
}

/**
 * Write OAuth credentials for an existing Codex key — overwrite the keychain
 * credential JSON in place. Does NOT touch the provider_keys row's
 * label/model/isDefault/proxy; only the stored credential is rotated.
 *
 * Side effect: calls OpenAI's token endpoint once with the refresh_token.
 * OpenAI rotates the refresh_token on that call, so the persisted credentials
 * are v2 (not pi-ai's original v1). If the exchange fails, we fall back to
 * pi-ai's original credentials.
 *
 * Returns the refresh-token expiry timestamp (ms since epoch) so the caller can
 * persist it on the row as `oauth_expires_at`.
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

  const oauthExpiresAt = extractJwtExpiresAtMs(effectiveCreds.refresh);
  const idTokenCaptureFailed = captured.kind === "failed";
  log.info(
    `Wrote Codex OAuth credentials for key ${keyId}` +
      (oauthExpiresAt
        ? `, refresh token expires at ${new Date(oauthExpiresAt).toISOString()}`
        : idTokenCaptureFailed
          ? " (refresh exchange failed — v1 creds persisted; may 401 if OpenAI rotated mid-flight)"
          : " (refresh token expiry unavailable)"),
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
    /** Proxy-aware fetch used for the token refresh step. Defaults to the
     * global `fetch` — callers in Desktop should pass `proxyNetwork.fetch` so
     * blocked-region users reach `auth.openai.com`. */
    fetchFn?: typeof fetch;
  },
): Promise<OAuthFlowResult> {
  const provider = "openai-codex";
  const model = options?.model || "gpt-5.5";
  const id = randomUUID();

  // Store credential JSON in Keychain + derive refresh-token expiry.
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
