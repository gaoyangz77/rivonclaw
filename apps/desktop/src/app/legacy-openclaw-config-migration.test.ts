import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  migrateLegacyOpenAISessionProviders,
  migrateLegacyOpenClawConfig,
} from "./legacy-openclaw-config-migration.js";

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
            model: {
              primary: "openai-codex/gpt-5.5",
              fallbacks: ["openai-codex/gpt-5.4", "anthropic/claude-sonnet-4-6"],
            },
            models: {
              "openai-codex/gpt-5.5": { alias: "GPT" },
            },
            compaction: { model: "openai-codex/gpt-5.4-mini" },
            llm: { idleTimeoutSeconds: 300 },
          },
        },
        plugins: {
          load: {
            paths: [
              "/Applications/RivonClaw.app/Contents/Resources/extensions",
              "/Applications/RivonClaw.app/Contents/Resources/legacy/@larksuite/openclaw-lark",
              "/some/other/plugin",
            ],
          },
          allow: ["memory-core", "rivonclaw-tools", "modelstudio"],
          deny: [
            "xai",
            "easyclaw-tools",
            "amazon-bedrock",
            "github-copilot",
            "kimi",
            "moonshot",
          ],
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
    const defaults = (config.agents as { defaults: Record<string, unknown> }).defaults;
    expect(defaults.llm).toBeUndefined();
    expect(defaults.model).toEqual({
      primary: "openai/gpt-5.5",
      fallbacks: ["openai/gpt-5.4", "anthropic/claude-sonnet-4-6"],
    });
    expect(defaults.models).toEqual({
      "openai/gpt-5.5": { alias: "GPT" },
    });
    expect(defaults.compaction).toEqual({ model: "openai/gpt-5.4-mini" });
    expect((config.plugins as { load: { paths: string[] } }).load.paths).toEqual([
      "/Applications/RivonClaw.app/Contents/Resources/extensions",
      "/some/other/plugin",
    ]);
    expect((config.plugins as { allow: string[] }).allow).toEqual(["memory-core"]);
    expect((config.plugins as { deny: string[] }).deny).toEqual(["xai", "moonshot"]);
    expect((config.plugins as { entries: Record<string, unknown> }).entries).toEqual({
      "rivonclaw-policy": { enabled: true },
    });
  });

  it("migrates active OpenAI provider fields in session indexes without touching content", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-session-provider-migration-"));
    roots.push(stateDir);
    const sessionsDir = join(stateDir, "agents", "main", "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    const storePath = join(sessionsDir, "sessions.json");
    writeFileSync(
      storePath,
      JSON.stringify({
        "agent:main:main": {
          providerOverride: "openai-codex",
          modelProvider: "openai-codex",
          model: "openai-codex/gpt-5.5",
          displayName: "keep openai-codex/gpt-5.5 in this user-visible title",
        },
        "agent:main:other": {
          providerOverride: "anthropic",
          modelProvider: "anthropic",
          model: "claude-sonnet-4-6",
        },
      }),
      "utf-8",
    );

    migrateLegacyOpenAISessionProviders(stateDir);

    const store = readConfig(storePath) as Record<string, Record<string, unknown>>;
    expect(store["agent:main:main"]).toMatchObject({
      providerOverride: "openai",
      modelProvider: "openai",
      model: "openai/gpt-5.5",
      displayName: "keep openai-codex/gpt-5.5 in this user-visible title",
    });
    expect(store["agent:main:other"]).toMatchObject({
      providerOverride: "anthropic",
      modelProvider: "anthropic",
      model: "claude-sonnet-4-6",
    });
  });

  it("leaves an unreadable session index untouched instead of blocking startup", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-session-provider-migration-"));
    roots.push(stateDir);
    const sessionsDir = join(stateDir, "agents", "main", "sessions");
    mkdirSync(sessionsDir, { recursive: true });
    const storePath = join(sessionsDir, "sessions.json");
    writeFileSync(storePath, "{not-json", "utf-8");

    expect(() => migrateLegacyOpenAISessionProviders(stateDir)).not.toThrow();
    expect(readFileSync(storePath, "utf-8")).toBe("{not-json");
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
