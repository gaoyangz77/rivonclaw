/**
 * Gemini CLI OAuth module — copied from vendor/openclaw/extensions/google-gemini-cli-auth/oauth.ts
 *
 * Desktop keeps a few integration differences: shared loopback callback handling,
 * dynamic callback redirect URIs, and personal OAuth post-token handling.
 * `isWSL2Sync()` is replaced with a hardcoded `false` because the desktop
 * Electron app is never WSL2/remote.
 *
 * When updating the vendor submodule, diff this file against the original.
 */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, realpathSync, mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { execFile, execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { resolveRivonClawHome } from "@rivonclaw/core/node";
import { enrichedPath, findInPath } from "../utils/cli-utils.js";
import { startLoopbackOAuthCallback } from "./loopback-oauth.js";

/** Error that carries a user-friendly message plus technical detail for hover tooltip. */
export class DetailedError extends Error {
  detail: string;
  constructor(message: string, detail: string) {
    super(message);
    this.name = "DetailedError";
    this.detail = detail;
  }
}

const CLIENT_ID_KEYS = ["OPENCLAW_GEMINI_OAUTH_CLIENT_ID", "GEMINI_CLI_OAUTH_CLIENT_ID"];
const CLIENT_SECRET_KEYS = [
  "OPENCLAW_GEMINI_OAUTH_CLIENT_SECRET",
  "GEMINI_CLI_OAUTH_CLIENT_SECRET",
];
// Use 127.0.0.1 (not "localhost") to avoid IPv6 resolution issues.
// On some systems "localhost" resolves to ::1 first, causing EADDRINUSE
// when another process occupies the IPv6 loopback.  Google OAuth desktop
// clients accept any loopback IP on any port.
const REDIRECT_URI = "http://127.0.0.1:8085/oauth2callback";
const CALLBACK_PATH = "/oauth2callback";
const PREFERRED_CALLBACK_PORT = 8085;
const LOCAL_CALLBACK_TIMEOUT_MS = 5 * 60 * 1000;
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v1/userinfo?alt=json";
const CODE_ASSIST_ENDPOINT = "https://cloudcode-pa.googleapis.com";
const SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

const TIER_FREE = "free-tier";
const TIER_LEGACY = "legacy-tier";
const TIER_STANDARD = "standard-tier";

export type GeminiCliOAuthCredentials = {
  access: string;
  refresh: string;
  expires: number;
  email?: string;
  projectId?: string;
};

export type GeminiCliOAuthContext = {
  isRemote: boolean;
  openUrl: (url: string) => Promise<void>;
  log: (msg: string) => void;
  note: (message: string, title?: string) => Promise<void>;
  prompt: (message: string) => Promise<string>;
  progress: { update: (msg: string) => void; stop: (msg?: string) => void };
  /** Local proxy router URL (e.g. "http://127.0.0.1:{port}") for routing through system proxy. */
  proxyUrl?: string;
};

/**
 * Fetch through local proxy router (which handles system proxy + per-key proxy).
 * Falls back to plain fetch when no proxy URL is configured.
 */
async function proxiedFetch(
  url: string | URL,
  init?: RequestInit,
  proxyUrl?: string,
): Promise<Response> {
  if (!proxyUrl) return fetch(url, init);
  const { ProxyAgent } = await import("undici");
  return fetch(url, { ...init, dispatcher: new ProxyAgent(proxyUrl) as any });
}

function resolveEnv(keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return undefined;
}

type GeminiCliAuthSettings = {
  security?: {
    auth?: {
      selectedType?: unknown;
      enforcedType?: unknown;
    };
  };
  selectedAuthType?: unknown;
  enforcedAuthType?: unknown;
};

type GeminiCliSettingsFs = {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: "utf8") => string;
  homedir: () => string;
};

const defaultGeminiCliSettingsFs: GeminiCliSettingsFs = {
  existsSync: (path) => existsSync(path),
  readFileSync: (path, encoding) => readFileSync(path, encoding),
  homedir,
};

let geminiCliSettingsFs = defaultGeminiCliSettingsFs;

