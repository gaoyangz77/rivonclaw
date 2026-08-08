import { afterEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  archiveOrphanedLegacyAllowFromFiles,
  inspectVendorStateMigration,
  migrateVendorStateBeforeGateway,
  resolveGatewayRpcClientIdentityPath,
  restoreFeishuAllowFromFromAgentDatabases,
} from "./state-migration.js";

const tempDirs: string[] = [];
const VENDOR_ROOT = resolve(import.meta.dirname, "../../../../vendor/openclaw");
const LEGACY_DEVICE_ID = "56475aa75463474c0285df5dbf2bcab73da651358839e9b77481b2eab107708c";
const LEGACY_DEVICE_IDENTITY = {
  deviceId: LEGACY_DEVICE_ID,
  publicKey: "A6EHv/POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg=",
  privateKey: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
  createdAtMs: 1_700_000_000_000,
};

function makeFixture(targetVersion = 16): { stateDir: string; vendorDir: string } {
  const root = mkdtempSync(join(tmpdir(), "vendor-state-migration-"));
  tempDirs.push(root);
  const stateDir = join(root, "state");
  const vendorDir = join(root, "vendor");
  mkdirSync(stateDir, { recursive: true });
  mkdirSync(vendorDir, { recursive: true });
  writeFileSync(
    join(vendorDir, "package.json"),
    JSON.stringify({ openclaw: { schemaVersions: { agent: targetVersion } } }),
  );
  return { stateDir, vendorDir };
}

function createAgentDatabase(stateDir: string, agentId: string, version: number): string {
  const agentDir = join(stateDir, "agents", agentId, "agent");
  mkdirSync(agentDir, { recursive: true });
  const databasePath = join(agentDir, "openclaw-agent.sqlite");
  const database = new DatabaseSync(databasePath);
  database.exec(`PRAGMA user_version = ${version}`);
  database.close();
  return databasePath;
}

