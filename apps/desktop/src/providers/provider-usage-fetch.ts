/**
 * Provider subscription-quota usage fetchers.
 *
 * These functions mirror the pure-HTTP fetchers exposed by OpenClaw's
 * `openclaw/plugin-sdk/provider-usage` entrypoint (see
 * `vendor/openclaw/src/infra/provider-usage.fetch.{claude,codex,gemini}.ts`).
 *
 * Why they are inlined instead of imported from the vendor package:
 *   - The `openclaw` package name is only resolvable from within the gateway
 *     runtime (node_modules under vendor/). Desktop's TypeScript build has no
 *     resolution for it, and using `createRequire(vendorDir + "/package.json")`
 *     at runtime would pull the full vendor module graph (including WSL2 / pi
 *     auth helpers) just for three ~80-line HTTP wrappers.
 *   - The same pattern is already used by `packages/gateway/src/gemini-cli-oauth.ts`
 *     which documents the vendor file it was copied from. Keep the comment header
 *     below in sync with vendor so an OpenClaw upgrade can replay the diff.
 *
 * Vendor reference (version 2026.4.1):
 *   - `vendor/openclaw/src/infra/provider-usage.types.ts`
 *   - `vendor/openclaw/src/infra/provider-usage.fetch.claude.ts`
 *   - `vendor/openclaw/src/infra/provider-usage.fetch.codex.ts`
 *   - `vendor/openclaw/src/infra/provider-usage.fetch.gemini.ts`
 *
 * Non-goals:
 *   - No plugin/custom-fetcher hook path. This file covers the three providers
 *     listed in `USAGE_QUERYABLE_PROVIDERS` (core) and no more.
 *   - No auth resolution. Callers must pass a bearer token already resolved
 *     against the per-key secret store / auth-profiles.json.
 */

export interface UsageWindow {
  label: string;
  usedPercent: number;
  resetAt?: number;
}

/** Discriminated on the matching entry in `USAGE_QUERYABLE_PROVIDERS`. */
export type UsageProviderKind = "anthropic" | "openai-codex" | "google-gemini-cli";

export interface ProviderUsageSnapshot {
  windows: UsageWindow[];
  plan?: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 8000;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildHttpErrorSnapshot(status: number, message?: string): ProviderUsageSnapshot {
  const suffix = message?.trim() ? `: ${message.trim()}` : "";
  return { windows: [], error: `HTTP ${status}${suffix}` };
}

// ──────────────────────────────────────────────────────────────────────────
// Claude (Anthropic OAuth)
// ──────────────────────────────────────────────────────────────────────────

type ClaudeUsageResponse = {
  five_hour?: { utilization?: number; resets_at?: string };
  seven_day?: { utilization?: number; resets_at?: string };
  seven_day_sonnet?: { utilization?: number };
  seven_day_opus?: { utilization?: number };
};

export async function fetchClaudeUsage(
  token: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ProviderUsageSnapshot> {
  const res = await fetchWithTimeout(
    "https://api.anthropic.com/api/oauth/usage",
    {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": "openclaw",
        Accept: "application/json",
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "oauth-2025-04-20",
      },
    },
    timeoutMs,
  );

  if (!res.ok) {
    let message: string | undefined;
    try {
      const data = (await res.json()) as { error?: { message?: unknown } | null };
      const raw = data?.error?.message;
      if (typeof raw === "string" && raw.trim()) message = raw.trim();
    } catch {
      // body is not JSON — fall through with no message
    }
    return buildHttpErrorSnapshot(res.status, message);
  }

  const data = (await res.json()) as ClaudeUsageResponse;
  const windows: UsageWindow[] = [];

  if (data.five_hour?.utilization !== undefined) {
    windows.push({
      label: "5h",
      usedPercent: clampPercent(data.five_hour.utilization),
      resetAt: data.five_hour.resets_at
        ? new Date(data.five_hour.resets_at).getTime()
        : undefined,
    });
  }
  if (data.seven_day?.utilization !== undefined) {
    windows.push({
      label: "Week",
      usedPercent: clampPercent(data.seven_day.utilization),
      resetAt: data.seven_day.resets_at
        ? new Date(data.seven_day.resets_at).getTime()
        : undefined,
    });
  }
  const modelWindow = data.seven_day_sonnet || data.seven_day_opus;
  if (modelWindow?.utilization !== undefined) {
    windows.push({
      label: data.seven_day_sonnet ? "Sonnet" : "Opus",
      usedPercent: clampPercent(modelWindow.utilization),
    });
  }

  return { windows };
}

// ──────────────────────────────────────────────────────────────────────────
// Codex (OpenAI Codex OAuth)
// ──────────────────────────────────────────────────────────────────────────

type CodexUsageResponse = {
  rate_limit?: {
    limit_reached?: boolean;
    primary_window?: {
      limit_window_seconds?: number;
      used_percent?: number;
      reset_at?: number;
    };
    secondary_window?: {
      limit_window_seconds?: number;
      used_percent?: number;
      reset_at?: number;
    };
  };
  plan_type?: string;
  credits?: { balance?: number | string | null };
};

const WEEKLY_RESET_GAP_SECONDS = 3 * 24 * 60 * 60;

function resolveCodexSecondaryLabel(params: {
  windowHours: number;
  primaryResetAt?: number;
  secondaryResetAt?: number;
}): string {
  if (params.windowHours >= 168) return "Week";
  if (params.windowHours < 24) return `${params.windowHours}h`;
  // Codex occasionally reports a 24h secondary window while exposing a weekly
  // reset cadence in reset timestamps. Prefer cadence in that case.
  if (
    typeof params.secondaryResetAt === "number" &&
    typeof params.primaryResetAt === "number" &&
    params.secondaryResetAt - params.primaryResetAt >= WEEKLY_RESET_GAP_SECONDS
  ) {
    return "Week";
  }
  return "Day";
}

/**
 * Extract `chatgpt_account_user_id` from a Codex OAuth JWT. The quota endpoint
 * accepts requests without this header, but the returned windows are per-account,
 * so passing it makes the response match the active subscription.
 *
 * Mirrors `vendor/openclaw/extensions/openai/openai-codex-auth-identity.ts`.
 */
export function extractCodexAccountId(accessToken: string): string | undefined {
  const parts = accessToken.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const decoded = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(decoded) as {
      "https://api.openai.com/auth"?: { chatgpt_account_user_id?: unknown };
    };
    const raw = payload?.["https://api.openai.com/auth"]?.chatgpt_account_user_id;
    if (typeof raw !== "string") return undefined;
    const trimmed = raw.trim();
    // Codex sometimes encodes as "user-xxx__acct-yyy" — strip to account segment
    const acct = trimmed.split("__").pop();
    return acct && acct.startsWith("acct-") ? acct : trimmed || undefined;
  } catch {
    return undefined;
  }
}

