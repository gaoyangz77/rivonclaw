import type Database from "better-sqlite3";

export interface CsEscalation {
  id: string;
  conversationId: string;
  shopId: string;
  buyerUserId: string;
  reason: string;
  context?: string;
  createdAt: number;
  result?: {
    decision: string;
    instructions: string;
    resolved: boolean;
    resolvedAt: number;
  };
}

interface CsEscalationRow {
  id: string;
  conversation_id: string;
  shop_id: string;
  buyer_user_id: string;
  reason: string;
  context: string | null;
  created_at: number;
  decision: string | null;
  instructions: string | null;
  resolved: number;
  resolved_at: number | null;
}

function rowToEscalation(row: CsEscalationRow): CsEscalation {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    shopId: row.shop_id,
    buyerUserId: row.buyer_user_id,
    reason: row.reason,
    context: row.context ?? undefined,
    createdAt: row.created_at,
    result:
      row.decision != null
        ? {
            decision: row.decision,
            instructions: row.instructions ?? "",
            resolved: row.resolved === 1,
            resolvedAt: row.resolved_at ?? row.created_at,
          }
        : undefined,
  };
}

export class CsEscalationsRepository {
  constructor(private db: Database.Database) {}

  /** Insert or replace an escalation record. */
  save(escalation: CsEscalation): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO cs_escalations
           (id, conversation_id, shop_id, buyer_user_id, reason, context, created_at, decision, instructions, resolved, resolved_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        escalation.id,
        escalation.conversationId,
        escalation.shopId,
        escalation.buyerUserId,
        escalation.reason,
        escalation.context ?? null,
        escalation.createdAt,
        escalation.result?.decision ?? null,
        escalation.result?.instructions ?? null,
        escalation.result?.resolved ? 1 : 0,
        escalation.result?.resolvedAt ?? null,
      );
  }

  /** Update the result fields of an existing escalation. */
  updateResult(
    id: string,
    result: { decision: string; instructions: string; resolved: boolean; resolvedAt: number },
  ): void {
    this.db
      .prepare(
        `UPDATE cs_escalations
         SET decision = ?, instructions = ?, resolved = ?, resolved_at = ?
         WHERE id = ?`,
      )
      .run(result.decision, result.instructions, result.resolved ? 1 : 0, result.resolvedAt, id);
  }

  /** Get a single escalation by ID. */
  getById(id: string): CsEscalation | undefined {
    const row = this.db
      .prepare("SELECT * FROM cs_escalations WHERE id = ?")
      .get(id) as CsEscalationRow | undefined;
    return row ? rowToEscalation(row) : undefined;
  }

  /** Get all escalations for a conversation, ordered by creation time ascending. */
  getByConversationId(conversationId: string): CsEscalation[] {
    const rows = this.db
      .prepare("SELECT * FROM cs_escalations WHERE conversation_id = ? ORDER BY created_at ASC")
      .all(conversationId) as CsEscalationRow[];
    return rows.map(rowToEscalation);
  }
}
