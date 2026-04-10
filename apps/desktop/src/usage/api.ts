import { DEFAULTS } from "@rivonclaw/core";
import { API } from "@rivonclaw/core/api-contract";
import { createLogger } from "@rivonclaw/logger";
import { resolveOpenClawConfigPath, readExistingConfig } from "@rivonclaw/gateway";
import { loadCostUsageSummary, discoverAllSessions, loadSessionCostSummary } from "./session-usage.js";
import type { CostUsageSummary, SessionCostSummary } from "./session-usage.js";
import type { RouteRegistry, EndpointHandler } from "../infra/api/route-registry.js";
import type { ApiContext } from "../app/api-context.js";
import { sendJson } from "../infra/api/route-utils.js";

const log = createLogger("panel-server");

// --- Usage Types and Helpers ---

interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
  recordCount: number;
  byModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    count: number;
  }>;
  byProvider: Record<string, {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    count: number;
  }>;
}

interface UsageFilter {
  since?: string;
  until?: string;
  model?: string;
  provider?: string;
}

// Simple cache with TTL for usage data
const usageCache = new Map<string, { data: UsageSummary; expiresAt: number }>();
const CACHE_TTL_MS = DEFAULTS.desktop.usageCacheTtlMs;

function getCachedUsage(cacheKey: string): UsageSummary | null {
  const cached = usageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  usageCache.delete(cacheKey);
  return null;
}

function setCachedUsage(cacheKey: string, data: UsageSummary): void {
  usageCache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function transformToUsageSummary(
  costSummary: CostUsageSummary,
  sessionSummaries: SessionCostSummary[]
): UsageSummary {
  const byModelMap = new Map<string, {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    count: number;
  }>();

  const byProviderMap = new Map<string, {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
    count: number;
  }>();

  for (const session of sessionSummaries) {
    if (!session.modelUsage) continue;

    for (const modelUsage of session.modelUsage) {
      const model = modelUsage.model || "unknown";
      const provider = modelUsage.provider || "unknown";

      const modelKey = `${provider}/${model}`;
      const modelEntry = byModelMap.get(modelKey) || {
        inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, count: 0,
      };
      modelEntry.inputTokens += modelUsage.totals.input;
      modelEntry.outputTokens += modelUsage.totals.output;
      modelEntry.totalTokens += modelUsage.totals.totalTokens;
      modelEntry.estimatedCostUsd += modelUsage.totals.totalCost;
      modelEntry.count += modelUsage.count;
      byModelMap.set(modelKey, modelEntry);

      const providerEntry = byProviderMap.get(provider) || {
        inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCostUsd: 0, count: 0,
      };
      providerEntry.inputTokens += modelUsage.totals.input;
      providerEntry.outputTokens += modelUsage.totals.output;
      providerEntry.totalTokens += modelUsage.totals.totalTokens;
      providerEntry.estimatedCostUsd += modelUsage.totals.totalCost;
      providerEntry.count += modelUsage.count;
      byProviderMap.set(provider, providerEntry);
    }
  }

  return {
    totalInputTokens: costSummary.totals.input,
    totalOutputTokens: costSummary.totals.output,
    totalTokens: costSummary.totals.totalTokens,
    totalEstimatedCostUsd: costSummary.totals.totalCost,
    recordCount: costSummary.daily.length,
    byModel: Object.fromEntries(byModelMap),
    byProvider: Object.fromEntries(byProviderMap),
  };
}

function emptyUsageSummary(): UsageSummary {
  return {
    totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0,
    totalEstimatedCostUsd: 0, recordCount: 0,
    byModel: {}, byProvider: {},
  };
}

const getUsageSummary: EndpointHandler = async (_req, res, url, _params, _ctx) => {
  const filter: UsageFilter = {};
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");
  if (since) filter.since = since;
  if (until) filter.until = until;

  const cacheKey = `usage-${filter.since ?? "all"}-${filter.until ?? "all"}`;
  const cached = getCachedUsage(cacheKey);
  if (cached) {
    sendJson(res, 200, cached);
    return;
  }

  try {
    const startMs = filter.since ? new Date(filter.since).getTime() : undefined;
    const endMs = filter.until ? new Date(filter.until).getTime() : undefined;

    const configPath = resolveOpenClawConfigPath();
    const config = readExistingConfig(configPath);

    const costSummary = await loadCostUsageSummary({ startMs, endMs, config });

    const sessions = await discoverAllSessions({ startMs, endMs });
    const sessionSummaries: SessionCostSummary[] = [];

    for (const session of sessions) {
      const summary = await loadSessionCostSummary({
        sessionFile: session.sessionFile,
        config,
        startMs,
        endMs,
      });
      if (summary && summary.modelUsage) {
        sessionSummaries.push(summary);
      }
    }

    const summary = transformToUsageSummary(costSummary, sessionSummaries);
    setCachedUsage(cacheKey, summary);

    sendJson(res, 200, summary);
  } catch (error) {
    log.error("Failed to load usage data", error);
    sendJson(res, 200, emptyUsageSummary());
  }
};

const getKeyUsage: EndpointHandler = async (_req, res, url, _params, ctx: ApiContext) => {
  const { queryService } = ctx;
  if (!queryService) {
    sendJson(res, 501, { error: "Per-key usage tracking not available" });
    return;
  }
  try {
    const windowStart = url.searchParams.get("windowStart");
    const windowEnd = url.searchParams.get("windowEnd");
    const results = await queryService.queryUsage({
      windowStart: windowStart ? Number(windowStart) : 0,
      windowEnd: windowEnd ? Number(windowEnd) : Date.now(),
      keyId: url.searchParams.get("keyId") ?? undefined,
      provider: url.searchParams.get("provider") ?? undefined,
      model: url.searchParams.get("model") ?? undefined,
    });
    sendJson(res, 200, results);
  } catch (err) {
    log.error("Failed to query key usage:", err);
    sendJson(res, 500, { error: "Failed to query key usage" });
  }
};

const getActiveKey: EndpointHandler = async (_req, res, _url, _params, ctx: ApiContext) => {
  const { storage } = ctx;
  try {
    const activeKey = storage.providerKeys.getActive();
    sendJson(res, 200, activeKey ? { keyId: activeKey.id, keyLabel: activeKey.label, provider: activeKey.provider, model: activeKey.model, authType: activeKey.authType ?? "api_key" } : null);
  } catch (err) {
    log.error("Failed to get active key:", err);
    sendJson(res, 500, { error: "Failed to get active key" });
  }
};

const getTimeseries: EndpointHandler = async (_req, res, url, _params, ctx: ApiContext) => {
  const { queryService } = ctx;
  if (!queryService) {
    sendJson(res, 501, { error: "Per-key usage tracking not available" });
    return;
  }
  try {
    const windowStart = Number(url.searchParams.get("windowStart")) || 0;
    const windowEnd = Number(url.searchParams.get("windowEnd")) || Date.now();
    const buckets = queryService.queryTimeseries({ windowStart, windowEnd });
    sendJson(res, 200, buckets);
  } catch (err) {
    log.error("Failed to query key usage timeseries:", err);
    sendJson(res, 500, { error: "Failed to query key usage timeseries" });
  }
};

export function registerUsageHandlers(registry: RouteRegistry): void {
  registry.register(API["usage.summary"], getUsageSummary);
  registry.register(API["usage.keyUsage"], getKeyUsage);
  registry.register(API["usage.activeKey"], getActiveKey);
  registry.register(API["usage.timeseries"], getTimeseries);
}
