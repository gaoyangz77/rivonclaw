import type { Storage } from "@rivonclaw/storage";
import { resolveGatewayProvider, type LLMProvider } from "@rivonclaw/core";

/**
 * Cumulative per-model usage totals from OpenClaw JSONL.
 * Keys are "provider/model" strings, values are token/cost totals.
 */
export interface ModelUsageTotals {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalCostUsd: string;
}

export type CaptureUsageFn = () => Promise<Map<string, ModelUsageTotals>>;

const SNAPSHOT_KEEP_N = 5;

/** Zero totals used when a model key is missing from the usage map. */
const ZERO_TOTALS: ModelUsageTotals = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  totalCostUsd: "0",
};

/** Clamp a number to zero if negative (can happen when JSONL files are rotated). */
function clampZero(n: number): number {
  return n < 0 ? 0 : n;
}

/** Subtract cost strings, returning a clamped result with 6 decimal places. */
function subtractCost(current: string, previous: string): string {
  const delta = parseFloat(current) - parseFloat(previous);
  return (delta < 0 ? 0 : delta).toFixed(6);
}

export class UsageSnapshotEngine {
  constructor(
    private storage: Storage,
    private captureUsage: CaptureUsageFn,
  ) {}

  /**
   * Called BEFORE deactivating old key/model.
   * Diffs current usage with latest snapshot, inserts historical record + new snapshot.
   * If no previous snapshot exists (first time), only creates initial snapshot.
   */
  async recordDeactivation(keyId: string, provider: string, model: string): Promise<void> {
    const currentUsage = await this.captureUsage();
    const modelKey = `${resolveGatewayProvider(provider as LLMProvider)}/${model}`;
    const current = currentUsage.get(modelKey) ?? ZERO_TOTALS;
    const now = Date.now();

    const latestSnapshot = this.storage.usageSnapshots.getLatest(keyId, model);

    if (latestSnapshot) {
      // Compute delta and insert historical record
      this.storage.keyUsageHistory.insert({
        keyId,
        provider,
        model,
        startTime: latestSnapshot.snapshotTime,
        endTime: now,
        inputTokens: clampZero(current.inputTokens - latestSnapshot.inputTokens),
        outputTokens: clampZero(current.outputTokens - latestSnapshot.outputTokens),
        cacheReadTokens: clampZero(current.cacheReadTokens - latestSnapshot.cacheReadTokens),
        cacheWriteTokens: clampZero(current.cacheWriteTokens - latestSnapshot.cacheWriteTokens),
        totalCostUsd: subtractCost(current.totalCostUsd, latestSnapshot.totalCostUsd),
      });
    }

    // Always insert a new snapshot
    this.storage.usageSnapshots.insert({
      keyId,
      provider,
      model,
      inputTokens: current.inputTokens,
      outputTokens: current.outputTokens,
      cacheReadTokens: current.cacheReadTokens,
      cacheWriteTokens: current.cacheWriteTokens,
      totalCostUsd: current.totalCostUsd,
      snapshotTime: now,
    });

    // Prune old snapshots
    this.storage.usageSnapshots.pruneOld(keyId, model, SNAPSHOT_KEEP_N);
  }

  /**
   * Called AFTER recording deactivation of old key, BEFORE actual activation.
   * Stores initial snapshot for the new key/model if none exists.
   */
  async recordActivation(keyId: string, provider: string, model: string): Promise<void> {
    const existing = this.storage.usageSnapshots.getLatest(keyId, model);
    if (existing) {
      return; // Already have a snapshot, no-op
    }

    const currentUsage = await this.captureUsage();
    const modelKey = `${resolveGatewayProvider(provider as LLMProvider)}/${model}`;
    const current = currentUsage.get(modelKey) ?? ZERO_TOTALS;
    const now = Date.now();

    this.storage.usageSnapshots.insert({
      keyId,
      provider,
      model,
      inputTokens: current.inputTokens,
      outputTokens: current.outputTokens,
      cacheReadTokens: current.cacheReadTokens,
      cacheWriteTokens: current.cacheWriteTokens,
      totalCostUsd: current.totalCostUsd,
      snapshotTime: now,
    });
  }

  /**
   * Called on app startup to cover crash/unclean shutdown gap.
   * For the currently active key: diffs latest snapshot with current usage,
   * inserts historical record for the gap, then fresh snapshot.
   */
  async reconcileOnStartup(
    activeKeyId: string,
    activeProvider: string,
    activeModel: string,
  ): Promise<void> {
    const latestSnapshot = this.storage.usageSnapshots.getLatest(activeKeyId, activeModel);
    if (!latestSnapshot) {
      return; // No previous data, nothing to reconcile
    }

    const currentUsage = await this.captureUsage();
    const modelKey = `${resolveGatewayProvider(activeProvider as LLMProvider)}/${activeModel}`;
    const current = currentUsage.get(modelKey) ?? ZERO_TOTALS;
    const now = Date.now();

    // Check if there is any change
    const deltaInput = clampZero(current.inputTokens - latestSnapshot.inputTokens);
    const deltaOutput = clampZero(current.outputTokens - latestSnapshot.outputTokens);
    const deltaCacheRead = clampZero(current.cacheReadTokens - latestSnapshot.cacheReadTokens);
    const deltaCacheWrite = clampZero(current.cacheWriteTokens - latestSnapshot.cacheWriteTokens);
    const deltaCost = subtractCost(current.totalCostUsd, latestSnapshot.totalCostUsd);

    if (
      deltaInput === 0 &&
      deltaOutput === 0 &&
      deltaCacheRead === 0 &&
      deltaCacheWrite === 0 &&
      deltaCost === "0.000000"
    ) {
      return; // No change since last snapshot
    }

    // Insert historical record for the gap
    this.storage.keyUsageHistory.insert({
      keyId: activeKeyId,
      provider: activeProvider,
      model: activeModel,
      startTime: latestSnapshot.snapshotTime,
      endTime: now,
      inputTokens: deltaInput,
      outputTokens: deltaOutput,
      cacheReadTokens: deltaCacheRead,
      cacheWriteTokens: deltaCacheWrite,
      totalCostUsd: deltaCost,
    });

    // Insert fresh snapshot
    this.storage.usageSnapshots.insert({
      keyId: activeKeyId,
      provider: activeProvider,
      model: activeModel,
      inputTokens: current.inputTokens,
      outputTokens: current.outputTokens,
      cacheReadTokens: current.cacheReadTokens,
      cacheWriteTokens: current.cacheWriteTokens,
      totalCostUsd: current.totalCostUsd,
      snapshotTime: now,
    });

    // Prune old snapshots
    this.storage.usageSnapshots.pruneOld(activeKeyId, activeModel, SNAPSHOT_KEEP_N);
  }
}