/** @internal */
export function setGeminiCliSettingsFsForTest(overrides?: Partial<GeminiCliSettingsFs>): void {
  geminiCliSettingsFs = overrides
    ? { ...defaultGeminiCliSettingsFs, ...overrides }
    : defaultGeminiCliSettingsFs;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function readGeminiCliSettings(): GeminiCliAuthSettings | null {
  const settingsPath = join(geminiCliSettingsFs.homedir(), ".gemini", "settings.json");
  if (!geminiCliSettingsFs.existsSync(settingsPath)) {
    return null;
  }
  try {
    const parsed = JSON.parse(geminiCliSettingsFs.readFileSync(settingsPath, "utf8")) as unknown;
    return isRecord(parsed) ? (parsed as GeminiCliAuthSettings) : null;
  } catch {
    return null;
  }
}

export function resolveGeminiCliSelectedAuthType(): string | undefined {
  const settings = readGeminiCliSettings();
  if (settings) {
    const security = isRecord(settings.security) ? settings.security : undefined;
    const auth = isRecord(security?.auth) ? security.auth : undefined;
    const selectedAuthType =
      normalizeOptionalString(auth?.selectedType) ??
      normalizeOptionalString(auth?.enforcedType) ??
      normalizeOptionalString(settings.selectedAuthType) ??
      normalizeOptionalString(settings.enforcedAuthType);
    if (selectedAuthType) {
      return selectedAuthType;
    }
  }

  if (process.env.GOOGLE_GENAI_USE_GCA === "true") {
    return "oauth-personal";
  }

  return undefined;
}

export function shouldUseGeminiPersonalOAuth(): boolean {
  const selectedAuthType = resolveGeminiCliSelectedAuthType();
  if (selectedAuthType) {
    return selectedAuthType === "oauth-personal";
  }
  return !resolveEnv(["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_PROJECT_ID"]);
}

let cachedGeminiCliCredentials: { clientId: string; clientSecret: string } | null = null;

/** @internal */
export function clearCredentialsCache(): void {
  cachedGeminiCliCredentials = null;
}

/** Extracts OAuth credentials from the installed Gemini CLI's bundled oauth2.js. */
export function extractGeminiCliCredentials(): { clientId: string; clientSecret: string } | null {
  if (cachedGeminiCliCredentials) {
    return cachedGeminiCliCredentials;
  }

  try {
    const geminiPath = findInPath("gemini");
    if (!geminiPath) {
      return null;
    }

    const resolvedPath = realpathSync(geminiPath);
    const geminiCliDir = dirname(dirname(resolvedPath));

    const searchPaths = [
      join(
        geminiCliDir,
        "node_modules",
        "@google",
        "gemini-cli-core",
        "dist",
        "src",
        "code_assist",
        "oauth2.js",
      ),
      join(
        geminiCliDir,
        "node_modules",
        "@google",
        "gemini-cli-core",
        "dist",
        "code_assist",
        "oauth2.js",
      ),
    ];

    let content: string | null = null;
    for (const p of searchPaths) {
      if (existsSync(p)) {
        content = readFileSync(p, "utf8");
        break;
      }
    }
    if (!content) {
      const found = findFile(geminiCliDir, "oauth2.js", 10);
      if (found) {
        content = readFileSync(found, "utf8");
      }
    }
    if (!content) {
      return null;
    }

    const idMatch = content.match(/(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)/);
    const secretMatch = content.match(/(GOCSPX-[A-Za-z0-9_-]+)/);
    if (idMatch && secretMatch) {
      cachedGeminiCliCredentials = { clientId: idMatch[1], clientSecret: secretMatch[1] };
      return cachedGeminiCliCredentials;
    }
  } catch {
    // Gemini CLI not installed or extraction failed
  }
  return null;
}

function findFile(dir: string, name: string, depth: number): string | null {
  if (depth <= 0) {
    return null;
  }
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isFile() && e.name === name) {
        return p;
      }
      if (e.isDirectory() && !e.name.startsWith(".")) {
        const found = findFile(p, name, depth - 1);
        if (found) {
          return found;
        }
      }
    }
  } catch {}
  return null;
}

