import type Database from "better-sqlite3";

export interface ChannelRecipient {
  channelId: string;
  recipientId: string;
  label: string;
  isOwner: boolean;
  createdAt: number;
  updatedAt: number;
}

interface ChannelRecipientRow {
  channel_id: string;
  recipient_id: string;
  label: string;
  is_owner: number;
  created_at: number;
  updated_at: number;
}

function rowToRecipient(row: ChannelRecipientRow): ChannelRecipient {
  return {
    channelId: row.channel_id,
    recipientId: row.recipient_id,
    label: row.label,
    isOwner: !!row.is_owner,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ChannelRecipientsRepository {
  constructor(private db: Database.Database) {}

  /** Get all recipients for a channel, returned as a map of recipientId → label. */
  getLabels(channelId: string): Record<string, string> {
    const rows = this.db
      .prepare("SELECT recipient_id, label FROM channel_recipients WHERE channel_id = ? AND label != ''")
      .all(channelId) as Array<{ recipient_id: string; label: string }>;
    const labels: Record<string, string> = {};
    for (const row of rows) {
      labels[row.recipient_id] = row.label;
    }
    return labels;
  }

  /** Get labels and owner flags for a channel. */
  getRecipientMeta(channelId: string): Record<string, { label: string; isOwner: boolean }> {
    const rows = this.db
      .prepare("SELECT recipient_id, label, is_owner FROM channel_recipients WHERE channel_id = ?")
      .all(channelId) as Array<{ recipient_id: string; label: string; is_owner: number }>;
    const result: Record<string, { label: string; isOwner: boolean }> = {};
    for (const row of rows) {
      result[row.recipient_id] = { label: row.label, isOwner: !!row.is_owner };
    }
    return result;
  }

  /** Set or update the label for a recipient. Preserves is_owner on conflict. */
  setLabel(channelId: string, recipientId: string, label: string): ChannelRecipient {
    const now = Date.now();
    this.db
      .prepare(
        `INSERT INTO channel_recipients (channel_id, recipient_id, label, is_owner, created_at, updated_at)
         VALUES (?, ?, ?, 0, ?, ?)
         ON CONFLICT (channel_id, recipient_id)
         DO UPDATE SET label = excluded.label, updated_at = excluded.updated_at`,
      )
      .run(channelId, recipientId, label, now, now);
    return { channelId, recipientId, label, isOwner: false, createdAt: now, updatedAt: now };
  }

  /**
   * Ensure a recipient row exists.
   * Returns true when a new row was inserted, false when the row already existed.
   */
  ensureExists(channelId: string, recipientId: string, isOwner = false): boolean {
    const now = Date.now();
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO channel_recipients (channel_id, recipient_id, label, is_owner, created_at, updated_at)
         VALUES (?, ?, '', ?, ?, ?)`,
      )
      .run(channelId, recipientId, isOwner ? 1 : 0, now, now);
    return result.changes > 0;
  }

  /** Set or clear the owner flag for a recipient. */
  setOwner(channelId: string, recipientId: string, isOwner: boolean): void {
    const now = Date.now();
    this.db
      .prepare("UPDATE channel_recipients SET is_owner = ?, updated_at = ? WHERE channel_id = ? AND recipient_id = ?")
      .run(isOwner ? 1 : 0, now, channelId, recipientId);
  }

  /** Get all owner recipients across all channels. */
  getOwners(): Array<{ channelId: string; recipientId: string }> {
    const rows = this.db
      .prepare("SELECT channel_id, recipient_id FROM channel_recipients WHERE is_owner = 1")
      .all() as Array<{ channel_id: string; recipient_id: string }>;
    return rows.map((r) => ({ channelId: r.channel_id, recipientId: r.recipient_id }));
  }

  /** Check whether any owner recipient exists globally. */
  hasAnyOwner(): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM channel_recipients WHERE is_owner = 1 LIMIT 1")
      .get();
    return !!row;
  }

  /** Delete a recipient. */
  delete(channelId: string, recipientId: string): boolean {
    const result = this.db
      .prepare("DELETE FROM channel_recipients WHERE channel_id = ? AND recipient_id = ?")
      .run(channelId, recipientId);
    return result.changes > 0;
  }

  /** List all recipients for a channel. */
  list(channelId: string): ChannelRecipient[] {
    const rows = this.db
      .prepare("SELECT * FROM channel_recipients WHERE channel_id = ? ORDER BY updated_at DESC")
      .all(channelId) as ChannelRecipientRow[];
    return rows.map(rowToRecipient);
  }
}
