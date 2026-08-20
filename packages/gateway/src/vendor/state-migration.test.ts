import { afterEach, describe, expect, it, vi } from "vitest";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import {
  archiveOrphanedLegacyAllowFromFiles,
  inspectVendorStateMigration,
  migrateVendorAuthProfilesBeforeGateway,
  migrateVendorStateBeforeGateway,
  resolveGatewayRpcClientIdentityPath,
  restoreFeishuPairingStateFromAgentDatabases,
} from "./state-migration.js";
import {
  addVendorChannelAllowFromEntry,
  readVendorChannelAllowFrom,
} from "./channel-pairing-state.js";

const tempDirs: string[] = [];
const VENDOR_ROOT = resolve(import.meta.dirname, "../../../../vendor/openclaw");
const TARGET_AGENT_SCHEMA_VERSION = 17;
const LEGACY_DEVICE_ID = "56475aa75463474c0285df5dbf2bcab73da651358839e9b77481b2eab107708c";
const LEGACY_DEVICE_IDENTITY = {
  deviceId: LEGACY_DEVICE_ID,
  publicKey: "A6EHv/POEL4dcN0Y50vAmWfk1jCbpQ1fHdyGZBJVMbg=",
  privateKey: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=",
  createdAtMs: 1_700_000_000_000,
};