/** Default directory for RivonClaw-managed Gemini CLI install. */
const LOCAL_GEMINI_DIR = join(resolveRivonClawHome(), "gemini-cli");

/**
 * Extract OAuth credentials from the RivonClaw-managed local Gemini CLI install.
 */
function extractFromLocalInstall(): { clientId: string; clientSecret: string } | null {
  const coreDir = join(LOCAL_GEMINI_DIR, "node_modules", "@google", "gemini-cli-core");
  if (!existsSync(coreDir)) return null;

  const searchPaths = [
    join(coreDir, "dist", "src", "code_assist", "oauth2.js"),
    join(coreDir, "dist", "code_assist", "oauth2.js"),
  ];

  let content: string | null = null;
  for (const p of searchPaths) {
    if (existsSync(p)) {
      content = readFileSync(p, "utf8");
      break;
    }
  }
  if (!content) {
    const found = findFile(coreDir, "oauth2.js", 10);
    if (found) content = readFileSync(found, "utf8");
  }
  if (!content) return null;

  const idMatch = content.match(/(\d+-[a-z0-9]+\.apps\.googleusercontent\.com)/);
  const secretMatch = content.match(/(GOCSPX-[A-Za-z0-9_-]+)/);
  if (idMatch && secretMatch) {
    return { clientId: idMatch[1], clientSecret: secretMatch[1] };
  }
  return null;
}

/**
 * Install Gemini CLI to ~/.rivonclaw/gemini-cli/ using npm.
 * Returns true on success, false on failure.
 */
async function installViaNpm(
  onProgress?: (msg: string) => void,
): Promise<boolean> {
  const npmBin = findInPath("npm");
  if (!npmBin) {
    return false;
  }

  onProgress?.("Installing Gemini CLI via npm...");

  return new Promise<boolean>((resolve) => {
    // On Windows, npm is a .cmd file that requires shell execution.
    const useShell = process.platform === "win32";
    const child = execFile(
      npmBin,
      ["install", "--prefix", LOCAL_GEMINI_DIR, "@google/gemini-cli"],
      { timeout: 120_000, shell: useShell, env: { ...process.env, NODE_ENV: "", PATH: enrichedPath() } },
      (err) => {
        if (err) {
          onProgress?.(`npm install failed: ${err.message}`);
          resolve(false);
        } else {
          cachedGeminiCliCredentials = null;
          onProgress?.("Gemini CLI installed successfully");
          resolve(true);
        }
      },
    );
    child.stderr?.on("data", () => {
      // Suppress npm stderr noise
    });
  });
}

/**
 * Download @google/gemini-cli-core directly from npm registry (no npm needed).
 * Only extracts the package to LOCAL_GEMINI_DIR so extractFromLocalInstall() can
 * find the OAuth credentials in oauth2.js.
 */
