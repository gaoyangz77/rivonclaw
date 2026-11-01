import type { Storage } from "@rivonclaw/storage";
import { UsageSnapshotEngine, type CaptureUsageFn, type ModelUsageTotals } from "./usage-snapshot-engine.js";
import { UsageQueryService } from "./usage-query-service.js";
import type {
  GatewayRequestFn,
  GatewaySessionsUsageParams,
  GatewaySessionsUsageResult,
} from "./sessions-usage.js";

/**
 * Build the capture function that reads cumulative per-"provider/model" totals
 * from the gateway's `sessions.usage` RPC, aggregated across every agent and
 * every session since the beginning of time.
 *
 * `limit: 1` keeps the per-session rows out of the payload; the gateway computes
 * `aggregates` over all matched sessions before applying the limit.
 *
 * Throws when the gateway is unavailable or the RPC fails. An empty map would be
 * indistinguishable from "no usage" and silently turn into zero totals.
 */
export function createCaptureUsage(request: GatewayRequestFn): CaptureUsageFn {
  return async (): Promise<Map<string, ModelUsageTotals>> => {
    const params: GatewaySessionsUsageParams = { agentScope: "all", range: "all", limit: 1 };
    const result = await request<GatewaySessionsUsageResult>("sessions.usage", params);

    const totalsByModel = new Map<string, ModelUsageTotals>();
    for (const bucket of result.aggregates.byModel) {
      const key = `${bucket.provider ?? "unknown"}/${bucket.model ?? "unknown"}`;
      const existing = totalsByModel.get(key);
      if (existing) {
        existing.inputTokens += bucket.totals.input;
        existing.outputTokens += bucket.totals.output;
        existing.cacheReadTokens += bucket.totals.cacheRead;
        existing.cacheWriteTokens += bucket.totals.cacheWrite;
        existing.totalCostUsd = (
          parseFloat(existing.totalCostUsd) + bucket.totals.totalCost
        ).toFixed(6);
      } else {
        totalsByModel.set(key, {
          inputTokens: bucket.totals.input,
          outputTokens: bucket.totals.output,
          cacheReadTokens: bucket.totals.cacheRead,
          cacheWriteTokens: bucket.totals.cacheWrite,
          totalCostUsd: bucket.totals.totalCost.toFixed(6),
        });
      }
    }
    return totalsByModel;
  };
}

/**
 * Create the usage runtime: snapshot engine + query service.
 * Both share a single captureUsage closure backed by the gateway RPC.
 */
export function createUsageRuntime(
  storage: Storage,
  request: GatewayRequestFn,
): {
  snapshotEngine: UsageSnapshotEngine;
  queryService: UsageQueryService;
} {
  const captureUsage = createCaptureUsage(request);
  const snapshotEngine = new UsageSnapshotEngine(storage, captureUsage);
  const queryService = new UsageQueryService(storage, captureUsage);

  return { snapshotEngine, queryService };
}
