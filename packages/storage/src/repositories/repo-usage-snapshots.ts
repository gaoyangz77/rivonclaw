import type Database from "better-sqlite3";
import type { UsageSnapshot } from "@rivonclaw/core";

interface SnapshotRow {
  id: number;
  key_id: string;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_cost_usd: string;
  snapshot_time: number;
  created_at: string;
}

function rowToSnapshot(row: SnapshotRow): UsageSnapshot {
  return {
    keyId: row.key_id,
    provider: row.provider,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheWriteTokens: row.cache_write_tokens,
    totalCostUsd: row.total_cost_usd,
    snapshotTime: row.snapshot_time,
  };
}

export class UsageSnapshotsRepository {
  constructor(private db: Database.Database) {}

  insert(snapshot: UsageSnapshot): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO usage_snapshots
          (key_id, provider, model, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_cost_usd, snapshot_time, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        snapshot.keyId,
        snapshot.provider,
        snapshot.model,
        snapshot.inputTokens,
        snapshot.outputTokens,
        snapshot.cacheReadTokens,
        snapshot.cacheWriteTokens,
        snapshot.totalCostUsd,
        snapshot.snapshotTime,
        now,
      );
  }

  /** Most recent snapshot for a key/model pair. */
  getLatest(keyId: string, model: string): UsageSnapshot | undefined {
    const row = this.db
      .prepare(
        "SELECT * FROM usage_snapshots WHERE key_id = ? AND model = ? ORDER BY snapshot_time DESC LIMIT 1",
      )
      .get(keyId, model) as SnapshotRow | undefined;
    return row ? rowToSnapshot(row) : undefined;
  }

  /** Last N snapshots for a key/model pair (newest first). */
  getRecent(keyId: string, model: string, n: number): UsageSnapshot[] {
    const rows = this.db
      .prepare(
        "SELECT * FROM usage_snapshots WHERE key_id = ? AND model = ? ORDER BY snapshot_time DESC LIMIT ?",
      )
      .all(keyId, model, n) as SnapshotRow[];
    return rows.map(rowToSnapshot);
  }

  /** Delete snapshots older than the Nth most recent for a key/model pair. */
  pruneOld(keyId: string, model: string, keepN: number): number {
    const result = this.db
      .prepare(
        `DELETE FROM usage_snapshots
         WHERE key_id = ? AND model = ? AND id NOT IN (
           SELECT id FROM usage_snapshots
           WHERE key_id = ? AND model = ?
           ORDER BY snapshot_time DESC LIMIT ?
         )`,
      )
      .run(keyId, model, keyId, model, keepN);
    return result.changes;
  }
}