async function installViaDirectDownload(
  onProgress?: (msg: string) => void,
  proxyUrl?: string,
): Promise<boolean> {
  try {
    onProgress?.("Downloading Gemini CLI from npm registry...");

    // 1. Get package metadata to find tarball URL
    const metaRes = await proxiedFetch("https://registry.npmjs.org/@google/gemini-cli-core/latest", undefined, proxyUrl);
    if (!metaRes.ok) {
      onProgress?.(`Failed to fetch package metadata: ${metaRes.status}`);
      return false;
    }
    const meta = (await metaRes.json()) as { dist?: { tarball?: string } };
    const tarballUrl = meta.dist?.tarball;
    if (!tarballUrl) {
      onProgress?.("No tarball URL in package metadata");
      return false;
    }

    // 2. Download tarball
    onProgress?.("Downloading gemini-cli-core...");
    const tarRes = await proxiedFetch(tarballUrl, undefined, proxyUrl);
    if (!tarRes.ok) {
      onProgress?.(`Failed to download tarball: ${tarRes.status}`);
      return false;
    }
    const buffer = Buffer.from(await tarRes.arrayBuffer());

    // 3. Extract using tar (available on all macOS/Linux systems)
    const targetDir = join(LOCAL_GEMINI_DIR, "node_modules", "@google", "gemini-cli-core");
    mkdirSync(targetDir, { recursive: true });

    const tmpFile = join(LOCAL_GEMINI_DIR, "_tmp_gemini-cli-core.tgz");
    writeFileSync(tmpFile, buffer);

    try {
      // npm tarballs contain a "package/" prefix — strip it
      execFileSync("tar", ["xzf", tmpFile, "-C", targetDir, "--strip-components=1"], {
        timeout: 30_000,
      });
    } finally {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
    }

    cachedGeminiCliCredentials = null;
    onProgress?.("Gemini CLI core downloaded successfully");
    return true;
  } catch (err) {
    onProgress?.(`Direct download failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

/**
 * Install Gemini CLI credentials to ~/.rivonclaw/gemini-cli/.
 * Tries npm first, falls back to direct tarball download from npm registry.
 */
export async function installGeminiCliLocal(
  onProgress?: (msg: string) => void,
  proxyUrl?: string,
): Promise<boolean> {
  mkdirSync(LOCAL_GEMINI_DIR, { recursive: true });

  // Try npm first (installs full package with all dependencies)
  if (findInPath("npm")) {
    try {
      const ok = await installViaNpm(onProgress);
      if (ok) return true;
    } catch (err) {
      onProgress?.(`npm install error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Fallback: download just gemini-cli-core directly (no npm needed)
  return installViaDirectDownload(onProgress, proxyUrl);
}

/**
 * Check if Gemini CLI OAuth credentials can be resolved (from global install,
 * local install, or env vars). Does NOT throw.
 */
export function isGeminiCliAvailable(): boolean {
  try {
    resolveOAuthClientConfig();
    return true;
  } catch {
    return false;
  }
}

function resolveOAuthClientConfig(): { clientId: string; clientSecret?: string } {
  // 1. Check env vars first (user override)
  const envClientId = resolveEnv(CLIENT_ID_KEYS);
  const envClientSecret = resolveEnv(CLIENT_SECRET_KEYS);
  if (envClientId) {
    return { clientId: envClientId, clientSecret: envClientSecret };
  }

  // 2. Try to extract from globally installed Gemini CLI
  const extracted = extractGeminiCliCredentials();
  if (extracted) {
    return extracted;
  }

  // 3. Try to extract from RivonClaw-managed local install
  const localExtracted = extractFromLocalInstall();
  if (localExtracted) {
    return localExtracted;
  }

  // 4. No credentials available
  throw new Error(
    "Gemini CLI not found. Install it first: brew install gemini-cli (or npm install -g @google/gemini-cli), or set GEMINI_CLI_OAUTH_CLIENT_ID.",
  );
}

/**
 * Replaced: the original uses `isWSL2Sync()` from `openclaw/plugin-sdk`.
 * The desktop Electron app is never WSL2, so this always returns false for non-remote.
 */
function shouldUseManualOAuthFlow(isRemote: boolean): boolean {
  return isRemote;
}

export function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("hex");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export function buildAuthUrl(
  challenge: string,
  verifier: string,
  redirectUri = REDIRECT_URI,
): string {
  const { clientId } = resolveOAuthClientConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: SCOPES.join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: verifier,
    access_type: "offline",
    prompt: "consent",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function parseCallbackInput(
  input: string,
  expectedState: string,
): { code: string; state: string } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { error: "No input provided" };
  }

  try {
    const url = new URL(trimmed);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state") ?? expectedState;
    if (!code) {
      return { error: "Missing 'code' parameter in URL" };
    }
    if (!state) {
      return { error: "Missing 'state' parameter. Paste the full URL." };
    }
    return { code, state };
  } catch {
    if (!expectedState) {
      return { error: "Paste the full redirect URL, not just the code." };
    }
    return { code: trimmed, state: expectedState };
  }
}

export async function waitForLocalCallback(params: {
  expectedState: string;
  timeoutMs: number;
  onProgress?: (message: string) => void;
}): Promise<{ code: string; state: string }> {
  const callback = await startGeminiLoopbackCallback({
    expectedState: params.expectedState,
    timeoutMs: params.timeoutMs,
    onProgress: params.onProgress,
  });
  return callback.waitForCallback.finally(() => callback.close());
}

export async function exchangeCodeForTokens(
  code: string,
  verifier: string,
  proxyUrl?: string,
  redirectUri = REDIRECT_URI,
): Promise<GeminiCliOAuthCredentials> {
  const { clientId, clientSecret } = resolveOAuthClientConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  if (clientSecret) {
    body.set("client_secret", clientSecret);
  }

  const response = await proxiedFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  }, proxyUrl);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  if (!data.refresh_token) {
    throw new Error("No refresh token received. Please try again.");
  }

  const email = await getUserEmail(data.access_token, proxyUrl);
  const projectId = shouldUseGeminiPersonalOAuth()
    ? undefined
    : await discoverProject(data.access_token, proxyUrl);
  const expiresAt = Date.now() + data.expires_in * 1000 - 5 * 60 * 1000;

  return {
    refresh: data.refresh_token,
    access: data.access_token,
    expires: expiresAt,
    projectId,
    email,
  };
}

