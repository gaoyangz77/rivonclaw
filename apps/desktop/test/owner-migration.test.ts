import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStorage, type Storage } from "@easyclaw/storage";
import { backfillOwnerMigration } from "../src/owner-migration.js";

describe("backfillOwnerMigration", () => {
  let storage: Storage;
  let tmpDir: string;
  let stateDir: string;
  let credentialsDir: string;
  let configPath: string;

  beforeEach(() => {
    storage = createStorage(":memory:");
    tmpDir = mkdtempSync(join(tmpdir(), "owner-migration-test-"));
    stateDir = join(tmpDir, "state");
    credentialsDir = join(stateDir, "credentials");
    configPath = join(tmpDir, "openclaw.config.json");
    mkdirSync(credentialsDir, { recursive: true });
    writeFileSync(configPath, "{}\n", "utf-8");
  });

  afterEach(() => {
    storage.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should backfill recipients from allowFrom files as owners", async () => {
    writeFileSync(
      join(credentialsDir, "telegram-allowFrom.json"),
      JSON.stringify({ version: 1, allowFrom: ["111", "222"] }),
    );
    writeFileSync(
      join(credentialsDir, "discord-allowFrom.json"),
      JSON.stringify({ version: 1, allowFrom: ["333"] }),
    );

    await backfillOwnerMigration(storage, stateDir, configPath);

    const telegramMeta = storage.channelRecipients.getRecipientMeta("telegram");
    expect(telegramMeta["111"].isOwner).toBe(true);
    expect(telegramMeta["222"].isOwner).toBe(true);

    const discordMeta = storage.channelRecipients.getRecipientMeta("discord");
    expect(discordMeta["333"].isOwner).toBe(true);
  });

  it("should handle scoped allowFrom files (channelId-accountId format)", async () => {
    writeFileSync(
      join(credentialsDir, "telegram-bot123-allowFrom.json"),
      JSON.stringify({ version: 1, allowFrom: ["444"] }),
    );

    await backfillOwnerMigration(storage, stateDir, configPath);

    const meta = storage.channelRecipients.getRecipientMeta("telegram");
    expect(meta["444"].isOwner).toBe(true);
  });

  it("should set migration flag after completion", async () => {
    await backfillOwnerMigration(storage, stateDir, configPath);

    expect(storage.settings.get("owner-migration-v1")).toBe("1");
  });

  it("should be idempotent (skip when flag is set)", async () => {
    writeFileSync(
      join(credentialsDir, "telegram-allowFrom.json"),
      JSON.stringify({ version: 1, allowFrom: ["111"] }),
    );

    await backfillOwnerMigration(storage, stateDir, configPath);
    expect(storage.channelRecipients.getOwners()).toHaveLength(1);

    // Remove the recipient and run again — should not re-create
    storage.channelRecipients.delete("telegram", "111");
    await backfillOwnerMigration(storage, stateDir, configPath);
    expect(storage.channelRecipients.getOwners()).toHaveLength(0);
  });

  it("should handle missing credentials directory", async () => {
    const emptyStateDir = join(tmpDir, "empty-state");
    mkdirSync(emptyStateDir, { recursive: true });
    // No credentials subdirectory

    await backfillOwnerMigration(storage, emptyStateDir, configPath);

    expect(storage.settings.get("owner-migration-v1")).toBe("1");
    expect(storage.channelRecipients.getOwners()).toHaveLength(0);
  });

  it("should sync ownerAllowFrom config after backfill", async () => {
    writeFileSync(
      join(credentialsDir, "telegram-allowFrom.json"),
      JSON.stringify({ version: 1, allowFrom: ["555"] }),
    );

    await backfillOwnerMigration(storage, stateDir, configPath);

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.commands.ownerAllowFrom).toContain("openclaw-control-ui");
    expect(config.commands.ownerAllowFrom).toContain("telegram:555");
  });

  it("should not write config when no recipients found", async () => {
    // Empty credentials dir, no allowFrom files
    await backfillOwnerMigration(storage, stateDir, configPath);

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    // Config should remain unchanged (no commands.ownerAllowFrom)
    expect(config.commands).toBeUndefined();
  });

  it("should skip malformed allowFrom files", async () => {
    writeFileSync(
      join(credentialsDir, "telegram-allowFrom.json"),
      "not valid json",
    );
    writeFileSync(
      join(credentialsDir, "discord-allowFrom.json"),
      JSON.stringify({ version: 1, allowFrom: ["111"] }),
    );

    await backfillOwnerMigration(storage, stateDir, configPath);

    // telegram file was skipped, discord was processed
    expect(storage.channelRecipients.getOwners()).toHaveLength(1);
    expect(storage.channelRecipients.getOwners()[0]).toEqual({
      channelId: "discord",
      recipientId: "111",
    });
  });

  it("should not overwrite existing recipients", async () => {
    // Pre-existing recipient with label and non-owner status
    storage.channelRecipients.ensureExists("telegram", "111", false);
    storage.channelRecipients.setLabel("telegram", "111", "Alice");

    writeFileSync(
      join(credentialsDir, "telegram-allowFrom.json"),
      JSON.stringify({ version: 1, allowFrom: ["111"] }),
    );

    await backfillOwnerMigration(storage, stateDir, configPath);

    const meta = storage.channelRecipients.getRecipientMeta("telegram");
    // ensureExists uses INSERT OR IGNORE, so existing row should be preserved
    expect(meta["111"].label).toBe("Alice");
    expect(meta["111"].isOwner).toBe(false);
  });
});
