import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { inspectVendorStateMigration, migrateVendorStateBeforeGateway } from "./state-migration.js";

const tempDirs: string[] = [];

// Minimal SDK contract fixtures exercise the host adapter independently of the
// provisioned vendor. The companion state-migration tests cover the real runtime.
function makeFixture(ready = false) {
  const root = mkdtempSync(join(tmpdir(), "vendor-schema-readiness-"));
  tempDirs.push(root);
  const stateDir = join(root, "state");
  const vendorDir = join(root, "vendor");
  const sdkDir = join(vendorDir, "dist", "plugin-sdk");
  const agentDir = join(stateDir, "agents", "main", "agent");
  mkdirSync(sdkDir, { recursive: true });
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(
    join(vendorDir, "package.json"),
    JSON.stringify({
      type: "module",
      openclaw: { schemaVersions: { state: 16, agent: 19 } },
    }),
  );
  writeFileSync(
    join(sdkDir, "node-host.js"),
    `
    export let leaseHeld = false;
    export function detectLegacyWorkspaceState() { return { hasLegacy: false, sources: [] }; }
    export async function migrateLegacyWorkspaceState() { return { changes: [], warnings: [] }; }
    export async function runStartupMigrations() {}
    export async function maybeMigrateAuthProfileJsonStoresToSqlite() {
      return { detected: [], changes: [], warnings: [] };
    }
    export async function withAgentDatabaseMaintenanceLease(options, run) {
      leaseHeld = true;
      try { return await run(); } finally { leaseHeld = false; }
    }
  `,
  );
  const runtimePath = join(sdkDir, "sqlite-runtime.js");
  writeFileSync(
    runtimePath,
    `
    import { leaseHeld } from "./node-host.js";
    export let repairCount = 0;
    let mode = "repair";
    export function setRepairMode(value) { mode = value; }
    function assertOwner(database, agentId) {
      const owner = database.prepare("SELECT agent_id FROM schema_meta WHERE meta_key = 'primary'").get();
      if (owner?.agent_id !== agentId) throw new Error("Unexpected agent database owner");
    }
    export function assertOpenClawAgentDatabaseForMaintenance(database, options) {
      assertOwner(database, options.agentId);
      if (!database.prepare("SELECT 1 FROM sqlite_schema WHERE name = 'idx_agent_session_nodes_active'").get()) {
        throw new Error("Missing idx_agent_session_nodes_active");
      }
    }
    export function ensureOpenClawAgentDatabaseSchema(database, options) {
      if (!leaseHeld) throw new Error("Maintenance lease required");
      assertOwner(database, options.agentId);
      repairCount += 1;
      if (mode === "no-op") return;
      database.exec("BEGIN IMMEDIATE");
      try {
        database.exec("CREATE INDEX IF NOT EXISTS idx_agent_session_nodes_active ON session_nodes(session_key) WHERE archived_at IS NULL");
        if (mode === "interrupt") throw new Error("Interrupted schema repair");
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    }
  `,
  );

  const databasePath = join(agentDir, "openclaw-agent.sqlite");
  const database = new DatabaseSync(databasePath);
  try {
    database.exec(`
      CREATE TABLE schema_meta (meta_key TEXT PRIMARY KEY, agent_id TEXT);
      INSERT INTO schema_meta VALUES ('primary', 'main');
      CREATE TABLE session_pending_inputs (id TEXT PRIMARY KEY, payload TEXT);
      INSERT INTO session_pending_inputs VALUES ('pending-1', 'keep this pending input');
      CREATE TABLE session_nodes (session_key TEXT PRIMARY KEY, archived_at INTEGER);
      INSERT INTO session_nodes VALUES ('agent:main:main', NULL);
      PRAGMA user_version = 19;
    `);
    if (ready) {
      database.exec(`
        ALTER TABLE session_pending_inputs ADD COLUMN consumed_event_id TEXT;
        CREATE INDEX idx_agent_session_nodes_active ON session_nodes(session_key) WHERE archived_at IS NULL;
      `);
    }
  } finally {
    database.close();
  }
  return { stateDir, vendorDir, databasePath, runtimePath, agentDir };
}

async function fixtureRuntime(runtimePath: string) {
  return (await import(pathToFileURL(runtimePath).href)) as {
    repairCount: number;
    setRepairMode: (mode: "repair" | "interrupt" | "no-op") => void;
  };
}

