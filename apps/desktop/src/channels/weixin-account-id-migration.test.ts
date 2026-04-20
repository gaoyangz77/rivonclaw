import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { migrateWeixinAccountKeys } from "./weixin-account-id-migration.js";

let dir: string;
let configPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "weixin-mig-"));
  configPath = join(dir, "openclaw.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("migrateWeixinAccountKeys", () => {
  it("rewrites @im.bot key to dash form preserving the config blob", () => {
    const before = {
      channels: {
        "openclaw-weixin": {
          accounts: {
            "abc123@im.bot": { token: "secret-1", name: "abc123@im.bot" },
          },
        },
      },
    };
    writeFileSync(configPath, JSON.stringify(before, null, 2), "utf-8");

    migrateWeixinAccountKeys(configPath);

    const after = JSON.parse(readFileSync(configPath, "utf-8")) as typeof before;
    const accounts = after.channels["openclaw-weixin"].accounts as Record<string, { token?: string; name?: string }>;
    expect(Object.keys(accounts)).toEqual(["abc123-im-bot"]);
    expect(accounts["abc123-im-bot"]).toEqual({ token: "secret-1", name: "abc123@im.bot" });
  });

  it("rewrites @im.wechat key to dash form", () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        channels: { "openclaw-weixin": { accounts: { "xyz@im.wechat": { foo: "bar" } } } },
      }),
      "utf-8",
    );

    migrateWeixinAccountKeys(configPath);

    const after = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(Object.keys(after.channels["openclaw-weixin"].accounts)).toEqual(["xyz-im-wechat"]);
  });

  it("is idempotent: already-canonical file is not rewritten", () => {
    const before = {
      channels: {
        "openclaw-weixin": {
          accounts: { "stable-im-bot": { token: "keep" } },
        },
      },
    };
    const original = JSON.stringify(before, null, 2);
    writeFileSync(configPath, original, "utf-8");

    migrateWeixinAccountKeys(configPath);

    const raw = readFileSync(configPath, "utf-8");
    // No trailing newline appended, no reordering — exact byte equality.
    expect(raw).toBe(original);
  });

  it("resolves conflict by preferring dash form over @ form", () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        channels: {
          "openclaw-weixin": {
            accounts: {
              "collide-im-bot": { keep: "dash" },
              "collide@im.bot": { keep: "at" },
            },
          },
        },
      }),
      "utf-8",
    );

    migrateWeixinAccountKeys(configPath);

    const after = JSON.parse(readFileSync(configPath, "utf-8"));
    const accounts = after.channels["openclaw-weixin"].accounts;
    expect(Object.keys(accounts)).toEqual(["collide-im-bot"]);
    expect(accounts["collide-im-bot"]).toEqual({ keep: "dash" });
  });

  it("returns cleanly when the config file is missing", () => {
    // configPath was not written
    expect(existsSync(configPath)).toBe(false);
    expect(() => migrateWeixinAccountKeys(configPath)).not.toThrow();
    expect(existsSync(configPath)).toBe(false);
  });

  it("returns cleanly on corrupted JSON without throwing or writing", () => {
    writeFileSync(configPath, "{ this is not json", "utf-8");

    expect(() => migrateWeixinAccountKeys(configPath)).not.toThrow();

    // File left untouched
    expect(readFileSync(configPath, "utf-8")).toBe("{ this is not json");
  });

  it("no-ops when channels.openclaw-weixin is absent", () => {
    const before = { channels: { telegram: { accounts: { "bot@im.bot": {} } } } };
    const original = JSON.stringify(before, null, 2);
    writeFileSync(configPath, original, "utf-8");

    migrateWeixinAccountKeys(configPath);

    expect(readFileSync(configPath, "utf-8")).toBe(original);
  });

  it("migrates multiple @ keys in one pass", () => {
    writeFileSync(
      configPath,
      JSON.stringify({
        channels: {
          "openclaw-weixin": {
            accounts: {
              "a@im.bot": { n: 1 },
              "b@im.wechat": { n: 2 },
              "c-im-bot": { n: 3 },
            },
          },
        },
      }),
      "utf-8",
    );

    migrateWeixinAccountKeys(configPath);

    const after = JSON.parse(readFileSync(configPath, "utf-8"));
    const keys = Object.keys(after.channels["openclaw-weixin"].accounts).sort();
    expect(keys).toEqual(["a-im-bot", "b-im-wechat", "c-im-bot"]);
  });
});
