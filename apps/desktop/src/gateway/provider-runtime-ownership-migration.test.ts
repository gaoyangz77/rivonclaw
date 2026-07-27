import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrateLegacyDesktopProviderDefinitions } from "./provider-runtime-ownership-migration.js";

describe("provider runtime ownership migration", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it("removes legacy Desktop definitions once while preserving user providers", () => {
    tempDir = mkdtempSync(join(tmpdir(), "provider-ownership-migration-"));
    const configPath = join(tempDir, "openclaw.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        models: {
          mode: "merge",
          providers: {
            openai: { baseUrl: "https://api.rivonclaw.com/llm/v1", models: [] },
            volcengine: { baseUrl: "https://ark.cn-beijing.volces.com/api/v3", models: [] },
            "customer-proxy": {
              baseUrl: "https://customer.example/v1",
              models: [],
            },
            "rivonclaw-pro": {
              baseUrl: "https://api.rivonclaw.com/llm/v1",
              models: [],
            },
          },
        },
      }),
    );

    expect(migrateLegacyDesktopProviderDefinitions(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    expect(config.models.providers.openai).toBeUndefined();
    expect(config.models.providers.volcengine).toBeUndefined();
    expect(config.models.providers["customer-proxy"]).toBeDefined();
    expect(config.models.providers["rivonclaw-pro"]).toBeDefined();
    expect(migrateLegacyDesktopProviderDefinitions(configPath)).toBe(false);
  });

  it("preserves a legitimate user or Vendor OpenAI definition", () => {
    tempDir = mkdtempSync(join(tmpdir(), "provider-ownership-migration-"));
    const configPath = join(tempDir, "openclaw.json");
    writeFileSync(
      configPath,
      JSON.stringify({
        models: {
          mode: "merge",
          providers: {
            openai: {
              baseUrl: "https://api.openai.com/v1",
              api: "openai-responses",
              models: [{ id: "user-model", name: "User Model" }],
            },
            volcengine: {
              baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
              models: [],
            },
          },
        },
      }),
    );

    expect(migrateLegacyDesktopProviderDefinitions(configPath)).toBe(true);
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    expect(config.models.providers.openai).toMatchObject({
      baseUrl: "https://api.openai.com/v1",
    });
    expect(config.models.providers.volcengine).toBeUndefined();
  });
});
