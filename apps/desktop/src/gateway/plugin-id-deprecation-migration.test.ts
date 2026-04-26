import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateDeprecatedPluginIds } from "./plugin-id-deprecation-migration.js";

let tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true });
  tempDirs = [];
});

function makeConfigPath(initial: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "rivonclaw-plugin-id-migration-"));
  tempDirs.push(dir);
  const configPath = join(dir, "openclaw.json");
  writeFileSync(configPath, JSON.stringify(initial, null, 2) + "\n", "utf-8");
  return configPath;
}

describe("migrateDeprecatedPluginIds", () => {
  it("removes policy plugin ids from entries and allow/deny lists", () => {
    const configPath = makeConfigPath({
      plugins: {
        entries: {
          "rivonclaw-policy": { enabled: true },
          telegram: { enabled: true },
        },
        allow: ["telegram", "easyclaw-policy", "rivonclaw-policy"],
        deny: ["rivonclaw-policy", "xai"],
      },
    });

    migrateDeprecatedPluginIds(configPath);

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.plugins.entries["rivonclaw-policy"]).toBeUndefined();
    expect(config.plugins.entries.telegram).toEqual({ enabled: true });
    expect(config.plugins.allow).toEqual(["telegram"]);
    expect(config.plugins.deny).toEqual(["xai"]);
  });

  it("is a no-op when deprecated plugin ids are absent", () => {
    const configPath = makeConfigPath({
      plugins: {
        entries: { telegram: { enabled: true } },
        allow: ["telegram"],
      },
    });
    const before = readFileSync(configPath, "utf-8");

    migrateDeprecatedPluginIds(configPath);

    expect(readFileSync(configPath, "utf-8")).toBe(before);
  });

  it("does not throw on invalid JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "rivonclaw-plugin-id-migration-"));
    tempDirs.push(dir);
    const configPath = join(dir, "openclaw.json");
    writeFileSync(configPath, "{not json", "utf-8");

    expect(() => migrateDeprecatedPluginIds(configPath)).not.toThrow();
  });
});