function makeFixture(targetVersion = TARGET_AGENT_SCHEMA_VERSION): {
  stateDir: string;
  vendorDir: string;
} {
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
  vi.unstubAllEnvs();
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function loadNamedVendorDistFunction<T extends (...args: never[]) => unknown>(
  prefix: string,
  functionName: string,
): Promise<T> {
  const distDir = join(VENDOR_ROOT, "dist");
  const candidates = readdirSync(distDir).filter(
    (name) => name.startsWith(`${prefix}-`) && name.endsWith(".js"),
  );
  expect(candidates).toHaveLength(1);
  const module = (await import(pathToFileURL(join(distDir, candidates[0])).href)) as Record<
    string,
    unknown
  >;
  const found = Object.values(module).find(
    (value) => typeof value === "function" && value.name === functionName,
  );
  if (typeof found !== "function") {
    throw new Error(`Missing ${functionName} in product vendor dist chunk ${candidates[0]}`);
  }
  return found as T;
}

describe("inspectVendorStateMigration", () => {
  it("does not require migration for a fresh state directory", () => {
    const fixture = makeFixture();
    expect(inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir)).toEqual({
      required: false,
      reasons: [],
      targetAgentSchemaVersion: TARGET_AGENT_SCHEMA_VERSION,
    });
  });

  it("requires migration for an older owned agent schema", () => {
    const fixture = makeFixture();
    const databasePath = createAgentDatabase(fixture.stateDir, "main", 1);
    const inspection = inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir);
    expect(inspection.required).toBe(true);
    expect(inspection.reasons).toContain(
      `agent schema 1 -> ${TARGET_AGENT_SCHEMA_VERSION}: ${databasePath}`,
    );
  });

  it("leaves legacy auth JSON to the auth bootstrap when SQLite is current", () => {
    const fixture = makeFixture();
    createAgentDatabase(fixture.stateDir, "main", TARGET_AGENT_SCHEMA_VERSION);
    const authPath = join(fixture.stateDir, "agents", "main", "agent", "auth-profiles.json");
    writeFileSync(authPath, '{"version":1,"profiles":{}}\n');
    const inspection = inspectVendorStateMigration(fixture.stateDir, fixture.vendorDir);
    expect(inspection.required).toBe(false);
    expect(inspection.reasons).toEqual([]);
  });

  it(
    "migrates only agent databases even when unrelated legacy channel state is malformed",
    async () => {
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
        expect(version.user_version).toBe(TARGET_AGENT_SCHEMA_VERSION);
        expect(metadata).toEqual({
          agent_id: "main",
          schema_version: TARGET_AGENT_SCHEMA_VERSION,
        });
      } finally {
        database.close();
      }
    },
    15_000,
  );

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

  it("migrates legacy setup state for configured customer-service workspaces", async () => {
    const fixture = makeFixture();
    const workspaceDir = join(fixture.stateDir, "workspace-customer-service");
    const legacyPath = join(workspaceDir, "openclaw-workspace-state.json");
    const configPath = join(fixture.stateDir, "openclaw.json");
    mkdirSync(workspaceDir, { recursive: true });
    writeFileSync(
      legacyPath,
      `${JSON.stringify({ version: 1, setupCompletedAt: "2026-08-01T00:00:00.000Z" })}\n`,
    );
    writeFileSync(
      configPath,
      JSON.stringify({
        agents: {
          entries: {
            main: { default: true },
            "customer-service": { workspace: workspaceDir },
          },
        },
      }),
    );

    await migrateVendorStateBeforeGateway({
      configPath,
      stateDir: fixture.stateDir,
      vendorDir: VENDOR_ROOT,
    });

    expect(existsSync(legacyPath)).toBe(false);
    const database = new DatabaseSync(join(fixture.stateDir, "state", "openclaw.sqlite"), {
      readOnly: true,
    });
    try {
      const rows = database
        .prepare(
          `SELECT workspace_path, setup_completed_at
           FROM workspace_setup_state`,
        )
        .all() as Array<{ setup_completed_at: unknown; workspace_path: string }>;
      expect(rows).toContainEqual({
        setup_completed_at: "2026-08-01T00:00:00.000Z",
        workspace_path: realpathSync(workspaceDir),
      });
    } finally {
      database.close();
    }

    await migrateVendorStateBeforeGateway({
      configPath,
      stateDir: fixture.stateDir,
      vendorDir: VENDOR_ROOT,
    });
    expect(existsSync(legacyPath)).toBe(false);
  });

  it("converges an orphaned running recovery claim and admits the next turn", async () => {
    const fixture = makeFixture();
    const databasePath = createLegacyAgentDatabase(fixture.stateDir, "main");
    await migrateVendorStateBeforeGateway({
      stateDir: fixture.stateDir,
      vendorDir: VENDOR_ROOT,
    });

    const sessionKey = "agent:main:feishu:group:oc_recovery_regression";
    const sessionId = "orphaned-running-session";
    const updatedAt = Date.now();
    const orphanedEntry = {
      abortedLastRun: true,
      chatType: "group",
      restartRecoveryBeforeAgentReplyState: "admitted",
      restartRecoveryDeliveryContext: {
        accountId: "default",
        channel: "feishu",
        to: "chat:oc_recovery_regression",
      },
      restartRecoveryDeliveryReceiptState: "terminal-pending",
      restartRecoveryDeliveryRunId: "orphaned-delivery-run",
      restartRecoveryDeliverySourceRunId: "old-feishu-message",
      sessionId,
      status: "running",
      updatedAt,
    };
    const database = new DatabaseSync(databasePath);
    try {
      database
        .prepare(
          `INSERT INTO session_nodes (
             session_key, current_session_id, entry_json, entry_valid, updated_at, status
           ) VALUES (?, ?, ?, 1, ?, 'running')`,
        )
        .run(sessionKey, sessionId, JSON.stringify(orphanedEntry), updatedAt);
      database
        .prepare(
          `INSERT INTO session_windows (session_id, session_key, created_at, updated_at, status)
           VALUES (?, ?, ?, ?, 'running')`,
        )
        .run(sessionId, sessionKey, updatedAt, updatedAt);
    } finally {
      database.close();
    }

    vi.stubEnv("OPENCLAW_DISABLE_SESSION_RESTART_RECOVERY", "1");
    await migrateVendorStateBeforeGateway({
      stateDir: fixture.stateDir,
      vendorDir: VENDOR_ROOT,
    });

    const convergedDatabase = new DatabaseSync(databasePath);
    let convergedEntry: Record<string, unknown>;
    try {
      const node = convergedDatabase
        .prepare(
          `SELECT entry_json, status, updated_at
           FROM session_nodes WHERE session_key = ?`,
        )
        .get(sessionKey) as { entry_json: string; status: string; updated_at: number };
      convergedEntry = JSON.parse(node.entry_json) as Record<string, unknown>;
      expect(node).toMatchObject({ status: "killed", updated_at: updatedAt });
      expect(convergedEntry).toMatchObject({
        abortedLastRun: true,
        restartRecoveryBeforeAgentReplyState: "admitted",
        restartRecoveryDeliveryReceiptState: "terminal-pending",
        restartRecoveryDeliveryRunId: "orphaned-delivery-run",
        status: "killed",
        updatedAt,
      });
      expect(
        convergedDatabase
          .prepare("SELECT status, updated_at FROM session_windows WHERE session_id = ?")
          .get(sessionId),
      ).toEqual({ status: "killed", updated_at: updatedAt });
    } finally {
      convergedDatabase.close();
    }

    // Exercise the exact recovery and admission implementations from the
    // patched product dist. Session initialization commits the former before
    // the latter is asked to adopt the next turn.
    const recoverTerminalSessionEntryForVisibleTurn = await loadNamedVendorDistFunction<
      (entry: Record<string, unknown>) => Record<string, unknown>
    >("terminal-status", "recoverTerminalSessionEntryForVisibleTurn");
    const recoveredEntry = recoverTerminalSessionEntryForVisibleTurn(convergedEntry);
    expect(recoveredEntry).toMatchObject({ sessionId, updatedAt });
    expect(recoveredEntry.status).toBeUndefined();
    expect(recoveredEntry.abortedLastRun).toBeUndefined();
    expect(recoveredEntry.restartRecoveryDeliveryRunId).toBeUndefined();

    const recoveredDatabase = new DatabaseSync(databasePath);
    try {
      recoveredDatabase
        .prepare("UPDATE session_nodes SET entry_json = ?, status = NULL WHERE session_key = ?")
        .run(JSON.stringify(recoveredEntry), sessionKey);
      recoveredDatabase
        .prepare("UPDATE session_windows SET status = NULL WHERE session_id = ?")
        .run(sessionId);
    } finally {
      recoveredDatabase.close();
    }

    type AdmissionRecorder = {
      getPersistedMessage: () => { idempotencyKey: string };
      hasPersisted: () => boolean;
      persistApproved: (options: {
        sessionLifecyclePatch?: Record<string, unknown>;
      }) => Promise<{ sessionEntry: Record<string, unknown> }>;
    };
    type AdmissionController = {
      admitUserTurn: (
        recorder: AdmissionRecorder,
      ) => Promise<"admitted" | "duplicate-source">;
    };
    const createReplyRestartRecoveryClaimController = await loadNamedVendorDistFunction<
      (params: {
        getEntry: () => Record<string, unknown>;
        getSessionId: () => string;
        isRestartAbort: () => boolean;
        resolveDeliveryContext: () => Record<string, string>;
        sessionKey: string;
        setEntry: (entry: Record<string, unknown>) => void;
        sourceTurnId: string;
        storePath: string;
      }) => AdmissionController
    >("reply-admission-ticket", "createReplyRestartRecoveryClaimController");
    let activeEntry = recoveredEntry;
    const controller = createReplyRestartRecoveryClaimController({
      getEntry: () => activeEntry,
      getSessionId: () => sessionId,
      isRestartAbort: () => false,
      resolveDeliveryContext: () => ({
        accountId: "default",
        channel: "feishu",
        to: "chat:oc_recovery_regression",
      }),
      sessionKey,
      setEntry: (entry) => {
        activeEntry = entry;
      },
      sourceTurnId: "new-feishu-message",
      storePath: join(fixture.stateDir, "agents", "main", "sessions", "sessions.json"),
    });
    const recorder: AdmissionRecorder = {
      getPersistedMessage: () => ({ idempotencyKey: "new-feishu-message" }),
      hasPersisted: () => false,
      persistApproved: async ({ sessionLifecyclePatch }) => {
        activeEntry = { ...activeEntry, ...sessionLifecyclePatch };
        const admissionStatus =
          typeof activeEntry.status === "string" ? activeEntry.status : null;
        const admissionDatabase = new DatabaseSync(databasePath);
        try {
          admissionDatabase
            .prepare(
              `UPDATE session_nodes
               SET entry_json = ?, status = ?
               WHERE session_key = ?`,
            )
            .run(JSON.stringify(activeEntry), admissionStatus, sessionKey);
          admissionDatabase
            .prepare("UPDATE session_windows SET status = ? WHERE session_id = ?")
            .run(admissionStatus, sessionId);
        } finally {
          admissionDatabase.close();
        }
        return { sessionEntry: activeEntry };
      },
    };
    await expect(controller.admitUserTurn(recorder)).resolves.toBe("admitted");
    expect(activeEntry).toMatchObject({
      restartRecoveryDeliverySourceRunId: "new-feishu-message",
      status: "running",
    });
    expect(activeEntry.restartRecoveryDeliveryRunId).not.toBe("orphaned-delivery-run");
    expect(activeEntry.restartRecoveryDeliveryReceiptState).toBeUndefined();
  });
});

