/**
 * Provider subscription-quota usage fetchers.
 *
 * These functions mirror the pure-HTTP fetchers exposed by OpenClaw's
 * `openclaw/plugin-sdk/provider-usage` entrypoint (see
 * `vendor/openclaw/src/infra/provider-usage.fetch.codex.ts`).
 *
 * Why they are inlined instead of imported from the vendor package:
 *   - The `openclaw` package name is only resolvable from within the gateway
 *     runtime (node_modules under vendor/). Desktop's TypeScript build has no
 *     resolution for it, and using `createRequire(vendorDir + "/package.json")`
 *     at runtime would pull the full vendor module graph (including WSL2 / pi
 *     auth helpers) just for this small HTTP wrapper.
 *
 * Vendor reference (version 2026.4.1):
 *   - `vendor/openclaw/src/infra/provider-usage.types.ts`
 *   - `vendor/openclaw/src/infra/provider-usage.fetch.codex.ts`
 *
 * Non-goals:
 *   - No plugin/custom-fetcher hook path. This file covers the provider listed
 *     in `USAGE_QUERYABLE_PROVIDERS` (core) and no more.
 *   - No auth resolution. Callers must pass a bearer token already resolved
 *     against the per-key secret store / auth-profiles.json.
 */

export interface UsageWindow {
  label: string;
  usedPercent: number;
  resetAt?: number;
}

export interface ProviderUsageSnapshot {
  windows: UsageWindow[];
  plan?: string;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 8000;

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
}

/**
 * The provider-facing hosts here (chatgpt.com and auth.openai.com) are blocked
 * or slow in several regions and require per-key
 * or system-wide proxy routing. All fetchers in this module accept a
 * `fetchFn` so the caller can thread `proxyNetwork.fetch` through — that
 * routes via the local proxy-router which already handles per-key / system /
 * direct dispatch. Defaulting to global `fetch` keeps tests and direct-connect
 * environments working out of the box.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchFn: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchFn(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function buildHttpErrorSnapshot(status: number, message?: string): ProviderUsageSnapshot {
  const suffix = message?.trim() ? `: ${message.trim()}` : "";
  return { windows: [], error: `HTTP ${status}${suffix}` };
}

// ──────────────────────────────────────────────────────────────────────────
// Note: Claude (Anthropic) usage fetch intentionally NOT implemented here.
//
// The UI lets users paste tokens from `claude setup-token`, which are scoped
// for the Messages API but omit the `user:profile` scope required by
// Anthropic's OAuth usage endpoint (`/api/oauth/usage`). Querying usage with
// such a token returns HTTP 403 "does not meet scope requirement user:profile".
// OpenClaw's own claude fetcher has the same primary path and falls back to a
// claude.ai browser sessionKey cookie set via env vars — see
// `vendor/openclaw/src/infra/provider-usage.fetch.claude.ts`. That fallback is
// a power-user workaround unsuitable for EasyClaw's non-developer audience.
// Re-adding support requires either a full Anthropic OAuth flow that requests
// `user:profile`, or a Panel UX for pasting the session cookie.
// See also: `USAGE_QUERYABLE_PROVIDERS` in `packages/core/src/models.ts`.
// ──────────────────────────────────────────────────────────────────────────

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
  fetchFn: typeof fetch = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ProviderUsageSnapshot> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "CodexBar",
    Accept: "application/json",
  };
  if (accountId) headers["ChatGPT-Account-Id"] = accountId;

  // `chatgpt.com` is blocked in several regions — callers in Desktop must
  // pass `proxyNetwork.fetch` for the per-key / system-proxy routing to apply.
  const res = await fetchWithTimeout(
    "https://chatgpt.com/backend-api/wham/usage",
    { method: "GET", headers },
    timeoutMs,
    fetchFn,
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