export async function startGeminiLoopbackCallback(params: {
  expectedState: string;
  timeoutMs?: number;
  onProgress?: (message: string) => void;
}) {
  return startLoopbackOAuthCallback({
    providerLabel: "Gemini CLI",
    preferredPort: PREFERRED_CALLBACK_PORT,
    callbackPath: CALLBACK_PATH,
    expectedState: params.expectedState,
    timeoutMs: params.timeoutMs ?? LOCAL_CALLBACK_TIMEOUT_MS,
    onProgress: params.onProgress,
    successTitle: "Gemini CLI OAuth Complete",
    successBody: "You can close this window and return to RivonClaw.",
    staleTitle: "Session Expired",
    staleBody:
      "This authorization link is from a previous attempt. Return to RivonClaw and click the login button again.",
  });
}

async function getUserEmail(accessToken: string, proxyUrl?: string): Promise<string | undefined> {
  try {
    const response = await proxiedFetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }, proxyUrl);
    if (response.ok) {
      const data = (await response.json()) as { email?: string };
      return data.email;
    }
  } catch {
    // ignore
  }
  return undefined;
}

async function discoverProject(accessToken: string, proxyUrl?: string): Promise<string> {
  const envProject = process.env.GOOGLE_CLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT_ID;
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "User-Agent": "google-api-nodejs-client/9.15.1",
    "X-Goog-Api-Client": "gl-node/openclaw",
  };

  const loadBody = {
    cloudaicompanionProject: envProject,
    metadata: {
      ideType: "IDE_UNSPECIFIED",
      platform: "PLATFORM_UNSPECIFIED",
      pluginType: "GEMINI",
      duetProject: envProject,
    },
  };

  let data: {
    currentTier?: { id?: string };
    cloudaicompanionProject?: string | { id?: string };
    allowedTiers?: Array<{ id?: string; isDefault?: boolean }>;
  } = {};

  try {
    const response = await proxiedFetch(`${CODE_ASSIST_ENDPOINT}/v1internal:loadCodeAssist`, {
      method: "POST",
      headers,
      body: JSON.stringify(loadBody),
    }, proxyUrl);

    if (!response.ok) {
      const errorPayload = await response.json().catch(() => null);
      if (isVpcScAffected(errorPayload)) {
        data = { currentTier: { id: TIER_STANDARD } };
      } else {
        throw new Error(`loadCodeAssist failed: ${response.status} ${response.statusText}`);
      }
    } else {
      data = (await response.json()) as typeof data;
    }
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error("loadCodeAssist failed", { cause: err });
  }

  if (data.currentTier) {
    const project = data.cloudaicompanionProject;
    if (typeof project === "string" && project) {
      return project;
    }
    if (typeof project === "object" && project?.id) {
      return project.id;
    }
    if (envProject) {
      return envProject;
    }
    // No project associated yet — fall through to onboarding to auto-provision one.
    // This happens for consumer Gemini Pro/Advanced subscriptions where the Cloud
    // project hasn't been provisioned yet.
  }

  // When the user already has a subscription (currentTier is set) but no project
  // was returned, use free-tier onboarding to auto-provision one.  Google's backend
  // respects the user's actual subscription tier regardless of the onboarding tier.
  // This covers consumer Gemini Pro/Advanced users whose project hasn't been
  // provisioned yet, and enterprise "standard-tier" users without a pre-assigned
  // cloudaicompanionProject.
  const hasExistingTierButNoProject = !!data.currentTier;
  const tier = hasExistingTierButNoProject ? { id: TIER_FREE } : getDefaultTier(data.allowedTiers);
  const tierId = tier?.id || TIER_FREE;
  if (tierId !== TIER_FREE && !envProject) {
    throw new DetailedError(
      "Your Google account requires a Cloud project. " +
      "Please create one at console.cloud.google.com and set GOOGLE_CLOUD_PROJECT.",
      `tierId=${tierId}, currentTier=${JSON.stringify(data.currentTier ?? null)}, ` +
      `allowedTiers=${JSON.stringify(data.allowedTiers)}, ` +
      `cloudaicompanionProject=${JSON.stringify(data.cloudaicompanionProject ?? null)}`,
    );
  }

  const onboardBody: Record<string, unknown> = {
    tierId,
    metadata: {
      ideType: "IDE_UNSPECIFIED",
      platform: "PLATFORM_UNSPECIFIED",
      pluginType: "GEMINI",
    },
  };
  if (tierId !== TIER_FREE && envProject) {
    onboardBody.cloudaicompanionProject = envProject;
    (onboardBody.metadata as Record<string, unknown>).duetProject = envProject;
  }

  const onboardResponse = await proxiedFetch(`${CODE_ASSIST_ENDPOINT}/v1internal:onboardUser`, {
    method: "POST",
    headers,
    body: JSON.stringify(onboardBody),
  }, proxyUrl);

  if (!onboardResponse.ok) {
    const respText = await onboardResponse.text().catch(() => "");
    throw new DetailedError(
      "Google project provisioning failed. Please try again later.",
      `onboardUser ${onboardResponse.status} ${onboardResponse.statusText}: ${respText}`,
    );
  }

  let lro = (await onboardResponse.json()) as {
    done?: boolean;
    name?: string;
    response?: { cloudaicompanionProject?: { id?: string } };
  };

  if (!lro.done && lro.name) {
    lro = await pollOperation(lro.name, headers, proxyUrl);
  }

  const projectId = lro.response?.cloudaicompanionProject?.id;
  if (projectId) {
    return projectId;
  }
  if (envProject) {
    return envProject;
  }

  throw new DetailedError(
    "Could not discover or provision a Google Cloud project. " +
    "Set GOOGLE_CLOUD_PROJECT or GOOGLE_CLOUD_PROJECT_ID.",
    `tierId=${tierId}, onboardResponse=${JSON.stringify(lro)}, ` +
    `currentTier=${JSON.stringify(data.currentTier ?? null)}`,
  );
}

