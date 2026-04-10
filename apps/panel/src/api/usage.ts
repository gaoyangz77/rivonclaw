import { fetchJson } from "./client.js";
import { API, clientPath } from "@rivonclaw/core/api-contract";

// --- Usage ---

export interface UsageSummary {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalEstimatedCostUsd: number;
  recordCount: number;
  byModel: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostUsd: number;
      count: number;
    }
  >;
  byProvider: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      estimatedCostUsd: number;
      count: number;
    }
  >;
}

export async function fetchUsage(
  filter?: { since?: string; until?: string; model?: string; provider?: string },
): Promise<UsageSummary> {
  const params = new URLSearchParams();
  if (filter?.since) params.set("since", filter.since);
  if (filter?.until) params.set("until", filter.until);
  if (filter?.model) params.set("model", filter.model);
  if (filter?.provider) params.set("provider", filter.provider);
  const query = params.toString();
  return fetchJson<UsageSummary>(clientPath(API["usage.summary"]) + (query ? "?" + query : ""));
}

// --- Per-Key/Model Usage ---

export interface KeyModelUsageSummary {
  keyId: string;
  keyLabel: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCostUsd: string;
  authType: "api_key" | "oauth";
}

export interface ActiveKeyInfo {
  keyId: string;
  keyLabel: string;
  provider: string;
  model: string;
  authType: "api_key" | "oauth";
}

export async function fetchKeyUsage(filter?: {
  windowStart?: number;
  windowEnd?: number;
  keyId?: string;
  provider?: string;
  model?: string;
}): Promise<KeyModelUsageSummary[]> {
  const params = new URLSearchParams();
  if (filter?.windowStart) params.set("windowStart", String(filter.windowStart));
  if (filter?.windowEnd) params.set("windowEnd", String(filter.windowEnd));
  if (filter?.keyId) params.set("keyId", filter.keyId);
  if (filter?.provider) params.set("provider", filter.provider);
  if (filter?.model) params.set("model", filter.model);
  const query = params.toString();
  return fetchJson<KeyModelUsageSummary[]>(clientPath(API["usage.keyUsage"]) + (query ? "?" + query : ""));
}

export async function fetchActiveKeyUsage(): Promise<ActiveKeyInfo | null> {
  return fetchJson<ActiveKeyInfo | null>(clientPath(API["usage.activeKey"]));
}

export interface KeyUsageDailyBucket {
  keyId: string;
  keyLabel: string;
  provider: string;
  model: string;
  date: string;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: string;
}

export async function fetchKeyUsageTimeseries(filter?: {
  windowStart?: number;
  windowEnd?: number;
}): Promise<KeyUsageDailyBucket[]> {
  const params = new URLSearchParams();
  if (filter?.windowStart) params.set("windowStart", String(filter.windowStart));
  if (filter?.windowEnd) params.set("windowEnd", String(filter.windowEnd));
  const query = params.toString();
  return fetchJson<KeyUsageDailyBucket[]>(clientPath(API["usage.timeseries"]) + (query ? "?" + query : ""));
}
