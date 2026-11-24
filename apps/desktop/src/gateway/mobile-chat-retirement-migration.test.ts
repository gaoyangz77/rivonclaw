import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addVendorChannelAllowFromEntry, readVendorChannelAllowFrom } from "@rivonclaw/gateway";

const writeSpy = vi.hoisted(() => vi.fn());

vi.mock("./openclaw-config-mutation.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./openclaw-config-mutation.js")>();
  return {
    ...actual,
    writeDesktopOpenClawConfig: (...args: Parameters<typeof actual.writeDesktopOpenClawConfig>) => {
      writeSpy(...args);
      actual.writeDesktopOpenClawConfig(...args);
    },
  };
});

import { migrateRetiredMobileChat } from "./mobile-chat-retirement-migration.js";

const roots: string[] = [];

function makeStateDir(): { stateDir: string; configPath: string } {
  const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-mobile-retirement-"));
  roots.push(stateDir);
  return { stateDir, configPath: join(stateDir, "openclaw.json") };
}

function createVendorAllowlistTable(stateDir: string): void {
  mkdirSync(join(stateDir, "state"), { recursive: true });
  const database = new DatabaseSync(join(stateDir, "state", "openclaw.sqlite"));
  database.exec(`
    CREATE TABLE channel_pairing_allow_entries (
      channel_key TEXT NOT NULL,
      account_id TEXT NOT NULL,
      entry TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (channel_key, account_id, entry)
    ) STRICT;
  `);
  database.close();
}

function writeFile(path: string, content = "x"): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content, "utf-8");
}

function upgradedConfig(): Record<string, unknown> {
  return {
    channels: {
      mobile: { managed: true },
      telegram: { accounts: { default: { botToken: "t" } } },
    },
    bindings: [
      { agentId: "main", match: { channel: "mobile", accountId: "*" } },
      { agentId: "main", match: { channel: " Mobile ", accountId: "other" } },
      { agentId: "main", match: { channel: "telegram", accountId: "default" } },
    ],
    plugins: {
      allow: ["telegram", "rivonclaw-mobile-chat-channel", "mobile-chat-channel"],
      deny: ["xai", "mobile-chat-channel"],
      entries: {
        "rivonclaw-mobile-chat-channel": { enabled: true },
        "mobile-chat-channel": { enabled: true },
        telegram: { enabled: true },
      },
    },
    commands: { ownerAllowFrom: ["mobile:device-1", "telegram:42"] },
  };
}

beforeEach(() => writeSpy.mockClear());

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("migrateRetiredMobileChat", () => {
  it("cleans config, allowlist rows and leftover files from an upgraded install", () => {
    const { stateDir, configPath } = makeStateDir();
    writeFileSync(configPath, JSON.stringify(upgradedConfig(), null, 2), "utf-8");
    createVendorAllowlistTable(stateDir);
    addVendorChannelAllowFromEntry(stateDir, "mobile", "default", "device-1");
    addVendorChannelAllowFromEntry(stateDir, "telegram", "default", "42");
    writeFile(join(stateDir, "credentials", "mobile-allowFrom.json"));
    writeFile(join(stateDir, "credentials", "mobile-allowFrom.json.bak"));
    writeFile(join(stateDir, "credentials", "mobile-allowFrom.json.orphaned-1"));
    writeFile(join(stateDir, "credentials", "telegram-default-allowFrom.json"));
    writeFile(join(stateDir, "identity", "mobile-desktop-id.txt"));
    writeFile(join(stateDir, "identity", "device.json"));
    writeFile(join(stateDir, "mobile-sync", "pairing-1.json"));
    writeFile(join(stateDir, "media", "inbound", "mobile", "photo.jpg"));

    migrateRetiredMobileChat(configPath, stateDir);

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.channels).toEqual({ telegram: { accounts: { default: { botToken: "t" } } } });
    expect(config.bindings).toEqual([
      { agentId: "main", match: { channel: "telegram", accountId: "default" } },
    ]);
    expect(config.plugins.allow).toEqual(["telegram"]);
    expect(config.plugins.deny).toEqual(["xai"]);
    expect(config.plugins.entries).toEqual({ telegram: { enabled: true } });
    expect(config.commands.ownerAllowFrom).toEqual(["telegram:42"]);

    expect(readVendorChannelAllowFrom(stateDir, "mobile", "default")).toEqual([]);
    expect(readVendorChannelAllowFrom(stateDir, "telegram", "default")).toEqual(["42"]);

    expect(existsSync(join(stateDir, "mobile-sync"))).toBe(false);
    expect(existsSync(join(stateDir, "identity", "mobile-desktop-id.txt"))).toBe(false);
    expect(existsSync(join(stateDir, "credentials", "mobile-allowFrom.json"))).toBe(false);
    expect(existsSync(join(stateDir, "credentials", "mobile-allowFrom.json.bak"))).toBe(false);
    expect(existsSync(join(stateDir, "credentials", "mobile-allowFrom.json.orphaned-1"))).toBe(
      false,
    );
    expect(existsSync(join(stateDir, "credentials", "telegram-default-allowFrom.json"))).toBe(true);
    expect(existsSync(join(stateDir, "identity", "device.json"))).toBe(true);
    expect(existsSync(join(stateDir, "media", "inbound", "mobile", "photo.jpg"))).toBe(true);
  });

  it("is idempotent: a second run changes and writes nothing", () => {
    const { stateDir, configPath } = makeStateDir();
    writeFileSync(configPath, JSON.stringify(upgradedConfig(), null, 2), "utf-8");
    createVendorAllowlistTable(stateDir);
    addVendorChannelAllowFromEntry(stateDir, "mobile", "default", "device-1");

    migrateRetiredMobileChat(configPath, stateDir);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    const after = readFileSync(configPath, "utf-8");

    migrateRetiredMobileChat(configPath, stateDir);
    expect(writeSpy).toHaveBeenCalledTimes(1);
    expect(readFileSync(configPath, "utf-8")).toBe(after);
  });

  it("is a no-op on a fresh install", () => {
    const { stateDir, configPath } = makeStateDir();
    const original = JSON.stringify({ channels: { telegram: {} }, plugins: { allow: ["x"] } });
    writeFileSync(configPath, original, "utf-8");

    migrateRetiredMobileChat(configPath, stateDir);

    expect(writeSpy).not.toHaveBeenCalled();
    expect(readFileSync(configPath, "utf-8")).toBe(original);
  });

  it("tolerates a missing config file and an unparseable one", () => {
    const { stateDir, configPath } = makeStateDir();
    writeFile(join(stateDir, "mobile-sync", "pairing-1.json"));

    migrateRetiredMobileChat(configPath, stateDir);
    expect(existsSync(join(stateDir, "mobile-sync"))).toBe(false);

    writeFileSync(configPath, "{ not json", "utf-8");
    migrateRetiredMobileChat(configPath, stateDir);
    expect(writeSpy).not.toHaveBeenCalled();
    expect(readFileSync(configPath, "utf-8")).toBe("{ not json");
  });
});