function createLegacyAgentDatabase(stateDir: string, agentId: string): string {
  const agentDir = join(stateDir, "agents", agentId, "agent");
  mkdirSync(agentDir, { recursive: true });
  const databasePath = join(agentDir, "openclaw-agent.sqlite");
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE schema_meta (
      meta_key TEXT NOT NULL PRIMARY KEY,
      role TEXT NOT NULL,
      schema_version INTEGER NOT NULL,
      agent_id TEXT,
      app_version TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    INSERT INTO schema_meta VALUES ('primary', 'agent', 1, '${agentId}', NULL, 1, 1);
    CREATE TABLE sessions (
      session_id TEXT NOT NULL PRIMARY KEY,
      session_key TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE session_entries (
      session_key TEXT NOT NULL PRIMARY KEY,
      session_id TEXT NOT NULL,
      entry_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    );
    INSERT INTO sessions VALUES ('session-1', 'agent:${agentId}:main', 10, 20);
    INSERT INTO session_entries VALUES (
      'agent:${agentId}:main',
      'session-1',
      '{"sessionId":"session-1","updatedAt":20,"status":"done"}',
      20
    );
    CREATE TABLE memory_index_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      revision INTEGER NOT NULL
    );
    INSERT INTO memory_index_state VALUES (1, 1);
    CREATE TABLE memory_index_sources (
      source_kind TEXT NOT NULL DEFAULT 'memory',
      source_key TEXT NOT NULL,
      path TEXT,
      session_id TEXT,
      hash TEXT NOT NULL,
      mtime INTEGER NOT NULL,
      size INTEGER NOT NULL,
      PRIMARY KEY (source_kind, source_key),
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    );
    CREATE TABLE memory_index_chunks (
      id TEXT PRIMARY KEY,
      source_kind TEXT NOT NULL DEFAULT 'memory',
      source_key TEXT NOT NULL,
      path TEXT NOT NULL,
      session_id TEXT,
      start_line INTEGER NOT NULL,
      end_line INTEGER NOT NULL,
      hash TEXT NOT NULL,
      model TEXT NOT NULL,
      text TEXT NOT NULL,
      embedding BLOB NOT NULL,
      embedding_dims INTEGER,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (source_kind, source_key)
        REFERENCES memory_index_sources(source_kind, source_key) ON DELETE CASCADE,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id) ON DELETE CASCADE
    );
    PRAGMA user_version = 1;
  `);
  database.close();
  return databasePath;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe("inspectVendorStateMigration", () => {
  it("does not require migration for a fresh state directory", () => {
    const fixture = makeFixture();
    expect(inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir)).toEqual({
      required: false,
      reasons: [],
      targetAgentSchemaVersion: 16,
    });
  });

  it("requires migration for an older owned agent schema", () => {
    const fixture = makeFixture();
    const databasePath = createAgentDatabase(fixture.stateDir, "main", 1);
    const inspection = inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir);
    expect(inspection.required).toBe(true);
    expect(inspection.reasons).toContain(`agent schema 1 -> 16: ${databasePath}`);
  });

  it("leaves legacy auth JSON to the auth bootstrap when SQLite is current", () => {
    const fixture = makeFixture();
    createAgentDatabase(fixture.stateDir, "main", 16);
    const authPath = join(fixture.stateDir, "agents", "main", "agent", "auth-profiles.json");
    writeFileSync(authPath, '{"version":1,"profiles":{}}\n');
    const inspection = inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir);
    expect(inspection.required).toBe(false);
    expect(inspection.reasons).toEqual([]);
  });

  it("migrates only agent databases even when unrelated legacy channel state is malformed", async () => {
    const fixture = makeFixture();
    const databasePath = createLegacyAgentDatabase(fixture.stateDir, "main");
    const credentialsDir = join(fixture.stateDir, "credentials");
    mkdirSync(credentialsDir, { recursive: true });
    writeFileSync(
      join(credentialsDir, "feishu-pairing.json"),
      '{"version":1,"requests":[{"accountId":"*"}]}\n',
    );

    await migrateVendorStateBeforeGateway({
      stateDir: fixture.stateDir,
      vendorDir: VENDOR_ROOT,
    });

    const database = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const version = database.prepare("PRAGMA user_version").get() as {
        user_version: number;
      };
      const metadata = database
        .prepare("SELECT agent_id, schema_version FROM schema_meta WHERE meta_key = 'primary'")
        .get();
      expect(version.user_version).toBe(16);
      expect(metadata).toEqual({ agent_id: "main", schema_version: 16 });
    } finally {
      database.close();
    }
  });

  it("preserves a legacy device identity through OpenClaw's official startup migration", async () => {
    const fixture = makeFixture();
    const identityDir = join(fixture.stateDir, "identity");
    const legacyPath = join(identityDir, "device.json");
    mkdirSync(identityDir, { recursive: true });
    writeFileSync(legacyPath, `${JSON.stringify(LEGACY_DEVICE_IDENTITY)}\n`);

    await migrateVendorStateBeforeGateway({
      stateDir: fixture.stateDir,
      vendorDir: VENDOR_ROOT,
    });

    expect(existsSync(legacyPath)).toBe(false);
    const database = new DatabaseSync(join(fixture.stateDir, "state", "openclaw.sqlite"), {
      readOnly: true,
    });
    try {
      expect(
        database
          .prepare("SELECT device_id FROM device_identities WHERE identity_key = 'primary'")
          .get(),
      ).toEqual({ device_id: LEGACY_DEVICE_ID });
    } finally {
      database.close();
    }

    const recreatedClientIdentity = `${JSON.stringify({
      version: 1,
      deviceId: "rivonclaw-rpc-client",
      publicKeyPem: "client-public-key",
      privateKeyPem: "client-private-key",
      createdAtMs: 1_800_000_000_000,
    })}\n`;
    writeFileSync(legacyPath, recreatedClientIdentity);

    await migrateVendorStateBeforeGateway({
      stateDir: fixture.stateDir,
      vendorDir: VENDOR_ROOT,
    });

    expect(existsSync(legacyPath)).toBe(false);
    expect(readFileSync(resolveGatewayRpcClientIdentityPath(fixture.stateDir), "utf-8")).toBe(
      recreatedClientIdentity,
    );
    const preservedDatabase = new DatabaseSync(join(fixture.stateDir, "state", "openclaw.sqlite"), {
      readOnly: true,
    });
    try {
      expect(
        preservedDatabase
          .prepare("SELECT device_id FROM device_identities WHERE identity_key = 'primary'")
          .get(),
      ).toEqual({ device_id: LEGACY_DEVICE_ID });
    } finally {
      preservedDatabase.close();
    }
  });
});

describe("archiveOrphanedLegacyAllowFromFiles", () => {
  it("archives only allowlists for accounts absent from the current config", () => {
    const fixture = makeFixture();
    const credentialsDir = join(fixture.stateDir, "credentials");
    const configPath = join(fixture.stateDir, "openclaw.json");
    mkdirSync(credentialsDir, { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify({
        channels: {
          feishu: {
            accounts: { current: {}, default: {} },
          },
          telegram: {
            accounts: { active: {} },
            defaultAccount: "active",
          },
        },
        bindings: [
          { agentId: "main", match: { channel: "feishu", accountId: "*" } },
          { agentId: "main", match: { channel: "mobile", accountId: "device-1" } },
        ],
      }),
    );
    const files = {
      "feishu-current-allowFrom.json": "current account",
      "feishu-default-allowFrom.json": "default account",
      "feishu-removed-allowFrom.json": "removed account",
      "mobile-device-1-allowFrom.json": "binding account",
      "telegram-allowFrom.json": "channel default",
      "telegram-active-allowFrom.json": "configured account",
    };
    for (const [name, contents] of Object.entries(files)) {
      writeFileSync(join(credentialsDir, name), contents);
    }

    const archived = archiveOrphanedLegacyAllowFromFiles(fixture.stateDir, configPath);

    const archivePath = join(credentialsDir, "feishu-removed-allowFrom.json.orphaned");
    expect(archived).toEqual([archivePath]);
    expect(readFileSync(archivePath, "utf-8")).toBe("removed account");
    for (const name of Object.keys(files).filter((name) => !name.includes("removed"))) {
      expect(readFileSync(join(credentialsDir, name), "utf-8")).toBe(
        files[name as keyof typeof files],
      );
    }
  });

  it("uses a collision-safe archive name without overwriting prior data", () => {
    const fixture = makeFixture();
    const credentialsDir = join(fixture.stateDir, "credentials");
    const configPath = join(fixture.stateDir, "openclaw.json");
    mkdirSync(credentialsDir, { recursive: true });
    writeFileSync(configPath, JSON.stringify({ channels: {} }));
    writeFileSync(join(credentialsDir, "feishu-old-allowFrom.json"), "new orphan");
    writeFileSync(join(credentialsDir, "feishu-old-allowFrom.json.orphaned"), "prior orphan");

    const archived = archiveOrphanedLegacyAllowFromFiles(fixture.stateDir, configPath);

    expect(archived).toEqual([join(credentialsDir, "feishu-old-allowFrom.json.orphaned.1")]);
    expect(readFileSync(join(credentialsDir, "feishu-old-allowFrom.json.orphaned"), "utf-8")).toBe(
      "prior orphan",
    );
    expect(readFileSync(archived[0], "utf-8")).toBe("new orphan");
  });

  it("leaves files untouched when the config cannot be parsed", () => {
    const fixture = makeFixture();
    const credentialsDir = join(fixture.stateDir, "credentials");
    const configPath = join(fixture.stateDir, "openclaw.json");
    mkdirSync(credentialsDir, { recursive: true });
    writeFileSync(configPath, "not json");
    const allowFromPath = join(credentialsDir, "feishu-old-allowFrom.json");
    writeFileSync(allowFromPath, "preserve me");

    expect(archiveOrphanedLegacyAllowFromFiles(fixture.stateDir, configPath)).toEqual([]);
    expect(readFileSync(allowFromPath, "utf-8")).toBe("preserve me");
  });
});

describe("restoreFeishuAllowFromFromAgentDatabases", () => {
  function createConversationDatabase(
    stateDir: string,
    agentId: string,
    rows: Array<{ accountId: string; kind: string; peerId: string; deliveryTarget: string }>,
  ): void {
    const databasePath = createAgentDatabase(stateDir, agentId, 16);
    const database = new DatabaseSync(databasePath);
    try {
      database.exec(`
        CREATE TABLE conversations (
          conversation_id TEXT PRIMARY KEY,
          channel TEXT NOT NULL,
          account_id TEXT NOT NULL,
          kind TEXT NOT NULL,
          peer_id TEXT NOT NULL,
          delivery_target TEXT NOT NULL
        ) STRICT;
      `);
      const insert = database.prepare(
        `INSERT INTO conversations
         (conversation_id, channel, account_id, kind, peer_id, delivery_target)
         VALUES (?, 'feishu', ?, ?, ?, ?)`,
      );
      rows.forEach((row, index) => {
        insert.run(
          `conversation-${index}`,
          row.accountId,
          row.kind,
          row.peerId,
          row.deliveryTarget,
        );
      });
    } finally {
      database.close();
    }
  }

  it("recovers only unambiguous direct recipients into their active Feishu accounts", () => {
    const fixture = makeFixture();
    const configPath = join(fixture.stateDir, "openclaw.json");
    const credentialsDir = join(fixture.stateDir, "credentials");
    mkdirSync(credentialsDir, { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify({
        channels: {
          feishu: {
            accounts: { default: {}, secondary: {}, existing: {} },
          },
        },
      }),
    );
    writeFileSync(
      join(credentialsDir, "feishu-existing-allowFrom.json"),
      `${JSON.stringify({ version: 1, allowFrom: ["ou_preserved"] })}\n`,
    );
    createConversationDatabase(fixture.stateDir, "main", [
      { accountId: "default", kind: "direct", peerId: "ou_alice", deliveryTarget: "user:ou_alice" },
      { accountId: "secondary", kind: "direct", peerId: "ou_bob", deliveryTarget: "user:ou_bob" },
      {
        accountId: "existing",
        kind: "direct",
        peerId: "ou_ignored",
        deliveryTarget: "user:ou_ignored",
      },
      {
        accountId: "removed",
        kind: "direct",
        peerId: "ou_removed",
        deliveryTarget: "user:ou_removed",
      },
      {
        accountId: "default",
        kind: "group",
        peerId: "ou_group_sender",
        deliveryTarget: "user:ou_group_sender",
      },
      { accountId: "default", kind: "direct", peerId: "oc_chat", deliveryTarget: "user:oc_chat" },
      {
        accountId: "default",
        kind: "direct",
        peerId: "ou_wrong_route",
        deliveryTarget: "ou_wrong_route",
      },
    ]);

    const restored = restoreFeishuAllowFromFromAgentDatabases(fixture.stateDir, configPath);

    expect(restored).toEqual([
      {
        accountId: "default",
        path: join(credentialsDir, "feishu-default-allowFrom.json"),
        recipientIds: ["ou_alice"],
      },
      {
        accountId: "secondary",
        path: join(credentialsDir, "feishu-secondary-allowFrom.json"),
        recipientIds: ["ou_bob"],
      },
    ]);
    expect(
      JSON.parse(readFileSync(join(credentialsDir, "feishu-default-allowFrom.json"), "utf-8")),
    ).toEqual({
      version: 1,
      allowFrom: ["ou_alice"],
    });
    expect(
      JSON.parse(readFileSync(join(credentialsDir, "feishu-secondary-allowFrom.json"), "utf-8")),
    ).toEqual({
      version: 1,
      allowFrom: ["ou_bob"],
    });
    expect(
      JSON.parse(readFileSync(join(credentialsDir, "feishu-existing-allowFrom.json"), "utf-8")),
    ).toEqual({
      version: 1,
      allowFrom: ["ou_preserved"],
    });
    expect(existsSync(join(credentialsDir, "feishu-removed-allowFrom.json"))).toBe(false);
  });

  it("is idempotent and preserves malformed allowFrom files", () => {
    const fixture = makeFixture();
    const configPath = join(fixture.stateDir, "openclaw.json");
    const credentialsDir = join(fixture.stateDir, "credentials");
    mkdirSync(credentialsDir, { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify({ channels: { feishu: { accounts: { default: {}, broken: {} } } } }),
    );
    writeFileSync(join(credentialsDir, "feishu-broken-allowFrom.json"), "not json");
    createConversationDatabase(fixture.stateDir, "main", [
      { accountId: "default", kind: "direct", peerId: "ou_alice", deliveryTarget: "user:ou_alice" },
      { accountId: "broken", kind: "direct", peerId: "ou_bob", deliveryTarget: "user:ou_bob" },
    ]);

    expect(restoreFeishuAllowFromFromAgentDatabases(fixture.stateDir, configPath)).toHaveLength(1);
    expect(restoreFeishuAllowFromFromAgentDatabases(fixture.stateDir, configPath)).toEqual([]);
    expect(readFileSync(join(credentialsDir, "feishu-broken-allowFrom.json"), "utf-8")).toBe(
      "not json",
    );
  });
});