function isVpcScAffected(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object") {
    return false;
  }
  const details = (error as { details?: unknown[] }).details;
  if (!Array.isArray(details)) {
    return false;
  }
  return details.some(
    (item) =>
      typeof item === "object" &&
      item &&
      (item as { reason?: string }).reason === "SECURITY_POLICY_VIOLATED",
  );
}

function getDefaultTier(
  allowedTiers?: Array<{ id?: string; isDefault?: boolean }>,
): { id?: string } | undefined {
  if (!allowedTiers?.length) {
    return { id: TIER_LEGACY };
  }
  return allowedTiers.find((tier) => tier.isDefault) ?? { id: TIER_LEGACY };
}

async function pollOperation(
  operationName: string,
  headers: Record<string, string>,
  proxyUrl?: string,
): Promise<{ done?: boolean; response?: { cloudaicompanionProject?: { id?: string } } }> {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const response = await proxiedFetch(`${CODE_ASSIST_ENDPOINT}/v1internal/${operationName}`, {
      headers,
    }, proxyUrl);
    if (!response.ok) {
      continue;
    }
    const data = (await response.json()) as {
      done?: boolean;
      response?: { cloudaicompanionProject?: { id?: string } };
    };
    if (data.done) {
      return data;
    }
  }
  throw new Error("Operation polling timeout");
}

