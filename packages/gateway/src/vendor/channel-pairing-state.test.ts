import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, describe, expect, it } from "vitest";
import {
  addVendorChannelAllowFromEntry,
  clearVendorChannelAllowFrom,
  readVendorChannelAllowFrom,
  removeVendorChannelAllowFromEntry,
} from "./channel-pairing-state.js";

const roots: string[] = [];

function makeStateDir(): string {
  const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-pairing-state-"));
  roots.push(stateDir);
  const databasePath = join(stateDir, "state", "openclaw.sqlite");
  mkdirSync(join(stateDir, "state"), { recursive: true });
  const database = new DatabaseSync(databasePath);
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
  return stateDir;
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("OpenClaw shared channel pairing state", () => {
  it("keeps entries ordered and scoped to an account", () => {
    const stateDir = makeStateDir();

    expect(addVendorChannelAllowFromEntry(stateDir, "feishu", "default", "ou_first")).toBe(true);
    expect(addVendorChannelAllowFromEntry(stateDir, "feishu", "default", "ou_second")).toBe(true);
    expect(addVendorChannelAllowFromEntry(stateDir, "feishu", "secondary", "ou_other")).toBe(true);
    expect(addVendorChannelAllowFromEntry(stateDir, "feishu", "default", "ou_first")).toBe(false);

    expect(readVendorChannelAllowFrom(stateDir, "feishu", "default")).toEqual([
      "ou_first",
      "ou_second",
    ]);
    expect(readVendorChannelAllowFrom(stateDir, "feishu", "secondary")).toEqual(["ou_other"]);
  });

  it("removes one entry or clears only the requested account", () => {
    const stateDir = makeStateDir();
    addVendorChannelAllowFromEntry(stateDir, "feishu", "default", "ou_first");
    addVendorChannelAllowFromEntry(stateDir, "feishu", "default", "ou_second");
    addVendorChannelAllowFromEntry(stateDir, "feishu", "secondary", "ou_other");

    expect(removeVendorChannelAllowFromEntry(stateDir, "feishu", "default", "ou_first")).toBe(true);
    expect(readVendorChannelAllowFrom(stateDir, "feishu", "default")).toEqual(["ou_second"]);
    expect(clearVendorChannelAllowFrom(stateDir, "feishu", "default")).toBe(1);
    expect(readVendorChannelAllowFrom(stateDir, "feishu", "default")).toEqual([]);
    expect(readVendorChannelAllowFrom(stateDir, "feishu", "secondary")).toEqual(["ou_other"]);
  });

  it("treats absent pre-migration state as empty", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-pairing-state-empty-"));
    roots.push(stateDir);
    expect(readVendorChannelAllowFrom(stateDir, "feishu", "default")).toEqual([]);
  });
});
