import type { Storage } from "@rivonclaw/storage";
import { resolveOpenClawConfigPath, readExistingConfig } from "@rivonclaw/gateway";
import { createLogger } from "@rivonclaw/logger";
import { discoverAllSessions, loadSessionCostSummary } from "./session-usage.js";
import { UsageSnapshotEngine, type ModelUsageTotals } from "./usage-snapshot-engine.js";
import { UsageQueryService } from "./usage-query-service.js";

const log = createLogger("usage-runtime");

/**
 * Create the usage runtime: snapshot engine + query service.
 * Both share a single captureUsage closure that aggregates per-model
 * totals from all discovered OpenClaw sessions.
 */
export function createUsageRuntime(storage: Storage): {
  snapshotEngine: UsageSnapshotEngine;
  queryService: UsageQueryService;
} {
  const captureUsage = async (): Promise<Map<string, ModelUsageTotals>> => {
    const result = new Map<string, ModelUsageTotals>();
    try {
      const ocConfigPath = resolveOpenClawConfigPath();
      const ocConfig = readExistingConfig(ocConfigPath);
      const sessions = await discoverAllSessions({});
      for (const s of sessions) {
        const summary = await loadSessionCostSummary({ sessionFile: s.sessionFile, config: ocConfig });
        if (!summary?.modelUsage) continue;
        for (const mu of summary.modelUsage) {
          const key = `${mu.provider ?? "unknown"}/${mu.model ?? "unknown"}`;
          const existing = result.get(key);
          if (existing) {
            existing.inputTokens += mu.totals.input;
            existing.outputTokens += mu.totals.output;
            existing.cacheReadTokens += mu.totals.cacheRead;
            existing.cacheWriteTokens += mu.totals.cacheWrite;
            existing.totalCostUsd = (parseFloat(existing.totalCostUsd) + mu.totals.totalCost).toFixed(6);
          } else {
            result.set(key, {
              inputTokens: mu.totals.input,
              outputTokens: mu.totals.output,
              cacheReadTokens: mu.totals.cacheRead,
              cacheWriteTokens: mu.totals.cacheWrite,
              totalCostUsd: mu.totals.totalCost.toFixed(6),
            });
          }
        }
      }
    } catch (err) {
      log.error("Failed to capture current usage:", err);
    }
    return result;
  };

  const snapshotEngine = new UsageSnapshotEngine(storage, captureUsage);
  const queryService = new UsageQueryService(storage, captureUsage);

  return { snapshotEngine, queryService };
}