export async function loginGeminiCliOAuth(
  ctx: GeminiCliOAuthContext,
): Promise<GeminiCliOAuthCredentials> {
  const needsManual = shouldUseManualOAuthFlow(ctx.isRemote);
  await ctx.note(
    needsManual
      ? [
          "You are running in a remote/VPS environment.",
          "A URL will be shown for you to open in your LOCAL browser.",
          "After signing in, copy the redirect URL and paste it back here.",
        ].join("\n")
      : [
          "Browser will open for Google authentication.",
          "Sign in with your Google account for Gemini CLI access.",
          "The callback will be captured automatically on a local loopback port.",
        ].join("\n"),
    "Gemini CLI OAuth",
  );

  const { verifier, challenge } = generatePkce();

  if (needsManual) {
    const authUrl = buildAuthUrl(challenge, verifier);
    ctx.progress.update("OAuth URL ready");
    ctx.log(`\nOpen this URL in your LOCAL browser:\n\n${authUrl}\n`);
    ctx.progress.update("Waiting for you to paste the callback URL...");
    const callbackInput = await ctx.prompt("Paste the redirect URL here: ");
    const parsed = parseCallbackInput(callbackInput, verifier);
    if ("error" in parsed) {
      throw new Error(parsed.error);
    }
    if (parsed.state !== verifier) {
      throw new Error("OAuth state mismatch - please try again");
    }
    ctx.progress.update("Exchanging authorization code for tokens...");
    return exchangeCodeForTokens(parsed.code, verifier, ctx.proxyUrl);
  }

  const callback = await startGeminiLoopbackCallback({
    expectedState: verifier,
    timeoutMs: LOCAL_CALLBACK_TIMEOUT_MS,
    onProgress: (msg) => ctx.progress.update(msg),
  });
  const authUrl = buildAuthUrl(challenge, verifier, callback.redirectUri);
  ctx.progress.update("Complete sign-in in browser...");
  try {
    await ctx.openUrl(authUrl);
  } catch {
    ctx.log(`\nOpen this URL in your browser:\n\n${authUrl}\n`);
  }

  try {
    const { code } = await callback.waitForCallback;
    ctx.progress.update("Exchanging authorization code for tokens...");
    return await exchangeCodeForTokens(code, verifier, ctx.proxyUrl, callback.redirectUri);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("EADDRINUSE") ||
        err.message.includes("port") ||
        err.message.includes("listen"))
    ) {
      // In a desktop (non-remote) app, manual prompt mode doesn't work
      // (prompt callback returns ""), so throw a clear port-conflict error.
      if (!needsManual) {
        throw new Error(
          `Port 8085 is in use by another process. Close the other application ` +
            `using port 8085 and try again.`,
          { cause: err },
        );
      }
      ctx.progress.update("Local callback server failed. Switching to manual mode...");
      ctx.log(`\nOpen this URL in your LOCAL browser:\n\n${authUrl}\n`);
      const callbackInput = await ctx.prompt("Paste the redirect URL here: ");
      const parsed = parseCallbackInput(callbackInput, verifier);
      if ("error" in parsed) {
        throw new Error(parsed.error, { cause: err });
      }
      if (parsed.state !== verifier) {
        throw new Error("OAuth state mismatch - please try again", { cause: err });
      }
      ctx.progress.update("Exchanging authorization code for tokens...");
      return exchangeCodeForTokens(parsed.code, verifier, ctx.proxyUrl, callback.redirectUri);
    }
    throw err;
  } finally {
    callback.close();
  }
}
