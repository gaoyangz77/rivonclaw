import type Database from "better-sqlite3";
import type { RuleArtifact, ArtifactType, ArtifactStatus } from "@rivonclaw/core";

interface ArtifactRow {
  id: string;
  rule_id: string;
  type: string;
  content: string;
  output_path: string | null;
  status: string;
  compiled_at: string;
}

function rowToArtifact(row: ArtifactRow): RuleArtifact {
  return {
    id: row.id,
    ruleId: row.rule_id,
    type: row.type as ArtifactType,
    content: row.content,
    outputPath: row.output_path ?? undefined,
    status: row.status as ArtifactStatus,
    compiledAt: row.compiled_at,
  };
}

export class ArtifactsRepository {
  constructor(private db: Database.Database) {}

  create(artifact: RuleArtifact): RuleArtifact {
    this.db
      .prepare(
        "INSERT INTO artifacts (id, rule_id, type, content, output_path, status, compiled_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .run(
        artifact.id,
        artifact.ruleId,
        artifact.type,
        artifact.content,
        artifact.outputPath ?? null,
        artifact.status,
        artifact.compiledAt,
      );

    return artifact;
  }

  getByRuleId(ruleId: string): RuleArtifact[] {
    const rows = this.db
      .prepare("SELECT * FROM artifacts WHERE rule_id = ? ORDER BY compiled_at ASC")
      .all(ruleId) as ArtifactRow[];
    return rows.map(rowToArtifact);
  }

  getAll(): RuleArtifact[] {
    const rows = this.db
      .prepare("SELECT * FROM artifacts ORDER BY compiled_at ASC")
      .all() as ArtifactRow[];
    return rows.map(rowToArtifact);
  }

  update(
    id: string,
    fields: Partial<Pick<RuleArtifact, "content" | "outputPath" | "status" | "compiledAt">>,
  ): RuleArtifact | undefined {
    const row = this.db
      .prepare("SELECT * FROM artifacts WHERE id = ?")
      .get(id) as ArtifactRow | undefined;
    if (!row) return undefined;

    const existing = rowToArtifact(row);
    const updated: RuleArtifact = {
      ...existing,
      content: fields.content ?? existing.content,
      outputPath: fields.outputPath !== undefined ? fields.outputPath : existing.outputPath,
      status: fields.status ?? existing.status,
      compiledAt: fields.compiledAt ?? existing.compiledAt,
    };

    this.db
      .prepare(
        "UPDATE artifacts SET content = ?, output_path = ?, status = ?, compiled_at = ? WHERE id = ?",
      )
      .run(
        updated.content,
        updated.outputPath ?? null,
        updated.status,
        updated.compiledAt,
        id,
      );

    return updated;
  }

  deleteByRuleId(ruleId: string): number {
    const result = this.db
      .prepare("DELETE FROM artifacts WHERE rule_id = ?")
      .run(ruleId);
    return result.changes;
  }
}