beforeEach(() => {
  vi.stubEnv("OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY", "0");
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const root of tempDirs.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("vendor schema readiness", () => {
  it("detects a required index even when the agent schema version is current, without writing", async () => {
    const fixture = makeFixture();
    const before = readFileSync(fixture.databasePath);

    const inspection = await inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir);

    expect(inspection.targetAgentSchemaVersion).toBe(19);
    expect(inspection.required).toBe(true);
    expect(inspection.reasons).toEqual([
      expect.stringContaining("Missing idx_agent_session_nodes_active"),
    ]);
    expect(readFileSync(fixture.databasePath)).toEqual(before);
    expect((await fixtureRuntime(fixture.runtimePath)).repairCount).toBe(0);
  });

  it("defers vendor-approved additive columns to the vendor's lazy migration", async () => {
    const fixture = makeFixture(true);
    const database = new DatabaseSync(fixture.databasePath);
    database.exec("ALTER TABLE session_pending_inputs DROP COLUMN consumed_event_id");
    database.close();

    const inspection = await inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir);

    expect(inspection.required).toBe(false);
    expect(inspection.reasons).toEqual([]);
    expect((await fixtureRuntime(fixture.runtimePath)).repairCount).toBe(0);
  });

  it("leaves legacy auth JSON to the auth bootstrap when the schema is ready", async () => {
    const fixture = makeFixture(true);
    const authPath = join(fixture.agentDir, "auth-profiles.json");
    writeFileSync(authPath, '{"version":1,"profiles":{}}\n');

    expect(await inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir)).toEqual({
      required: false,
      reasons: [],
      targetAgentSchemaVersion: 19,
    });
    expect(existsSync(authPath)).toBe(true);
  });

  it("repairs through the maintenance lease, preserves data, and skips repeat repair", async () => {
    const fixture = makeFixture();
    const runtime = await fixtureRuntime(fixture.runtimePath);

    await migrateVendorStateBeforeGateway(fixture);
    await migrateVendorStateBeforeGateway(fixture);

    expect(runtime.repairCount).toBe(1);
    expect((await inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir)).required).toBe(
      false,
    );
    const database = new DatabaseSync(fixture.databasePath, { readOnly: true });
    try {
      expect(database.prepare("SELECT * FROM session_pending_inputs").all()).toEqual([
        { id: "pending-1", payload: "keep this pending input" },
      ]);
      expect(database.prepare("PRAGMA user_version").get()).toEqual({ user_version: 19 });
    } finally {
      database.close();
    }
  });

  it("can resume after an interrupted vendor repair", async () => {
    const fixture = makeFixture();
    const runtime = await fixtureRuntime(fixture.runtimePath);
    runtime.setRepairMode("interrupt");

    await expect(migrateVendorStateBeforeGateway(fixture)).rejects.toThrow(
      "Interrupted schema repair",
    );
    expect((await inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir)).required).toBe(
      true,
    );
    runtime.setRepairMode("repair");
    await migrateVendorStateBeforeGateway(fixture);

    expect(runtime.repairCount).toBe(2);
    expect((await inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir)).required).toBe(
      false,
    );
  });

  it("does not report success when the vendor leaves same-version drift unrepaired", async () => {
    const fixture = makeFixture();
    (await fixtureRuntime(fixture.runtimePath)).setRepairMode("no-op");

    await expect(migrateVendorStateBeforeGateway(fixture)).rejects.toThrow(
      "migration remained incomplete",
    );
  });

  it("fails closed when the target SDK lacks the readiness assertion", async () => {
    const fixture = makeFixture(true);
    writeFileSync(fixture.runtimePath, "export function ensureOpenClawAgentDatabaseSchema() {}\n");

    await expect(inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir)).rejects.toThrow(
      "OpenClaw SQLite runtime does not expose assertOpenClawAgentDatabaseForMaintenance",
    );
  });

  it("refuses a newer agent database without attempting a downgrade", async () => {
    const fixture = makeFixture(true);
    const database = new DatabaseSync(fixture.databasePath);
    database.exec("PRAGMA user_version = 20");
    database.close();

    await expect(inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir)).rejects.toThrow(
      "uses schema version 20; expected at most 19",
    );
    expect((await fixtureRuntime(fixture.runtimePath)).repairCount).toBe(0);
  });
});
