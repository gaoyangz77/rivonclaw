import type Database from "better-sqlite3";
import type { ChannelConfig } from "@rivonclaw/core";

interface ChannelRow {
  id: string;
  channel_type: string;
  enabled: number;
  account_id: string;
  settings: string;
}

function rowToChannel(row: ChannelRow): ChannelConfig {
  return {
    id: row.id,
    channelType: row.channel_type,
    enabled: row.enabled === 1,
    accountId: row.account_id,
    settings: JSON.parse(row.settings) as Record<string, unknown>,
  };
}

export class ChannelsRepository {
  constructor(private db: Database.Database) {}

  create(channel: ChannelConfig): ChannelConfig {
    this.db
      .prepare(
        "INSERT INTO channels (id, channel_type, enabled, account_id, settings) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        channel.id,
        channel.channelType,
        channel.enabled ? 1 : 0,
        channel.accountId,
        JSON.stringify(channel.settings),
      );

    return channel;
  }

  getById(id: string): ChannelConfig | undefined {
    const row = this.db
      .prepare("SELECT * FROM channels WHERE id = ?")
      .get(id) as ChannelRow | undefined;
    return row ? rowToChannel(row) : undefined;
  }

  getAll(): ChannelConfig[] {
    const rows = this.db
      .prepare("SELECT * FROM channels ORDER BY id ASC")
      .all() as ChannelRow[];
    return rows.map(rowToChannel);
  }

  update(
    id: string,
    fields: Partial<Omit<ChannelConfig, "id">>,
  ): ChannelConfig | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const updated: ChannelConfig = {
      ...existing,
      channelType: fields.channelType ?? existing.channelType,
      enabled: fields.enabled !== undefined ? fields.enabled : existing.enabled,
      accountId: fields.accountId ?? existing.accountId,
      settings: fields.settings ?? existing.settings,
    };

    this.db
      .prepare(
        "UPDATE channels SET channel_type = ?, enabled = ?, account_id = ?, settings = ? WHERE id = ?",
      )
      .run(
        updated.channelType,
        updated.enabled ? 1 : 0,
        updated.accountId,
        JSON.stringify(updated.settings),
        id,
      );

    return updated;
  }

  delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM channels WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
