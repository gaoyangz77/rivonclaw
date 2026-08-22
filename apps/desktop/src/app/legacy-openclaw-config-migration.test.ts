import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  migrateLegacyOpenAISessionProviders,
  migrateLegacyOpenClawConfig,
  migrateLegacyMainAgentWorkspace,
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
      JSON.stringify(
        {
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
              "byteplus",
              "mistral",
              "synthetic",
              "volcengine",
              "xiaomi",
            ],
            entries: {
              "rivonclaw-tools": { enabled: true },
              "rivonclaw-policy": { enabled: true },
            },
          },
        },
        null,
        2,
      ),
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
    expect((config.plugins as { deny: string[] }).deny).toEqual(["xai"]);
    expect((config.plugins as { entries: Record<string, unknown> }).entries).toEqual({
      "rivonclaw-policy": { enabled: true },
    });
  });

  it("moves legacy audio models to the shared media model list", () => {
    const configPath = makeConfigPath();
    writeFileSync(
      configPath,
      JSON.stringify({
        tools: {
          media: {
            models: [{ provider: "openai", model: "gpt-4o", capabilities: ["image"] }],
            audio: {
              enabled: true,
              models: [
                {
                  provider: "groq",
                  model: "whisper-large-v3-turbo",
                  type: "provider",
                  capabilities: ["audio"],
                },
              ],
            },
          },
        },
      }),
      "utf-8",
    );

    migrateLegacyOpenClawConfig(configPath);

    expect(readConfig(configPath).tools).toEqual({
      media: {
        models: [
          { provider: "openai", model: "gpt-4o", capabilities: ["image"] },
          {
            provider: "groq",
            model: "whisper-large-v3-turbo",
            type: "provider",
            capabilities: ["audio"],
          },
        ],
        audio: { enabled: true },
      },
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
      JSON.stringify(
        {
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
        },
        null,
        2,
      ),
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

describe("migrateLegacyMainAgentWorkspace", () => {
  it("moves durable main-agent context out of the legacy shared workspace", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-main-workspace-migration-"));
    roots.push(stateDir);
    const legacyWorkspace = join(stateDir, "workspace");
    const mainWorkspace = join(legacyWorkspace, "main");
    const globalSkills = join(stateDir, "skills");

    mkdirSync(join(legacyWorkspace, "memory"), { recursive: true });
    mkdirSync(join(legacyWorkspace, "skills", "local-skill"), { recursive: true });
    mkdirSync(mainWorkspace, { recursive: true });
    mkdirSync(join(globalSkills, "official-preset"), { recursive: true });
    writeFileSync(join(legacyWorkspace, "IDENTITY.md"), "legacy identity", "utf-8");
    writeFileSync(join(legacyWorkspace, "USER.md"), "legacy user", "utf-8");
    writeFileSync(join(legacyWorkspace, "MEMORY.md"), "legacy memory", "utf-8");
    writeFileSync(join(legacyWorkspace, "memory", "2026-08-22.md"), "daily memory", "utf-8");
    writeFileSync(join(legacyWorkspace, "skills", "local-skill", "SKILL.md"), "local", "utf-8");
    writeFileSync(join(mainWorkspace, "BOOTSTRAP.md"), "new setup", "utf-8");
    writeFileSync(join(mainWorkspace, "IDENTITY.md"), "generated template", "utf-8");
    writeFileSync(join(globalSkills, "official-preset", "SKILL.md"), "official", "utf-8");

    migrateLegacyMainAgentWorkspace(stateDir);

    expect(readFileSync(join(mainWorkspace, "IDENTITY.md"), "utf-8")).toBe("legacy identity");
    expect(readFileSync(join(mainWorkspace, "USER.md"), "utf-8")).toBe("legacy user");
    expect(readFileSync(join(mainWorkspace, "MEMORY.md"), "utf-8")).toBe("legacy memory");
    expect(readFileSync(join(mainWorkspace, "memory", "2026-08-22.md"), "utf-8")).toBe(
      "daily memory",
    );
    expect(readFileSync(join(mainWorkspace, "skills", "local-skill", "SKILL.md"), "utf-8")).toBe(
      "local",
    );
    expect(existsSync(join(mainWorkspace, "BOOTSTRAP.md"))).toBe(false);
    expect(readFileSync(join(globalSkills, "official-preset", "SKILL.md"), "utf-8")).toBe(
      "official",
    );
    expect(readFileSync(join(legacyWorkspace, "IDENTITY.md"), "utf-8")).toBe("legacy identity");

    writeFileSync(join(legacyWorkspace, "IDENTITY.md"), "changed after migration", "utf-8");
    migrateLegacyMainAgentWorkspace(stateDir);
    expect(readFileSync(join(mainWorkspace, "IDENTITY.md"), "utf-8")).toBe("legacy identity");
  });

  it("preserves an already-active main workspace while filling missing memory", () => {
    const stateDir = mkdtempSync(join(tmpdir(), "rivonclaw-main-workspace-migration-"));
    roots.push(stateDir);
    const legacyWorkspace = join(stateDir, "workspace");
    const mainWorkspace = join(legacyWorkspace, "main");

    mkdirSync(join(legacyWorkspace, "memory"), { recursive: true });
    mkdirSync(mainWorkspace, { recursive: true });
    writeFileSync(join(legacyWorkspace, "IDENTITY.md"), "legacy identity", "utf-8");
    writeFileSync(join(legacyWorkspace, "memory", "old.md"), "old memory", "utf-8");
    writeFileSync(join(mainWorkspace, "IDENTITY.md"), "active identity", "utf-8");

    migrateLegacyMainAgentWorkspace(stateDir);

    expect(readFileSync(join(mainWorkspace, "IDENTITY.md"), "utf-8")).toBe("active identity");
    expect(readFileSync(join(mainWorkspace, "memory", "old.md"), "utf-8")).toBe("old memory");
  });
});
