import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { resolveAuthProfilePath, writeGatewayConfig } from "@rivonclaw/gateway";
import type { ProviderKeyEntry } from "@rivonclaw/core";
import {
  projectProviderMetadataFromVendor,
  writeVendorProviderDefinition,
} from "./vendor-provider-runtime.js";

function metadata(
  id: string,
  provider: string,
  authType: ProviderKeyEntry["authType"],
): ProviderKeyEntry {
  return {
    id,
    provider,
    label: id,
    model: "stale-sqlite-model",
    isDefault: provider === "openai",
    authType,
    source: "local",
    createdAt: "",
    updatedAt: "",
  };
}

describe("Vendor provider runtime projection", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function setup(openaiOrder: string[]): {
    stateDir: string;
    configPath: string;
  } {
    const root = mkdtempSync(join(tmpdir(), "vendor-provider-runtime-"));
    tempDirs.push(root);
    const stateDir = join(root, "state");
    const configPath = join(stateDir, "openclaw.json");
    writeGatewayConfig({
      configPath,
      gatewayPort: 18789,
      defaultModel: { provider: "openai", modelId: "gpt-5.6-terra" },
    });
    const authPath = resolveAuthProfilePath(stateDir);
    mkdirSync(dirname(authPath), { recursive: true });
    writeFileSync(
      authPath,
      JSON.stringify({
        version: 1,
        profiles: {
          "openai:active": {
            type: "api_key",
            provider: "openai",
            key: "not-exposed",
          },
          "openai:codex@example.com": {
            type: "oauth",
            provider: "openai",
            access: "not-exposed",
            refresh: "not-exposed",
            expires: Date.now() + 60_000,
          },
        },
        order: { openai: openaiOrder },
      }),
    );
    return { stateDir, configPath };
  }

  it("selects Codex metadata from Vendor OAuth order and ignores stale SQLite defaults", () => {
    const { stateDir, configPath } = setup(["openai:codex@example.com", "openai:active"]);
    const projected = projectProviderMetadataFromVendor({
      entries: [
        metadata("openai-api", "openai", "api_key"),
        metadata("codex-oauth", "openai-codex", "oauth"),
      ],
      configPath,
      stateDir,
    });

    expect(projected.find((entry) => entry.id === "openai-api")?.isDefault).toBe(false);
    expect(projected.find((entry) => entry.id === "codex-oauth")).toMatchObject({
      isDefault: true,
      model: "gpt-5.6-terra",
    });
  });

  it("selects the OpenAI API product row when Vendor auth order is api_key", () => {
    const { stateDir, configPath } = setup(["openai:active", "openai:codex@example.com"]);
    const projected = projectProviderMetadataFromVendor({
      entries: [
        metadata("openai-api", "openai", "api_key"),
        metadata("codex-oauth", "openai-codex", "oauth"),
      ],
      configPath,
      stateDir,
    });

    expect(projected.find((entry) => entry.id === "openai-api")).toMatchObject({
      isDefault: true,
      model: "gpt-5.6-terra",
    });
    expect(projected.find((entry) => entry.id === "codex-oauth")?.isDefault).toBe(false);
  });

  it("writes custom provider definitions without replacing unrelated Vendor providers", () => {
    const { configPath } = setup(["openai:active"]);
    const before = JSON.parse(readFileSync(configPath, "utf8")) as Record<string, unknown>;
    const models = (before.models ??= {}) as { providers?: Record<string, unknown> };
    models.providers = {
      ...models.providers,
      "vendor-owned": {
        baseUrl: "https://vendor.example/v1",
        api: "openai-completions",
        models: [{ id: "vendor-model", name: "Vendor Model" }],
      },
    };
    writeFileSync(configPath, `${JSON.stringify(before, null, 2)}\n`);

    writeVendorProviderDefinition({
      configPath,
      entry: {
        ...metadata("custom-key", "customer-proxy", "custom"),
        model: "customer-model",
        baseUrl: "https://customer.example/v1",
        customProtocol: "openai",
        customModelsJson: JSON.stringify([{ id: "customer-model" }]),
      },
    });

    const after = JSON.parse(readFileSync(configPath, "utf8")) as {
      models: { providers: Record<string, unknown> };
    };
    expect(after.models.providers["vendor-owned"]).toBeDefined();
    expect(after.models.providers["customer-proxy"]).toMatchObject({
      baseUrl: "https://customer.example/v1",
    });
  });
});
