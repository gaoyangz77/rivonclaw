import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateFeishuBotName } from "./feishu-bot-name-migration.js";

let dir: string;
let configPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "feishu-botname-mig-"));
  configPath = join(dir, "openclaw.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("migrateFeishuBotName", () => {
  it("removes botName from Feishu account configs", () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        channels: {
          feishu: {
            accounts: {
              default: {
                appId: "cli_test",
                botName: "My Bot",
                enabled: true,
              },
              secondary: {
                appId: "cli_other",
                botName: "Other Bot",
              },
            },
          },
        },
      }, null, 2),
      "utf-8",
    );

    migrateFeishuBotName(configPath);

    const after = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(after.channels.feishu.accounts.default).toEqual({
      appId: "cli_test",
      enabled: true,
    });
    expect(after.channels.feishu.accounts.secondary).toEqual({
      appId: "cli_other",
    });
  });

  it("is idempotent when no botName fields remain", () => {
    const before = {
      channels: {
        feishu: {
          accounts: {
            default: {
              appId: "cli_test",
              enabled: true,
            },
          },
        },
      },
    };
    const original = JSON.stringify(before, null, 2);
    writeFileSync(configPath, original, "utf-8");

    migrateFeishuBotName(configPath);

    expect(readFileSync(configPath, "utf-8")).toBe(original);
  });

  it("returns cleanly when config file is missing", () => {
    expect(existsSync(configPath)).toBe(false);
    expect(() => migrateFeishuBotName(configPath)).not.toThrow();
  });

  it("returns cleanly on corrupted JSON without modifying the file", () => {
    writeFileSync(configPath, "{ not json", "utf-8");

    expect(() => migrateFeishuBotName(configPath)).not.toThrow();
    expect(readFileSync(configPath, "utf-8")).toBe("{ not json");
  });

  it("does not touch non-Feishu channels", () => {
    const before = {
      channels: {
        telegram: {
          accounts: {
            default: {
              botName: "leave-me-alone",
            },
          },
        },
      },
    };
    const original = JSON.stringify(before, null, 2);
    writeFileSync(configPath, original, "utf-8");

    migrateFeishuBotName(configPath);

    expect(readFileSync(configPath, "utf-8")).toBe(original);
  });
});
