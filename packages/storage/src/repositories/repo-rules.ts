import type Database from "better-sqlite3";
import type { Rule } from "@rivonclaw/core";

interface RuleRow {
  id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

function rowToRule(row: RuleRow): Rule {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class RulesRepository {
  constructor(private db: Database.Database) {}

  create(rule: Omit<Rule, "createdAt" | "updatedAt"> & { createdAt?: string; updatedAt?: string }): Rule {
    const now = new Date().toISOString();
    const createdAt = rule.createdAt ?? now;
    const updatedAt = rule.updatedAt ?? now;

    this.db
      .prepare(
        "INSERT INTO rules (id, text, created_at, updated_at) VALUES (?, ?, ?, ?)",
      )
      .run(rule.id, rule.text, createdAt, updatedAt);

    return { id: rule.id, text: rule.text, createdAt, updatedAt };
  }

  getById(id: string): Rule | undefined {
    const row = this.db
      .prepare("SELECT * FROM rules WHERE id = ?")
      .get(id) as RuleRow | undefined;
    return row ? rowToRule(row) : undefined;
  }

  getAll(): Rule[] {
    const rows = this.db
      .prepare("SELECT * FROM rules ORDER BY created_at ASC")
      .all() as RuleRow[];
    return rows.map(rowToRule);
  }

  update(id: string, fields: Partial<Pick<Rule, "text">>): Rule | undefined {
    const existing = this.getById(id);
    if (!existing) return undefined;

    const updatedAt = new Date().toISOString();
    const text = fields.text ?? existing.text;

    this.db
      .prepare("UPDATE rules SET text = ?, updated_at = ? WHERE id = ?")
      .run(text, updatedAt, id);

    return { ...existing, text, updatedAt };
  }

  delete(id: string): boolean {
    const result = this.db.prepare("DELETE FROM rules WHERE id = ?").run(id);
    return result.changes > 0;
  }
}
