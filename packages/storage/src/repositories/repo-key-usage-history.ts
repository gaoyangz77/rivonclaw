import type Database from "better-sqlite3";
import type { KeyModelUsageRecord, KeyUsageQueryParams, KeyUsageDailyBucket } from "@rivonclaw/core";

interface HistoryRow {
  id: number;
  key_id: string;
  provider: string;
  model: string;
  start_time: number;
  end_time: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  total_cost_usd: string;
  created_at: string;
}

function rowToRecord(row: HistoryRow): KeyModelUsageRecord {
  return {
    keyId: row.key_id,
    provider: row.provider,
    model: row.model,
    startTime: row.start_time,
    endTime: row.end_time,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheReadTokens: row.cache_read_tokens,
    cacheWriteTokens: row.cache_write_tokens,
    totalCostUsd: row.total_cost_usd,
  };
}

export class KeyUsageHistoryRepository {
  constructor(private db: Database.Database) {}

  insert(record: KeyModelUsageRecord): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO key_model_usage_history
          (key_id, provider, model, start_time, end_time, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, total_cost_usd, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.keyId,
        record.provider,
        record.model,
        record.startTime,
        record.endTime,
        record.inputTokens,
        record.outputTokens,
        record.cacheReadTokens,
        record.cacheWriteTokens,
        record.totalCostUsd,
        now,
      );
  }

  /**
   * Query historical records within a time window.
   * Returns records where end_time falls within [windowStart, windowEnd].
   * Supports optional filters on keyId, provider, model.
   */
  queryByWindow(params: KeyUsageQueryParams): KeyModelUsageRecord[] {
    const conditions = ["end_time >= ? AND end_time <= ?"];
    const args: (string | number)[] = [params.windowStart, params.windowEnd];

    if (params.keyId) {
      conditions.push("key_id = ?");
      args.push(params.keyId);
    }
    if (params.provider) {
      conditions.push("provider = ?");
      args.push(params.provider);
    }
    if (params.model) {
      conditions.push("model = ?");
      args.push(params.model);
    }

    const sql = `SELECT * FROM key_model_usage_history
      WHERE ${conditions.join(" AND ")}
      ORDER BY end_time DESC`;

    const rows = this.db.prepare(sql).all(...args) as HistoryRow[];
    return rows.map(rowToRecord);
  }

  /**
   * Query historical records bucketed by day within a time window.
   * Returns one row per (key_id, provider, model, day).
   * keyLabel is NOT populated here — the caller must enrich it.
   */
  queryByDay(params: KeyUsageQueryParams): Omit<KeyUsageDailyBucket, "keyLabel">[] {
    const MS_PER_DAY = 86_400_000;
    const conditions = ["end_time >= ? AND end_time <= ?"];
    const args: (string | number)[] = [params.windowStart, params.windowEnd];

    if (params.keyId) {
      conditions.push("key_id = ?");
      args.push(params.keyId);
    }
    if (params.provider) {
      conditions.push("provider = ?");
      args.push(params.provider);
    }
    if (params.model) {
      conditions.push("model = ?");
      args.push(params.model);
    }

    const sql = `
      SELECT
        key_id,
        provider,
        model,
        (end_time / ${MS_PER_DAY}) AS day_bucket,
        SUM(input_tokens) AS input_tokens,
        SUM(output_tokens) AS output_tokens,
        SUM(CAST(total_cost_usd AS REAL)) AS total_cost_usd
      FROM key_model_usage_history
      WHERE ${conditions.join(" AND ")}
      GROUP BY key_id, provider, model, day_bucket
      ORDER BY day_bucket ASC`;

    interface DailyRow {
      key_id: string;
      provider: string;
      model: string;
      day_bucket: number;
      input_tokens: number;
      output_tokens: number;
      total_cost_usd: number;
    }

    const rows = this.db.prepare(sql).all(...args) as DailyRow[];
    return rows.map((r) => {
      const dateMs = r.day_bucket * MS_PER_DAY;
      const d = new Date(dateMs);
      const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
      return {
        keyId: r.key_id,
        provider: r.provider,
        model: r.model,
        date,
        inputTokens: r.input_tokens,
        outputTokens: r.output_tokens,
        totalCostUsd: r.total_cost_usd.toFixed(6),
      };
    });
  }
}
