import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStorage, type Storage } from "@rivonclaw/storage";
import {
  UsageSnapshotEngine,
  type ModelUsageTotals,
  type CaptureUsageFn,
} from "./usage-snapshot-engine.js";

let storage: Storage;

function makeTotals(overrides: Partial<ModelUsageTotals> = {}): ModelUsageTotals {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    totalCostUsd: "0",
    ...overrides,
  };
}

function makeCaptureFn(data: Record<string, Partial<ModelUsageTotals>>): CaptureUsageFn {
  return async () => {
    const map = new Map<string, ModelUsageTotals>();
    for (const [key, value] of Object.entries(data)) {
      map.set(key, makeTotals(value));
    }
    return map;
  };
}

beforeEach(() => {
  storage = createStorage(":memory:");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  storage.close();
});

describe("UsageSnapshotEngine", () => {
  // ── Test 1: recordDeactivation with no previous snapshot ──
  describe("recordDeactivation with no previous snapshot", () => {
    it("creates snapshot only, no history record", async () => {
      vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));

      const captureFn = makeCaptureFn({
        "anthropic/claude-sonnet-4-5-20250929": {
          inputTokens: 1000,
          outputTokens: 500,
          totalCostUsd: "0.05",
        },
      });

      const engine = new UsageSnapshotEngine(storage, captureFn);
      await engine.recordDeactivation("key-1", "anthropic", "claude-sonnet-4-5-20250929");

      // Snapshot should exist
      const snapshot = storage.usageSnapshots.getLatest("key-1", "claude-sonnet-4-5-20250929");
      expect(snapshot).toBeDefined();
      expect(snapshot!.inputTokens).toBe(1000);
      expect(snapshot!.outputTokens).toBe(500);
      expect(snapshot!.totalCostUsd).toBe("0.05");

      // No history records should exist (no previous snapshot to diff against)
      const history = storage.keyUsageHistory.queryByWindow({
        keyId: "key-1",
        windowStart: 0,
        windowEnd: Date.now() + 1000,
      });
      expect(history).toHaveLength(0);
    });
  });

  // ── Test 2: recordDeactivation with existing snapshot ──
  describe("recordDeactivation with existing snapshot", () => {
    it("creates history record with correct delta and new snapshot", async () => {
      // Set up initial snapshot
      vi.setSystemTime(new Date("2025-06-01T10:00:00Z"));
      const t1 = Date.now();

      storage.usageSnapshots.insert({
        keyId: "key-1",
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 200,
        cacheWriteTokens: 100,
        totalCostUsd: "0.050000",
        snapshotTime: t1,
      });

      // Advance time and deactivate with new usage
      vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
      const t2 = Date.now();

      const captureFn = makeCaptureFn({
        "anthropic/claude-sonnet-4-5-20250929": {
          inputTokens: 3000,
          outputTokens: 1500,
          cacheReadTokens: 600,
          cacheWriteTokens: 300,
          totalCostUsd: "0.150000",
        },
      });

      const engine = new UsageSnapshotEngine(storage, captureFn);
      await engine.recordDeactivation("key-1", "anthropic", "claude-sonnet-4-5-20250929");

      // New snapshot should have current cumulative totals
      const snapshot = storage.usageSnapshots.getLatest("key-1", "claude-sonnet-4-5-20250929");
      expect(snapshot).toBeDefined();
      expect(snapshot!.inputTokens).toBe(3000);
      expect(snapshot!.outputTokens).toBe(1500);
      expect(snapshot!.cacheReadTokens).toBe(600);
      expect(snapshot!.cacheWriteTokens).toBe(300);
      expect(snapshot!.totalCostUsd).toBe("0.150000");
      expect(snapshot!.snapshotTime).toBe(t2);

      // History record should have the delta
      const history = storage.keyUsageHistory.queryByWindow({
        keyId: "key-1",
        windowStart: 0,
        windowEnd: t2 + 1000,
      });
      expect(history).toHaveLength(1);
      expect(history[0].inputTokens).toBe(2000);
      expect(history[0].outputTokens).toBe(1000);
      expect(history[0].cacheReadTokens).toBe(400);
      expect(history[0].cacheWriteTokens).toBe(200);
      expect(history[0].totalCostUsd).toBe("0.100000");
      expect(history[0].startTime).toBe(t1);
      expect(history[0].endTime).toBe(t2);
    });
  });

  // ── Test 3: recordActivation when no snapshot exists ──
  describe("recordActivation when no snapshot exists", () => {
    it("creates initial snapshot", async () => {
      vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));

      const captureFn = makeCaptureFn({
        "openai/gpt-4o": {
          inputTokens: 500,
          outputTokens: 250,
          totalCostUsd: "0.020000",
        },
      });

      const engine = new UsageSnapshotEngine(storage, captureFn);
      await engine.recordActivation("key-2", "openai", "gpt-4o");

      const snapshot = storage.usageSnapshots.getLatest("key-2", "gpt-4o");
      expect(snapshot).toBeDefined();
      expect(snapshot!.inputTokens).toBe(500);
      expect(snapshot!.outputTokens).toBe(250);
      expect(snapshot!.totalCostUsd).toBe("0.020000");
    });
  });

  // ── Test 4: recordActivation when snapshot already exists ──
  describe("recordActivation when snapshot already exists", () => {
    it("is a no-op, does not create duplicate snapshot", async () => {
      vi.setSystemTime(new Date("2025-06-01T10:00:00Z"));
      const t1 = Date.now();

      storage.usageSnapshots.insert({
        keyId: "key-2",
        provider: "openai",
        model: "gpt-4o",
        inputTokens: 500,
        outputTokens: 250,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalCostUsd: "0.020000",
        snapshotTime: t1,
      });

      vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));

      const captureFn = vi.fn(
        makeCaptureFn({
          "openai/gpt-4o": {
            inputTokens: 1000,
            outputTokens: 500,
            totalCostUsd: "0.040000",
          },
        }),
      );

      const engine = new UsageSnapshotEngine(storage, captureFn);
      await engine.recordActivation("key-2", "openai", "gpt-4o");

      // captureUsage should NOT have been called since snapshot exists
      expect(captureFn).not.toHaveBeenCalled();

      // Only the original snapshot should exist
      const snapshots = storage.usageSnapshots.getRecent("key-2", "gpt-4o", 10);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].snapshotTime).toBe(t1);
    });
  });

  // ── Test 5: reconcileOnStartup with existing snapshot and new usage ──
  describe("reconcileOnStartup with existing snapshot and new usage", () => {
    it("creates gap record and fresh snapshot", async () => {
      vi.setSystemTime(new Date("2025-06-01T10:00:00Z"));
      const t1 = Date.now();

      storage.usageSnapshots.insert({
        keyId: "key-1",
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 100,
        cacheWriteTokens: 50,
        totalCostUsd: "0.050000",
        snapshotTime: t1,
      });

      vi.setSystemTime(new Date("2025-06-01T14:00:00Z"));
      const t2 = Date.now();

      const captureFn = makeCaptureFn({
        "anthropic/claude-sonnet-4-5-20250929": {
          inputTokens: 2000,
          outputTokens: 1000,
          cacheReadTokens: 300,
          cacheWriteTokens: 150,
          totalCostUsd: "0.100000",
        },
      });

      const engine = new UsageSnapshotEngine(storage, captureFn);
      await engine.reconcileOnStartup("key-1", "anthropic", "claude-sonnet-4-5-20250929");

      // History record for the gap
      const history = storage.keyUsageHistory.queryByWindow({
        keyId: "key-1",
        windowStart: 0,
        windowEnd: t2 + 1000,
      });
      expect(history).toHaveLength(1);
      expect(history[0].inputTokens).toBe(1000);
      expect(history[0].outputTokens).toBe(500);
      expect(history[0].cacheReadTokens).toBe(200);
      expect(history[0].cacheWriteTokens).toBe(100);
      expect(history[0].totalCostUsd).toBe("0.050000");
      expect(history[0].startTime).toBe(t1);
      expect(history[0].endTime).toBe(t2);

      // Fresh snapshot
      const snapshot = storage.usageSnapshots.getLatest("key-1", "claude-sonnet-4-5-20250929");
      expect(snapshot).toBeDefined();
      expect(snapshot!.inputTokens).toBe(2000);
      expect(snapshot!.snapshotTime).toBe(t2);
    });
  });

  // ── Test 6: reconcileOnStartup with no snapshot ──
  describe("reconcileOnStartup with no snapshot", () => {
    it("is a no-op when no previous snapshot exists", async () => {
      const captureFn = vi.fn(
        makeCaptureFn({
          "anthropic/claude-sonnet-4-5-20250929": {
            inputTokens: 1000,
            outputTokens: 500,
            totalCostUsd: "0.050000",
          },
        }),
      );

      const engine = new UsageSnapshotEngine(storage, captureFn);
      await engine.reconcileOnStartup("key-1", "anthropic", "claude-sonnet-4-5-20250929");

      // captureUsage should NOT have been called
      expect(captureFn).not.toHaveBeenCalled();

      // No snapshots should exist
      const snapshot = storage.usageSnapshots.getLatest("key-1", "claude-sonnet-4-5-20250929");
      expect(snapshot).toBeUndefined();

      // No history records
      const history = storage.keyUsageHistory.queryByWindow({
        keyId: "key-1",
        windowStart: 0,
        windowEnd: Date.now() + 1000,
      });
      expect(history).toHaveLength(0);
    });
  });

  // ── Test 7: reconcileOnStartup with no usage change ──
  describe("reconcileOnStartup with no usage change", () => {
    it("is a no-op when usage has not changed since last snapshot", async () => {
      vi.setSystemTime(new Date("2025-06-01T10:00:00Z"));
      const t1 = Date.now();

      storage.usageSnapshots.insert({
        keyId: "key-1",
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 100,
        cacheWriteTokens: 50,
        totalCostUsd: "0.050000",
        snapshotTime: t1,
      });

      vi.setSystemTime(new Date("2025-06-01T14:00:00Z"));

      // Return exactly the same values
      const captureFn = makeCaptureFn({
        "anthropic/claude-sonnet-4-5-20250929": {
          inputTokens: 1000,
          outputTokens: 500,
          cacheReadTokens: 100,
          cacheWriteTokens: 50,
          totalCostUsd: "0.050000",
        },
      });

      const engine = new UsageSnapshotEngine(storage, captureFn);
      await engine.reconcileOnStartup("key-1", "anthropic", "claude-sonnet-4-5-20250929");

      // No history records should be created
      const history = storage.keyUsageHistory.queryByWindow({
        keyId: "key-1",
        windowStart: 0,
        windowEnd: Date.now() + 1000,
      });
      expect(history).toHaveLength(0);

      // Only the original snapshot should exist
      const snapshots = storage.usageSnapshots.getRecent("key-1", "claude-sonnet-4-5-20250929", 10);
      expect(snapshots).toHaveLength(1);
      expect(snapshots[0].snapshotTime).toBe(t1);
    });
  });

  // ── Test 8: Snapshot pruning ──
  describe("snapshot pruning", () => {
    it("keeps only SNAPSHOT_KEEP_N (5) snapshots after many deactivations", async () => {
      let usageTokens = 0;
      const captureFn: CaptureUsageFn = async () => {
        usageTokens += 100;
        const map = new Map<string, ModelUsageTotals>();
        map.set(
          "anthropic/claude-sonnet-4-5-20250929",
          makeTotals({
            inputTokens: usageTokens,
            outputTokens: usageTokens / 2,
            totalCostUsd: (usageTokens * 0.0001).toFixed(6),
          }),
        );
        return map;
      };

      const engine = new UsageSnapshotEngine(storage, captureFn);

      // Perform 10 deactivation cycles
      for (let i = 0; i < 10; i++) {
        vi.setSystemTime(new Date(2025, 5, 1, 10 + i, 0, 0));
        await engine.recordDeactivation("key-1", "anthropic", "claude-sonnet-4-5-20250929");
      }

      // Only 5 snapshots should remain
      const snapshots = storage.usageSnapshots.getRecent(
        "key-1",
        "claude-sonnet-4-5-20250929",
        100,
      );
      expect(snapshots).toHaveLength(5);

      // The most recent snapshot should have the latest usage
      expect(snapshots[0].inputTokens).toBe(1000);
    });
  });

  // ── Test 9: Multiple models under same key ──
  describe("multiple models under same key", () => {
    it("deactivation only affects the specific model", async () => {
      vi.setSystemTime(new Date("2025-06-01T10:00:00Z"));
      const t1 = Date.now();

      // Insert snapshots for two models under the same key
      storage.usageSnapshots.insert({
        keyId: "key-1",
        provider: "anthropic",
        model: "claude-sonnet-4-5-20250929",
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalCostUsd: "0.050000",
        snapshotTime: t1,
      });

      storage.usageSnapshots.insert({
        keyId: "key-1",
        provider: "anthropic",
        model: "claude-opus-4-20250514",
        inputTokens: 2000,
        outputTokens: 800,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        totalCostUsd: "0.200000",
        snapshotTime: t1,
      });

      vi.setSystemTime(new Date("2025-06-01T12:00:00Z"));
      const t2 = Date.now();

      const captureFn = makeCaptureFn({
        "anthropic/claude-sonnet-4-5-20250929": {
          inputTokens: 3000,
          outputTokens: 1500,
          totalCostUsd: "0.150000",
        },
        "anthropic/claude-opus-4-20250514": {
          inputTokens: 5000,
          outputTokens: 2000,
          totalCostUsd: "0.500000",
        },
      });

      const engine = new UsageSnapshotEngine(storage, captureFn);

      // Deactivate only sonnet
      await engine.recordDeactivation("key-1", "anthropic", "claude-sonnet-4-5-20250929");

      // History should only have sonnet record
      const history = storage.keyUsageHistory.queryByWindow({
        keyId: "key-1",
        windowStart: 0,
        windowEnd: t2 + 1000,
      });
      expect(history).toHaveLength(1);
      expect(history[0].model).toBe("claude-sonnet-4-5-20250929");
      expect(history[0].inputTokens).toBe(2000);

      // Opus snapshot should be unchanged
      const opusSnapshot = storage.usageSnapshots.getLatest("key-1", "claude-opus-4-20250514");
      expect(opusSnapshot).toBeDefined();
      expect(opusSnapshot!.inputTokens).toBe(2000); // Still the original value
      expect(opusSnapshot!.snapshotTime).toBe(t1); // Still the original time

      // Sonnet should have updated snapshot
      const sonnetSnapshot = storage.usageSnapshots.getLatest(
        "key-1",
        "claude-sonnet-4-5-20250929",
      );
      expect(sonnetSnapshot).toBeDefined();
      expect(sonnetSnapshot!.inputTokens).toBe(3000);
      expect(sonnetSnapshot!.snapshotTime).toBe(t2);
    });
  });
});