describe("migrateVendorAuthProfilesBeforeGateway", () => {
  it("uses OpenClaw's verified migration to archive retired auth state", async () => {
    const root = mkdtempSync(join(tmpdir(), "vendor-auth-profile-migration-"));
    tempDirs.push(root);
    const stateDir = join(root, "state");
    const agentDir = join(stateDir, "agents", "main", "agent");
    const configPath = join(stateDir, "openclaw.json");
    const statePath = join(agentDir, "auth-state.json");
    mkdirSync(agentDir, { recursive: true });
    writeFileSync(configPath, "{}\n", "utf-8");
    writeFileSync(
      statePath,
      `${JSON.stringify({
        version: 1,
        lastGood: { openai: "openai:default" },
      })}\n`,
      "utf-8",
    );

    const result = await migrateVendorAuthProfilesBeforeGateway({
      configPath,
      stateDir,
      vendorDir: VENDOR_ROOT,
    });

    expect(result?.warnings).toEqual([]);
    expect(existsSync(statePath)).toBe(false);
    expect(readdirSync(agentDir).some((name) => name.startsWith("auth-state.json.migrated-"))).toBe(
      true,
    );

    const database = new DatabaseSync(join(agentDir, "openclaw-agent.sqlite"), {
      readOnly: true,
    });
    try {
      const storeRow = database
        .prepare("SELECT store_json FROM auth_profile_store WHERE store_key = 'primary'")
        .get() as { store_json: string };
      expect(JSON.parse(storeRow.store_json)).toMatchObject({
        profiles: {},
        version: 1,
      });
      const stateRow = database
        .prepare("SELECT state_json FROM auth_profile_state WHERE state_key = 'primary'")
        .get() as { state_json: string };
      expect(JSON.parse(stateRow.state_json)).toMatchObject({
        lastGood: { openai: "openai:default" },
      });
    } finally {
      database.close();
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

describe("restoreFeishuPairingStateFromAgentDatabases", () => {
  function createSharedPairingDatabase(stateDir: string): void {
    const databaseDir = join(stateDir, "state");
    mkdirSync(databaseDir, { recursive: true });
    const database = new DatabaseSync(join(databaseDir, "openclaw.sqlite"));
    database.exec(`
      CREATE TABLE channel_pairing_allow_entries (
        channel_key TEXT NOT NULL,
        account_id TEXT NOT NULL,
        entry TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (channel_key, account_id, entry)
      ) STRICT;
      CREATE INDEX idx_channel_pairing_allow_account
        ON channel_pairing_allow_entries(channel_key, account_id, sort_order, entry);
    `);
    database.close();
  }

  function createConversationDatabase(
    stateDir: string,
    agentId: string,
    rows: Array<{ accountId: string; kind: string; peerId: string; deliveryTarget: string }>,
  ): void {
    const databasePath = createAgentDatabase(stateDir, agentId, TARGET_AGENT_SCHEMA_VERSION);
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
    createSharedPairingDatabase(fixture.stateDir);
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
    addVendorChannelAllowFromEntry(fixture.stateDir, "feishu", "existing", "ou_preserved");
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

    const restored = restoreFeishuPairingStateFromAgentDatabases(fixture.stateDir, configPath);

    expect(restored).toEqual([
      {
        accountId: "default",
        markerPath: join(
          fixture.stateDir,
          "rivonclaw",
          "migrations",
          "feishu-default-recipient-recovery-v1.json",
        ),
        recipientIds: ["ou_alice"],
      },
      {
        accountId: "secondary",
        markerPath: join(
          fixture.stateDir,
          "rivonclaw",
          "migrations",
          "feishu-secondary-recipient-recovery-v1.json",
        ),
        recipientIds: ["ou_bob"],
      },
    ]);
    expect(readVendorChannelAllowFrom(fixture.stateDir, "feishu", "default")).toEqual(["ou_alice"]);
    expect(readVendorChannelAllowFrom(fixture.stateDir, "feishu", "secondary")).toEqual(["ou_bob"]);
    expect(readVendorChannelAllowFrom(fixture.stateDir, "feishu", "existing")).toEqual([
      "ou_preserved",
    ]);
    expect(readVendorChannelAllowFrom(fixture.stateDir, "feishu", "removed")).toEqual([]);
    expect(existsSync(join(fixture.stateDir, "credentials"))).toBe(false);
  });

  it("does not open agent databases when every active account has a recovery marker", () => {
    const fixture = makeFixture();
    const configPath = join(fixture.stateDir, "openclaw.json");
    const markerDir = join(fixture.stateDir, "rivonclaw", "migrations");
    const invalidDatabasePath = join(
      fixture.stateDir,
      "agents",
      "main",
      "agent",
      "openclaw-agent.sqlite",
    );
    createSharedPairingDatabase(fixture.stateDir);
    mkdirSync(markerDir, { recursive: true });
    mkdirSync(invalidDatabasePath, { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify({ channels: { feishu: { accounts: { default: {}, secondary: {} } } } }),
    );
    for (const accountId of ["default", "secondary"]) {
      writeFileSync(
        join(markerDir, `feishu-${accountId}-recipient-recovery-v1.json`),
        `${JSON.stringify({ version: 1, accountId, importedCount: 0 })}\n`,
      );
    }

    expect(restoreFeishuPairingStateFromAgentDatabases(fixture.stateDir, configPath)).toEqual([]);
  });

  it("is idempotent and records accounts with no recoverable recipients", () => {
    const fixture = makeFixture();
    const configPath = join(fixture.stateDir, "openclaw.json");
    createSharedPairingDatabase(fixture.stateDir);
    writeFileSync(
      configPath,
      JSON.stringify({ channels: { feishu: { accounts: { default: {}, empty: {} } } } }),
    );
    createConversationDatabase(fixture.stateDir, "main", [
      { accountId: "default", kind: "direct", peerId: "ou_alice", deliveryTarget: "user:ou_alice" },
    ]);

    expect(restoreFeishuPairingStateFromAgentDatabases(fixture.stateDir, configPath)).toHaveLength(
      1,
    );
    expect(restoreFeishuPairingStateFromAgentDatabases(fixture.stateDir, configPath)).toEqual([]);
    expect(readVendorChannelAllowFrom(fixture.stateDir, "feishu", "default")).toEqual(["ou_alice"]);
    expect(readVendorChannelAllowFrom(fixture.stateDir, "feishu", "empty")).toEqual([]);
    expect(
      existsSync(
        join(
          fixture.stateDir,
          "rivonclaw",
          "migrations",
          "feishu-empty-recipient-recovery-v1.json",
        ),
      ),
    ).toBe(true);
  });
});
