import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createStorage, type Storage } from "@easyclaw/storage";
import { syncOwnerAllowFrom, buildOwnerAllowFrom } from "../src/owner-sync.js";

describe("owner-sync", () => {
  let storage: Storage;
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    storage = createStorage(":memory:");
    tmpDir = mkdtempSync(join(tmpdir(), "owner-sync-test-"));
    configPath = join(tmpDir, "openclaw.config.json");
    // Start with an empty config file
    writeFileSync(configPath, "{}\n", "utf-8");
  });

  afterEach(() => {
    storage.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("syncOwnerAllowFrom", () => {
    it("should always include openclaw-control-ui", () => {
      syncOwnerAllowFrom(storage, configPath);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.commands.ownerAllowFrom).toEqual(["openclaw-control-ui"]);
    });

    it("should include owner recipients from storage", () => {
      storage.channelRecipients.ensureExists("telegram", "12345", true);
      storage.channelRecipients.ensureExists("discord", "67890", true);

      syncOwnerAllowFrom(storage, configPath);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.commands.ownerAllowFrom).toEqual([
        "openclaw-control-ui",
        "telegram:12345",
        "discord:67890",
      ]);
    });

    it("should not include non-owner recipients", () => {
      storage.channelRecipients.ensureExists("telegram", "owner1", true);
      storage.channelRecipients.ensureExists("telegram", "user1", false);

      syncOwnerAllowFrom(storage, configPath);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.commands.ownerAllowFrom).toEqual([
        "openclaw-control-ui",
        "telegram:owner1",
      ]);
    });

    it("should preserve existing commands config", () => {
      writeFileSync(configPath, JSON.stringify({
        commands: {
          prefix: "!",
          enabled: true,
        },
      }, null, 2) + "\n", "utf-8");

      syncOwnerAllowFrom(storage, configPath);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.commands.prefix).toBe("!");
      expect(config.commands.enabled).toBe(true);
      expect(config.commands.ownerAllowFrom).toEqual(["openclaw-control-ui"]);
    });

    it("should handle empty config file", () => {
      writeFileSync(configPath, "{}", "utf-8");

      syncOwnerAllowFrom(storage, configPath);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.commands.ownerAllowFrom).toEqual(["openclaw-control-ui"]);
    });

    it("should deduplicate entries", () => {
      // If somehow openclaw-control-ui is also a recipient
      storage.channelRecipients.ensureExists("telegram", "111", true);

      syncOwnerAllowFrom(storage, configPath);

      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      const entries = config.commands.ownerAllowFrom;
      expect(new Set(entries).size).toBe(entries.length);
    });

    it("should update when owners change", () => {
      storage.channelRecipients.ensureExists("telegram", "111", true);
      syncOwnerAllowFrom(storage, configPath);

      let config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.commands.ownerAllowFrom).toContain("telegram:111");

      // Revoke owner
      storage.channelRecipients.setOwner("telegram", "111", false);
      syncOwnerAllowFrom(storage, configPath);

      config = JSON.parse(readFileSync(configPath, "utf-8"));
      expect(config.commands.ownerAllowFrom).not.toContain("telegram:111");
      expect(config.commands.ownerAllowFrom).toEqual(["openclaw-control-ui"]);
    });
  });

  describe("buildOwnerAllowFrom", () => {
    it("should return array with openclaw-control-ui when no owners", () => {
      const result = buildOwnerAllowFrom(storage);
      expect(result).toEqual(["openclaw-control-ui"]);
    });

    it("should return all owners with channel prefix", () => {
      storage.channelRecipients.ensureExists("telegram", "111", true);
      storage.channelRecipients.ensureExists("whatsapp", "222", true);
      storage.channelRecipients.ensureExists("telegram", "333", false);

      const result = buildOwnerAllowFrom(storage);
      expect(result).toEqual([
        "openclaw-control-ui",
        "telegram:111",
        "whatsapp:222",
      ]);
    });
  });
});
