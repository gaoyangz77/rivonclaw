import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  closeOpenClawAgentDatabasesForTest,
  ensureOpenClawAgentDatabaseSchema,
  openOpenClawAgentDatabase,
  OPENCLAW_AGENT_SCHEMA_VERSION,
  withAgentDatabaseMaintenanceLease,
} from "@vendor/state/openclaw-agent-db.js";
import { withLegacySessionParticipantsSchema } from "@vendor/state/openclaw-agent-participants-migration.js";
import { sessionParticipantsSchemaSql } from "@vendor/state/openclaw-agent-session-participants-schema.js";
import {
  closeOpenClawStateDatabaseForTest,
  openOpenClawStateDatabase,
} from "@vendor/state/openclaw-state-db.js";

const roots: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  closeOpenClawAgentDatabasesForTest();
  closeOpenClawStateDatabaseForTest();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "retirement-0041-"));
  roots.push(root);
  const env = { ...process.env, OPENCLAW_STATE_DIR: root };
  openOpenClawStateDatabase({ env });
  const initial = openOpenClawAgentDatabase({ agentId: "main", env });
  const path = initial.path;
  initial.db.exec(`
    INSERT INTO cache_entries (scope, key, value_json, expires_at, updated_at)
      VALUES ('audit', 'preserved', '{"preserved":true}', 100, 1);
    DROP TABLE IF EXISTS session_participants;
    DROP TRIGGER session_conversations_route_context_invalidate_after_update;
    ALTER TABLE session_conversations DROP COLUMN route_context_json;
    DROP INDEX idx_agent_transcript_event_identity_sequence;
    PRAGMA user_version = 17;
    UPDATE schema_meta SET schema_version = 17;
  `);
  closeOpenClawAgentDatabasesForTest();
  const db = new DatabaseSync(path);
  const migrate = () =>
    withAgentDatabaseMaintenanceLease({ env }, async () =>
      ensureOpenClawAgentDatabaseSchema(db, { agentId: "main", path, env }),
    );
  return { db, migrate };
}

function snapshot(db: DatabaseSync) {
  return {
    schema: db.prepare("SELECT type, name, sql FROM sqlite_schema ORDER BY name").all(),
    meta: db.prepare("SELECT * FROM schema_meta ORDER BY meta_key").all(),
    data: db.prepare("SELECT * FROM cache_entries ORDER BY scope, key").all(),
    version: db.prepare("PRAGMA user_version").get(),
  };
}

describe("0041 pristine schema-17 additive repair", () => {
  it("repairs column, trigger and index, preserves data, and is idempotent", async () => {
    const { db, migrate } = fixture();
    try {
      await migrate();
      expect(db.prepare("PRAGMA user_version").get()?.user_version).toBe(
        OPENCLAW_AGENT_SCHEMA_VERSION,
      );
      expect(db.prepare("SELECT schema_version FROM schema_meta").get()?.schema_version).toBe(
        OPENCLAW_AGENT_SCHEMA_VERSION,
      );
      expect(
        db
          .prepare(
            "SELECT name FROM pragma_table_info('session_conversations') WHERE name = 'route_context_json'",
          )
          .get(),
      ).toEqual({ name: "route_context_json" });
      for (const name of [
        "session_conversations_route_context_invalidate_after_update",
        "idx_agent_transcript_event_identity_sequence",
      ]) {
        expect(db.prepare("SELECT name FROM sqlite_schema WHERE name = ?").get(name)).toEqual({
          name,
        });
      }
      expect(
        db.prepare("SELECT value_json FROM cache_entries WHERE scope = 'audit'").get(),
      ).toEqual({ value_json: '{"preserved":true}' });
      const before = snapshot(db);
      await migrate();
      expect(snapshot(db)).toEqual(before);
      expect(db.prepare("PRAGMA integrity_check").get()?.integrity_check).toBe("ok");
      expect(db.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("leaves every repair and version marker rolled back after rejected drift", async () => {
    const { db, migrate } = fixture();
    try {
      db.exec(withLegacySessionParticipantsSchema(sessionParticipantsSchemaSql()));
      db.exec("ALTER TABLE session_participants ADD COLUMN retirement_unknown TEXT;");
      const before = snapshot(db);
      await expect(migrate()).rejects.toThrow(/column|schema/i);
      expect(snapshot(db)).toEqual(before);
      expect(db.prepare("PRAGMA foreign_keys").get()?.foreign_keys).toBe(1);
    } finally {
      db.close();
    }
  });

  it("rolls back an interruption after additive DDL and succeeds on retry", async () => {
    const { db, migrate } = fixture();
    try {
      const before = snapshot(db);
      const exec = db.exec.bind(db);
      const fault = vi.spyOn(db, "exec").mockImplementation((sql) => {
        exec(sql);
        if (sql.includes("ADD COLUMN route_context_json"))
          throw new Error("audit interrupted additive DDL");
      });
      await expect(migrate()).rejects.toThrow("audit interrupted additive DDL");
      fault.mockRestore();
      expect(snapshot(db)).toEqual(before);
      await migrate();
      expect(db.prepare("PRAGMA user_version").get()?.user_version).toBe(
        OPENCLAW_AGENT_SCHEMA_VERSION,
      );
    } finally {
      db.close();
    }
  });
});