export async function fetchCodexUsage(
  token: string,
  accountId: string | undefined,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ProviderUsageSnapshot> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "CodexBar",
    Accept: "application/json",
  };
  if (accountId) headers["ChatGPT-Account-Id"] = accountId;

  const res = await fetchWithTimeout(
    "https://chatgpt.com/backend-api/wham/usage",
    { method: "GET", headers },
    timeoutMs,
  );

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return { windows: [], error: "Token expired" };
    }
    return buildHttpErrorSnapshot(res.status);
  }

  const data = (await res.json()) as CodexUsageResponse;
  const windows: UsageWindow[] = [];

  if (data.rate_limit?.primary_window) {
    const pw = data.rate_limit.primary_window;
    const windowHours = Math.round((pw.limit_window_seconds || 10800) / 3600);
    windows.push({
      label: `${windowHours}h`,
      usedPercent: clampPercent(pw.used_percent || 0),
      resetAt: pw.reset_at ? pw.reset_at * 1000 : undefined,
    });
  }

  if (data.rate_limit?.secondary_window) {
    const sw = data.rate_limit.secondary_window;
    const windowHours = Math.round((sw.limit_window_seconds || 86400) / 3600);
    const label = resolveCodexSecondaryLabel({
      windowHours,
      primaryResetAt: data.rate_limit?.primary_window?.reset_at,
      secondaryResetAt: sw.reset_at,
    });
    windows.push({
      label,
      usedPercent: clampPercent(sw.used_percent || 0),
      resetAt: sw.reset_at ? sw.reset_at * 1000 : undefined,
    });
  }

  let plan = data.plan_type;
  if (data.credits?.balance !== undefined && data.credits.balance !== null) {
    const balance =
      typeof data.credits.balance === "number"
        ? data.credits.balance
        : parseFloat(data.credits.balance) || 0;
    plan = plan ? `${plan} ($${balance.toFixed(2)})` : `$${balance.toFixed(2)}`;
  }

  return { windows, plan };
}

// ──────────────────────────────────────────────────────────────────────────
// Gemini (Google OAuth via Code Assist)
// ──────────────────────────────────────────────────────────────────────────

type GeminiUsageResponse = {
  buckets?: Array<{ modelId?: string; remainingFraction?: number }>;
};

export async function fetchGeminiUsage(
  token: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ProviderUsageSnapshot> {
  const res = await fetchWithTimeout(
    "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
    timeoutMs,
  );

  if (!res.ok) return buildHttpErrorSnapshot(res.status);

  const data = (await res.json()) as GeminiUsageResponse;
  const quotas: Record<string, number> = {};
  for (const bucket of data.buckets || []) {
    const model = bucket.modelId || "unknown";
    const frac = bucket.remainingFraction ?? 1;
    if (quotas[model] === undefined || frac < quotas[model]) {
      quotas[model] = frac;
    }
  }

  const windows: UsageWindow[] = [];
  let proMin = 1;
  let flashMin = 1;
  let hasPro = false;
  let hasFlash = false;
  for (const [model, frac] of Object.entries(quotas)) {
    const lower = model.toLowerCase();
    if (lower.includes("pro")) {
      hasPro = true;
      if (frac < proMin) proMin = frac;
    }
    if (lower.includes("flash")) {
      hasFlash = true;
      if (frac < flashMin) flashMin = frac;
    }
  }
  if (hasPro) windows.push({ label: "Pro", usedPercent: clampPercent((1 - proMin) * 100) });
  if (hasFlash) windows.push({ label: "Flash", usedPercent: clampPercent((1 - flashMin) * 100) });

  return { windows };
}

/**
 * Some Gemini token stores (e.g. auth-profiles.json) wrap the bearer token in
 * a JSON envelope `{ "token": "ya29.x..." }`. Unwrap when present so the
 * Authorization header receives the raw token.
 */
export function unwrapGeminiToken(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { token?: unknown };
    if (typeof parsed?.token === "string") return parsed.token;
  } catch {
    // Not JSON — use as-is
  }
  return raw;
}
