import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { migrateLegacyMobileChannelConfig } from "./mobile-channel-config-migration.js";

let tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

function makeConfigPath(initial: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "rivonclaw-mobile-migration-"));
  tempDirs.push(dir);
  const configPath = join(dir, "openclaw.json");
  writeFileSync(configPath, JSON.stringify(initial, null, 2) + "\n", "utf-8");
  return configPath;
}

describe("migrateLegacyMobileChannelConfig", () => {
  it("removes stale channels.mobile while preserving sibling channels", () => {
    const configPath = makeConfigPath({
      channels: {
        mobile: { managed: true },
        "openclaw-weixin": { managed: true },
      },
    });

    migrateLegacyMobileChannelConfig(configPath);

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.channels.mobile).toBeUndefined();
    expect(config.channels["openclaw-weixin"]).toEqual({ managed: true });
  });

  it("is a no-op when channels.mobile is absent", () => {
    const configPath = makeConfigPath({
      channels: {
        "openclaw-weixin": { managed: true },
      },
    });
    const before = readFileSync(configPath, "utf-8");

    migrateLegacyMobileChannelConfig(configPath);

    expect(readFileSync(configPath, "utf-8")).toBe(before);
  });

  it("does not throw on invalid JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "rivonclaw-mobile-migration-"));
    tempDirs.push(dir);
    const configPath = join(dir, "openclaw.json");
    writeFileSync(configPath, "{not json", "utf-8");

    expect(() => migrateLegacyMobileChannelConfig(configPath)).not.toThrow();
  });
});
