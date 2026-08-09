import { existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const PAIRING_ALLOW_TABLE = "channel_pairing_allow_entries";

function normalizeKey(value: string, fallback: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized || fallback;
}

function resolveStateDatabasePath(stateDir: string): string {
  return join(stateDir, "state", "openclaw.sqlite");
}

function tableExists(database: DatabaseSync): boolean {
  return Boolean(
    database
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(PAIRING_ALLOW_TABLE),
  );
}

function openStateDatabase(stateDir: string, readOnly: boolean): DatabaseSync | undefined {
  const databasePath = resolveStateDatabasePath(stateDir);
  if (!existsSync(databasePath)) return undefined;
  const database = new DatabaseSync(databasePath, { readOnly, timeout: 5_000 });
  if (!readOnly) database.exec("PRAGMA busy_timeout = 5000");
  return database;
}

export function readVendorChannelAllowFrom(
  stateDir: string,
  channelId: string,
  accountId?: string,
): string[] {
  const database = openStateDatabase(stateDir, true);
  if (!database) return [];
  try {
    if (!tableExists(database)) return [];
    const rows = database
      .prepare(
        `SELECT entry
         FROM channel_pairing_allow_entries
         WHERE channel_key = ? AND account_id = ?
         ORDER BY sort_order ASC, entry ASC`,
      )
      .all(normalizeKey(channelId, "unknown"), normalizeKey(accountId ?? "", "default")) as Array<{
      entry: unknown;
    }>;
    return rows.flatMap((row) =>
      typeof row.entry === "string" && row.entry.trim() && row.entry !== "*"
        ? [row.entry.trim()]
        : [],
    );
  } finally {
    database.close();
  }
}

export function addVendorChannelAllowFromEntry(
  stateDir: string,
  channelId: string,
  accountId: string | undefined,
  entry: string,
): boolean {
  const normalizedEntry = entry.trim();
  if (!normalizedEntry || normalizedEntry === "*") return false;
  const database = openStateDatabase(stateDir, false);
  if (!database) {
    throw new Error("OpenClaw shared state database is unavailable");
  }
  try {
    if (!tableExists(database)) {
      throw new Error("OpenClaw channel pairing state is unavailable");
    }
    const channelKey = normalizeKey(channelId, "unknown");
    const accountKey = normalizeKey(accountId ?? "", "default");
    database.exec("BEGIN IMMEDIATE");
    try {
      const existing = database
        .prepare(
          `SELECT 1 FROM channel_pairing_allow_entries
           WHERE channel_key = ? AND account_id = ? AND entry = ?`,
        )
        .get(channelKey, accountKey, normalizedEntry);
      if (existing) {
        database.exec("COMMIT");
        return false;
      }
      const nextSortOrder = Number(
        (
          database
            .prepare(
              `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_sort_order
               FROM channel_pairing_allow_entries
               WHERE channel_key = ? AND account_id = ?`,
            )
            .get(channelKey, accountKey) as { next_sort_order?: unknown } | undefined
        )?.next_sort_order ?? 0,
      );
      database
        .prepare(
          `INSERT INTO channel_pairing_allow_entries
           (channel_key, account_id, entry, sort_order, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(channelKey, accountKey, normalizedEntry, nextSortOrder, Date.now());
      database.exec("COMMIT");
      return true;
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  } finally {
    database.close();
  }
}

export function removeVendorChannelAllowFromEntry(
  stateDir: string,
  channelId: string,
  accountId: string | undefined,
  entry: string,
): boolean {
  const database = openStateDatabase(stateDir, false);
  if (!database) return false;
  try {
    if (!tableExists(database)) return false;
    const result = database
      .prepare(
        `DELETE FROM channel_pairing_allow_entries
         WHERE channel_key = ? AND account_id = ? AND entry = ?`,
      )
      .run(
        normalizeKey(channelId, "unknown"),
        normalizeKey(accountId ?? "", "default"),
        entry.trim(),
      );
    return Number(result.changes) > 0;
  } finally {
    database.close();
  }
}

export function clearVendorChannelAllowFrom(
  stateDir: string,
  channelId: string,
  accountId?: string,
): number {
  const database = openStateDatabase(stateDir, false);
  if (!database) return 0;
  try {
    if (!tableExists(database)) return 0;
    const channelKey = normalizeKey(channelId, "unknown");
    const result = accountId
      ? database
          .prepare(
            "DELETE FROM channel_pairing_allow_entries WHERE channel_key = ? AND account_id = ?",
          )
          .run(channelKey, normalizeKey(accountId, "default"))
      : database
          .prepare("DELETE FROM channel_pairing_allow_entries WHERE channel_key = ?")
          .run(channelKey);
    return Number(result.changes);
  } finally {
    database.close();
  }
}
