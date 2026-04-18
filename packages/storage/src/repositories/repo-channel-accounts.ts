import type Database from "better-sqlite3";

export interface ChannelAccount {
  channelId: string;
  accountId: string;
  name: string | null;
  config: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

interface ChannelAccountRow {
  channel_id: string;
  account_id: string;
  name: string | null;
  config: string;
  created_at: number;
  updated_at: number;
}

function rowToChannelAccount(row: ChannelAccountRow): ChannelAccount {
  return {
    channelId: row.channel_id,
    accountId: row.account_id,
    name: row.name,
    config: JSON.parse(row.config) as Record<string, unknown>,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ChannelAccountsRepository {
  constructor(private db: Database.Database) {}

  /** Insert or update a channel account config (secrets excluded). */
  upsert(channelId: string, accountId: string, name: string | null, config: Record<string, unknown>): ChannelAccount {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO channel_accounts (channel_id, account_id, name, config, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (channel_id, account_id)
         DO UPDATE SET name = excluded.name, config = excluded.config, updated_at = excluded.updated_at`,
      )
      .run(channelId, accountId, name, JSON.stringify(config), now, now);
    return { channelId, accountId, name, config, createdAt: now, updatedAt: now };
  }

  /** Get a single channel account. */
  get(channelId: string, accountId: string): ChannelAccount | undefined {
    const row = this.db
      .prepare("SELECT * FROM channel_accounts WHERE channel_id = ? AND account_id = ?")
      .get(channelId, accountId) as ChannelAccountRow | undefined;
    return row ? rowToChannelAccount(row) : undefined;
  }

  /** List all channel accounts, optionally filtered by channelId. */
  list(channelId?: string): ChannelAccount[] {
    if (channelId) {
      const rows = this.db
        .prepare("SELECT * FROM channel_accounts WHERE channel_id = ? ORDER BY updated_at DESC")
        .all(channelId) as ChannelAccountRow[];
      return rows.map(rowToChannelAccount);
    }
    const rows = this.db
      .prepare("SELECT * FROM channel_accounts ORDER BY channel_id, updated_at DESC")
      .all() as ChannelAccountRow[];
    return rows.map(rowToChannelAccount);
  }

  /** Delete a channel account. */
  delete(channelId: string, accountId: string): boolean {
    const result = this.db
      .prepare("DELETE FROM channel_accounts WHERE channel_id = ? AND account_id = ?")
      .run(channelId, accountId);
    return result.changes > 0;
  }
}
