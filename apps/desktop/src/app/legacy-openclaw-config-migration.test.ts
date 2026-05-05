import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { migrateLegacyOpenClawConfig } from "./legacy-openclaw-config-migration.js";

const roots: string[] = [];

function makeConfigPath(): string {
  const root = mkdtempSync(join(tmpdir(), "rivonclaw-legacy-config-"));
  roots.push(root);
  return join(root, "openclaw.json");
}

function readConfig(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf-8")) as Record<string, unknown>;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("migrateLegacyOpenClawConfig", () => {
  it("removes OpenClaw fields and plugins that are no longer supported", () => {
    const configPath = makeConfigPath();
    writeFileSync(
      configPath,
      JSON.stringify({
        agents: {
          defaults: {
            model: { primary: "rivonclaw-pro/gpt-5.4" },
            llm: { idleTimeoutSeconds: 300 },
          },
        },
        plugins: {
          allow: ["memory-core", "rivonclaw-tools", "modelstudio"],
          deny: ["xai", "easyclaw-tools"],
          entries: {
            "rivonclaw-tools": { enabled: true },
            "rivonclaw-policy": { enabled: true },
          },
        },
      }, null, 2),
      "utf-8",
    );

    migrateLegacyOpenClawConfig(configPath);

    const config = readConfig(configPath);
    expect((config.agents as { defaults: Record<string, unknown> }).defaults.llm).toBeUndefined();
    expect((config.plugins as { allow: string[] }).allow).toEqual(["memory-core"]);
    expect((config.plugins as { deny: string[] }).deny).toEqual(["xai"]);
    expect((config.plugins as { entries: Record<string, unknown> }).entries).toEqual({
      "rivonclaw-policy": { enabled: true },
    });
  });

  it("migrates provider-owned web search config and preserves event bridge hook policy", () => {
    const configPath = makeConfigPath();
    writeFileSync(
      configPath,
      JSON.stringify({
        tools: {
          web: {
            search: {
              enabled: true,
              provider: "grok",
              apiKey: "${RIVONCLAW_WS_BRAVE_APIKEY}",
              grok: {
                apiKey: "${RIVONCLAW_WS_GROK_APIKEY}",
                model: "grok-4-search",
              },
              kimi: {
                model: "kimi-k2.5",
              },
            },
          },
        },
        plugins: {
          entries: {
            "rivonclaw-event-bridge": {
              enabled: true,
              hooks: { allowConversationAccess: true },
            },
          },
        },
      }, null, 2),
      "utf-8",
    );

    migrateLegacyOpenClawConfig(configPath);

    const config = readConfig(configPath) as {
      tools: { web: { search: Record<string, unknown> } };
      plugins: { entries: Record<string, { config?: Record<string, unknown>; hooks?: unknown }> };
    };
    expect(config.tools.web.search).toEqual({ enabled: true, provider: "grok" });
    expect(config.plugins.entries.brave.config).toEqual({
      webSearch: { apiKey: "${RIVONCLAW_WS_BRAVE_APIKEY}" },
    });
    expect(config.plugins.entries.xai.config).toEqual({
      webSearch: {
        apiKey: "${RIVONCLAW_WS_GROK_APIKEY}",
        model: "grok-4-search",
      },
    });
    expect(config.plugins.entries.moonshot.config).toEqual({
      webSearch: { model: "kimi-k2.5" },
    });
    expect(config.plugins.entries["rivonclaw-event-bridge"].hooks).toEqual({
      allowConversationAccess: true,
    });
  });
});
