import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetConfigRuntimeState, setRuntimeConfigSnapshot } from "@vendor/config/config.js";
import { resolveInternalSessionEffectsIdentity } from "@vendor/config/sessions/internal-session-key.js";
import * as accessor from "@vendor/config/sessions/session-accessor.js";
import type { OpenClawConfig } from "@vendor/config/types.openclaw.js";
import {
  loadAccessorSessionEntryForGatewayTarget,
  loadSessionEntriesForTarget,
} from "@vendor/gateway/server-methods/sessions-shared.js";
import {
  closeOpenClawAgentDatabasesForTest,
  openOpenClawAgentDatabase,
  resolveOpenClawAgentSqlitePath,
} from "@vendor/state/openclaw-agent-db.js";
import { closeOpenClawStateDatabaseForTest } from "@vendor/state/openclaw-state-db.js";

let root: string;
let cfg: OpenClawConfig;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "retirement-0035-"));
  vi.stubEnv("OPENCLAW_STATE_DIR", root);
  cfg = {
    agents: { ownership: "explicit", entries: { main: {}, research: {} } },
    session: { store: join(root, "agents", "{agentId}", "sessions", "sessions.json") },
  };
  setRuntimeConfigSnapshot(cfg, cfg);
});
afterEach(() => {
  vi.restoreAllMocks();
  closeOpenClawAgentDatabasesForTest();
  closeOpenClawStateDatabaseForTest();
  resetConfigRuntimeState();
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

const helpers = [
  ["accessor", loadAccessorSessionEntryForGatewayTarget],
  ["describe/get", loadSessionEntriesForTarget],
] as const;

describe("0035 pristine known-key helpers", () => {
  it.each(helpers)(
    "%s reads exact rows without parsing unrelated payloads or listing the catalog",
    async (_name, load) => {
      await accessor.replaceSessionEntry(
        { agentId: "main", sessionKey: "agent:main:main" },
        { sessionId: "selected", updatedAt: 1 },
      );
      // Use the real writer to seed canonical session rows and their generation state.
      for (let i = 0; i < 32; i++) {
        await accessor.replaceSessionEntry(
          { agentId: "main", sessionKey: `agent:main:unrelated-${i}` },
          {
            sessionId: `unrelated-${i}`,
            updatedAt: i + 2,
            skillsSnapshot: { prompt: `UNRELATED_PAYLOAD_${i}`, skills: [] },
          },
        );
      }
      const database = openOpenClawAgentDatabase({ agentId: "main" });
      // Canonical admission is intentionally separate from steady-state exact reads.
      expect(load({ cfg, key: "main", agentId: "main" }).entry?.sessionId).toBe("selected");
      const parse = vi.spyOn(JSON, "parse");
      const executed: Array<{ sql: string; bindings: unknown[]; rowCount: number }> = [];
      const statementPrototype = Object.getPrototypeOf(database.db.prepare("SELECT 1"));
      const statementSpies = ["all", "get", "iterate"].map((method) => {
        const original = statementPrototype[method];
        return vi.spyOn(statementPrototype, method).mockImplementation(function (
          this: { sourceSQL: string },
          ...bindings: unknown[]
        ) {
          const result = original.apply(this, bindings);
          if (/select/i.test(this.sourceSQL) && /session_nodes/.test(this.sourceSQL)) {
            if (method === "iterate") {
              const observation = { sql: this.sourceSQL, bindings, rowCount: 0 };
              executed.push(observation);
              return (function* () {
                for (const row of result) {
                  observation.rowCount++;
                  yield row;
                }
              })();
            }
            executed.push({
              sql: this.sourceSQL,
              bindings,
              rowCount: Array.isArray(result) ? result.length : result ? 1 : 0,
            });
          }
          return result;
        });
      });
      const list = vi.spyOn(accessor, "listSessionEntriesCore");
      const readOnlyList = vi.spyOn(accessor, "listSessionEntriesReadOnly");
      const hit = load({ cfg, key: "main", agentId: "main" });
      const miss = load({ cfg, key: "agent:main:missing" });
      expect(hit.entry?.sessionId).toBe("selected");
      expect(Object.keys(hit.target.store)).toEqual(["agent:main:main"]);
      expect(hit.target.canonicalKey).toBe("agent:main:main");
      expect(miss.entry).toBeUndefined();
      expect(Object.keys(miss.target.store)).toHaveLength(0);
      expect(list).not.toHaveBeenCalled();
      expect(readOnlyList).not.toHaveBeenCalled();
      expect(
        parse.mock.calls.filter(
          ([value]) => typeof value === "string" && value.includes("UNRELATED_PAYLOAD_"),
        ),
      ).toHaveLength(0);
      for (const spy of statementSpies) spy.mockRestore();
      expect(executed.length).toBeGreaterThan(0);
      expect(executed.every(({ sql, rowCount }) => /where/i.test(sql) && rowCount <= 1)).toBe(true);
      console.log(`${_name} exact SQL:`, [...new Set(executed.map(({ sql }) => sql))]);
      parse.mockRestore();
      for (const { sql, bindings } of executed) {
        const plan = database.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...(bindings as never[]));
        expect(plan.some((row) => /SEARCH .*USING.*INDEX/.test(String(row.detail)))).toBe(true);
        expect(
          plan.some((row) => /SCAN (?:session_nodes|n|se)(?: |$)/.test(String(row.detail))),
        ).toBe(false);
        console.log(
          `${_name} query plan:`,
          plan.map((row) => row.detail),
        );
      }
    },
  );

  it.each(helpers)(
    "%s preserves missing-store probes and creates the configured agent DB on write",
    async (_name, load) => {
      const path = resolveOpenClawAgentSqlitePath({ agentId: "research" });
      expect(existsSync(path)).toBe(false);
      expect(load({ cfg, key: "agent:research:main", agentId: "research" }).entry).toBeUndefined();
      expect(existsSync(path)).toBe(false);
      await accessor.replaceSessionEntry(
        { agentId: "research", sessionKey: "agent:research:main" },
        { sessionId: "created-by-write", updatedAt: 1 },
      );
      expect(existsSync(path)).toBe(true);
      expect(load({ cfg, key: "agent:research:main", agentId: "research" }).entry?.sessionId).toBe(
        "created-by-write",
      );
    },
  );

  it.each(helpers)(
    "%s rejects ambiguous aliases and conflicting agent ownership",
    (_name, load) => {
      expect(() => load({ cfg, key: "main" })).toThrow(/no explicit owner/);
      expect(() => load({ cfg, key: "agent:main:main", agentId: "research" })).toThrow(
        /belongs to/,
      );
    },
  );

  it.each(helpers)(
    "%s hides internal-effects entries without destroying their durable row",
    async (_name, load) => {
      const hidden = resolveInternalSessionEffectsIdentity({ agentId: "main", runId: "audit" });
      await accessor.replaceSessionEntry(
        { agentId: "main", sessionKey: hidden.sessionKey },
        { sessionId: hidden.sessionId, updatedAt: 1 },
      );
      expect(load({ cfg, key: hidden.sessionKey }).entry).toBeUndefined();
      expect(
        accessor.loadExactSessionEntryReadOnly({ agentId: "main", sessionKey: hidden.sessionKey })
          ?.entry.sessionId,
      ).toBe(hidden.sessionId);
    },
  );

  it("includes only direct children when describe/get explicitly requests them", async () => {
    const parent = "agent:main:parent";
    const child = "agent:main:child";
    const grandchild = "agent:main:grandchild";
    for (const [sessionKey, parentSessionKey] of [
      [parent, undefined],
      [child, parent],
      [grandchild, child],
    ] as const) {
      await accessor.replaceSessionEntry(
        { agentId: "main", sessionKey },
        { sessionId: sessionKey, updatedAt: 1, ...(parentSessionKey ? { parentSessionKey } : {}) },
      );
    }
    expect(Object.keys(loadSessionEntriesForTarget({ cfg, key: parent }).store)).toEqual([parent]);
    expect(
      Object.keys(
        loadSessionEntriesForTarget({ cfg, key: parent, includeStoreChildEntries: true }).store,
      ).sort(),
    ).toEqual([parent, child].sort());
  });
});
