import type Database from "better-sqlite3";

export interface CsEscalationResponseHistoryEntry {
  ownerId: string;
  channelId: string;
  callbackId: string;
  escalationId: string;
  accountId: string;
  messageId: string;
  operatorId: string;
  decision: string;
  resolved: boolean;
  submittedAt: number;
  version?: number | null;
}

type HistoryRow = {
  owner_id: string;
  channel_id: string;
  callback_id: string;
  escalation_id: string;
  account_id: string;
  message_id: string;
  operator_id: string;
  decision: string;
  resolved: number;
  submitted_at: number;
  version: number | null;
};

function rowToEntry(row: HistoryRow): CsEscalationResponseHistoryEntry {
  return {
    ownerId: row.owner_id,
    channelId: row.channel_id,
    callbackId: row.callback_id,
    escalationId: row.escalation_id,
    accountId: row.account_id,
    messageId: row.message_id,
    operatorId: row.operator_id,
    decision: row.decision,
    resolved: row.resolved === 1,
    submittedAt: row.submitted_at,
    version: row.version,
  };
}

/** Durable, channel-neutral history used to rebuild interactive escalation messages. */
export class CsEscalationResponseHistoryRepository {
  constructor(private readonly db: Database.Database) {}

  append(entry: CsEscalationResponseHistoryEntry): boolean {
    const result = this.db
      .prepare(
        `INSERT OR IGNORE INTO cs_escalation_response_history
           (owner_id, channel_id, callback_id, escalation_id, account_id, message_id, operator_id,
            decision, resolved, submitted_at, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.ownerId,
        entry.channelId,
        entry.callbackId,
        entry.escalationId,
        entry.accountId,
        entry.messageId,
        entry.operatorId,
        entry.decision,
        entry.resolved ? 1 : 0,
        entry.submittedAt,
        entry.version ?? null,
      );
    return result.changes === 1;
  }

  hasCallback(ownerId: string, channelId: string, callbackId: string): boolean {
    return Boolean(
      this.db
        .prepare(
          `SELECT 1 FROM cs_escalation_response_history
           WHERE owner_id = ? AND channel_id = ? AND callback_id = ?`,
        )
        .get(ownerId, channelId, callbackId),
    );
  }

  listByEscalationId(
    ownerId: string,
    escalationId: string,
    limit = 5,
  ): CsEscalationResponseHistoryEntry[] {
    const rows = this.db
      .prepare(
        `SELECT owner_id, channel_id, callback_id, escalation_id, account_id, message_id, operator_id,
                decision, resolved, submitted_at, version
         FROM cs_escalation_response_history
         WHERE owner_id = ? AND escalation_id = ?
         ORDER BY submitted_at DESC, rowid DESC
         LIMIT ?`,
      )
      .all(ownerId, escalationId, Math.max(1, limit)) as HistoryRow[];
    return rows.reverse().map(rowToEntry);
  }

  countByEscalationId(ownerId: string, escalationId: string): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS count FROM cs_escalation_response_history
         WHERE owner_id = ? AND escalation_id = ?`,
      )
      .get(ownerId, escalationId) as { count: number };
    return row.count;
  }
}
