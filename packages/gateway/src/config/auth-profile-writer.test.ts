import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import {
  resolveAuthProfilePath,
  resolveAuthProfileDatabasePath,
  activateAuthProfile,
  syncAuthProfile,
  removeAuthProfile,
  syncAllAuthProfiles,
  clearAllAuthProfiles,
} from "./auth-profile-writer.js";

/**
 * Vendor source paths — used to verify our auth-profile format
 * matches what the vendor code actually accepts.
 */
const VENDOR_ROOT = resolve(import.meta.dirname, "../../../../vendor/openclaw");

function createTempDir(): string {
  const dir = join(
    tmpdir(),
    `auth-profile-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  mkdirSync(dir, { recursive: true });
  return dir;
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function readSqliteStore(stateDir: string): unknown {
  const database = new DatabaseSync(resolveAuthProfileDatabasePath(stateDir), { readOnly: true });
  try {
    const row = database
      .prepare("SELECT store_json FROM auth_profile_store WHERE store_key = ?")
      .get("primary") as { store_json: string };
    return JSON.parse(row.store_json);
  } finally {
    database.close();
  }
}

describe("resolveAuthProfilePath", () => {
  it("returns the correct path structure", () => {
    const result = resolveAuthProfilePath("/home/user/.rivonclaw/openclaw");
    expect(result).toBe(
      join("/home/user/.rivonclaw/openclaw", "agents", "main", "agent", "auth-profiles.json"),
    );
  });

  it("returns the SQLite auth store used by current OpenClaw", () => {
    const result = resolveAuthProfileDatabasePath("/home/user/.rivonclaw/openclaw");
    expect(result).toBe(
      join("/home/user/.rivonclaw/openclaw", "agents", "main", "agent", "openclaw-agent.sqlite"),
    );
  });
});

describe("syncAuthProfile", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = createTempDir();
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("creates auth-profiles.json with a single provider key", () => {
    syncAuthProfile(stateDir, "qwen", "sk-test-key-123");

    const filePath = resolveAuthProfilePath(stateDir);
    expect(existsSync(filePath)).toBe(true);

    const store = readJsonFile(filePath) as Record<string, unknown>;
    expect(store).toEqual({
      version: 1,
      profiles: {
        "qwen:active": {
          type: "api_key",
          provider: "qwen",
          key: "sk-test-key-123",
        },
      },
      order: {
        qwen: ["qwen:active"],
      },
    });
    expect(readSqliteStore(stateDir)).toEqual(store);
  });

  it("overwrites existing profile for the same provider", () => {
    syncAuthProfile(stateDir, "qwen", "sk-old-key");
    syncAuthProfile(stateDir, "qwen", "sk-new-key");

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    const profiles = store.profiles as Record<string, Record<string, string>>;
    expect(profiles["qwen:active"].key).toBe("sk-new-key");
  });

  it("preserves other providers when syncing one", () => {
    syncAuthProfile(stateDir, "openai", "sk-openai-key");
    syncAuthProfile(stateDir, "qwen", "sk-qwen-key");

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    const profiles = store.profiles as Record<string, Record<string, string>>;
    expect(profiles["openai:active"].key).toBe("sk-openai-key");
    expect(profiles["qwen:active"].key).toBe("sk-qwen-key");
  });

  it("treats SQLite as authoritative when the legacy JSON mirror diverges", () => {
    syncAuthProfile(stateDir, "openai", "sk-sqlite-key");

    const filePath = resolveAuthProfilePath(stateDir);
    const staleStore = {
      version: 1,
      profiles: {
        "anthropic:active": {
          type: "api_key",
          provider: "anthropic",
          key: "sk-stale-json-key",
        },
      },
      order: { anthropic: ["anthropic:active"] },
    };
    writeFileSync(filePath, `${JSON.stringify(staleStore, null, 2)}\n`);

    syncAuthProfile(stateDir, "qwen", "sk-qwen-key");

    const store = readSqliteStore(stateDir) as {
      profiles: Record<string, { key: string }>;
    };
    expect(store.profiles["openai:active"].key).toBe("sk-sqlite-key");
    expect(store.profiles["qwen:active"].key).toBe("sk-qwen-key");
    expect(store.profiles["anthropic:active"]).toBeUndefined();
    expect(readJsonFile(filePath)).toEqual(store);
  });

  it("maps subscription plan names to gateway provider names", () => {
    syncAuthProfile(stateDir, "claude", "sk-claude-token");

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    const profiles = store.profiles as Record<string, Record<string, string>>;
    const order = store.order as Record<string, string[]>;

    // "claude" should be stored under "anthropic" (the gateway provider name)
    expect(profiles["anthropic:active"]).toBeDefined();
    expect(profiles["anthropic:active"].provider).toBe("anthropic");
    expect(profiles["anthropic:active"].key).toBe("sk-claude-token");
    expect(order["anthropic"]).toEqual(["anthropic:active"]);
    // No "claude" key should exist
    expect(profiles["claude:active"]).toBeUndefined();
    expect(order["claude"]).toBeUndefined();
  });
});

describe("removeAuthProfile", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = createTempDir();
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("removes a provider's profile and order", () => {
    syncAuthProfile(stateDir, "openai", "sk-openai-key");
    syncAuthProfile(stateDir, "qwen", "sk-qwen-key");

    removeAuthProfile(stateDir, "qwen");

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    const profiles = store.profiles as Record<string, unknown>;
    const order = store.order as Record<string, string[]>;

    expect(profiles["qwen:active"]).toBeUndefined();
    expect(order["qwen"]).toBeUndefined();
    // OpenAI should still be there
    expect(profiles["openai:active"]).toBeDefined();
    expect(order["openai"]).toEqual(["openai:active"]);
  });

  it("handles removing from empty store", () => {
    removeAuthProfile(stateDir, "qwen");

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    expect(store).toEqual({ version: 1, profiles: {}, order: {} });
    expect(readSqliteStore(stateDir)).toEqual(store);
  });
});

describe("syncAllAuthProfiles", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = createTempDir();
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("syncs all providers with keys, not just the default", async () => {
    const mockStorage = {
      providerKeys: {
        getAll: () => [
          { id: "key-1", provider: "openai", isDefault: true },
          { id: "key-2", provider: "openai", isDefault: false },
          { id: "key-3", provider: "qwen", isDefault: false },
        ],
      },
    };
    const mockSecretStore = {
      get: async (key: string) => {
        const secrets: Record<string, string> = {
          "provider-key-key-1": "sk-openai-active",
          "provider-key-key-2": "sk-openai-inactive",
          "provider-key-key-3": "sk-qwen-active",
        };
        return secrets[key] ?? null;
      },
    };

    await syncAllAuthProfiles(stateDir, mockStorage, mockSecretStore);

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;

    // Both openai (default key) AND qwen (non-default) should be written
    expect(store).toEqual({
      version: 1,
      profiles: {
        "openai:active": {
          type: "api_key",
          provider: "openai",
          key: "sk-openai-active",
        },
        "qwen:active": {
          type: "api_key",
          provider: "qwen",
          key: "sk-qwen-active",
        },
      },
      order: {
        openai: ["openai:active"],
        qwen: ["qwen:active"],
      },
    });
  });

  it("prefers default key when multiple keys exist for same provider", async () => {
    const mockStorage = {
      providerKeys: {
        getAll: () => [
          { id: "key-1", provider: "openai", isDefault: false },
          { id: "key-2", provider: "openai", isDefault: true },
        ],
      },
    };
    const mockSecretStore = {
      get: async (key: string) => {
        const secrets: Record<string, string> = {
          "provider-key-key-1": "sk-openai-first",
          "provider-key-key-2": "sk-openai-default",
        };
        return secrets[key] ?? null;
      },
    };

    await syncAllAuthProfiles(stateDir, mockStorage, mockSecretStore);

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    const profiles = store.profiles as Record<string, Record<string, string>>;

    // The default key should win
    expect(profiles["openai:active"].key).toBe("sk-openai-default");
  });

  it("keeps OpenAI API-key and Codex OAuth transports under unified openai", async () => {
    const mockStorage = {
      providerKeys: {
        getAll: () => [
          { id: "openai-key", provider: "openai", isDefault: false },
          {
            id: "codex-oauth",
            provider: "openai-codex",
            isDefault: true,
            authType: "oauth",
          },
        ],
      },
    };
    const mockSecretStore = {
      get: async (key: string) => {
        if (key === "provider-key-openai-key") return "sk-openai";
        if (key === "oauth-cred-codex-oauth") {
          return JSON.stringify({
            access: "codex-access",
            refresh: "codex-refresh",
            expires: Date.now() + 3600_000,
            email: "codex@example.com",
          });
        }
        return null;
      },
    };

    await syncAllAuthProfiles(stateDir, mockStorage, mockSecretStore);

    const store = readJsonFile(resolveAuthProfilePath(stateDir)) as {
      profiles: Record<string, Record<string, unknown>>;
      order: Record<string, string[]>;
    };
    expect(store.profiles["openai:active"]).toMatchObject({
      type: "api_key",
      provider: "openai",
      key: "sk-openai",
    });
    expect(store.profiles["openai:codex@example.com"]).toMatchObject({
      type: "oauth",
      provider: "openai",
      access: "codex-access",
    });
    expect(store.order.openai).toEqual(["openai:codex@example.com", "openai:active"]);
  });

  it("skips keys not found in secret store", async () => {
    const mockStorage = {
      providerKeys: {
        getAll: () => [
          { id: "key-1", provider: "openai", isDefault: true },
          { id: "key-2", provider: "qwen", isDefault: false },
        ],
      },
    };
    const mockSecretStore = {
      get: async () => null,
    };

    await syncAllAuthProfiles(stateDir, mockStorage, mockSecretStore);

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    const profiles = store.profiles as Record<string, unknown>;

    // Both keys exist but their secrets are missing — both skipped
    expect(profiles["openai:active"]).toBeUndefined();
    expect(profiles["qwen:active"]).toBeUndefined();
  });

  it("writes empty store when no keys configured", async () => {
    const mockStorage = {
      providerKeys: {
        getAll: () => [],
      },
    };
    const mockSecretStore = {
      get: async () => null,
    };

    await syncAllAuthProfiles(stateDir, mockStorage, mockSecretStore);

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    expect(store).toEqual({ version: 1, profiles: {}, order: {} });
  });

  it("maps subscription plan names to gateway provider names", async () => {
    const mockStorage = {
      providerKeys: {
        getAll: () => [{ id: "key-1", provider: "claude", isDefault: true }],
      },
    };
    const mockSecretStore = {
      get: async (key: string) => {
        if (key === "provider-key-key-1") return "sk-claude-token";
        return null;
      },
    };

    await syncAllAuthProfiles(stateDir, mockStorage, mockSecretStore);

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    const profiles = store.profiles as Record<string, Record<string, string>>;
    const order = store.order as Record<string, string[]>;

    // "claude" key should be stored under "anthropic" gateway name
    expect(profiles["anthropic:active"]).toBeDefined();
    expect(profiles["anthropic:active"].provider).toBe("anthropic");
    expect(order["anthropic"]).toEqual(["anthropic:active"]);
  });

  it("preserves Vendor-owned profiles while merging Desktop credentials", async () => {
    // First sync with 2 providers
    syncAuthProfile(stateDir, "deepseek", "sk-old-deepseek");

    const mockStorage = {
      providerKeys: {
        getAll: () => [{ id: "key-1", provider: "qwen", isDefault: true }],
      },
    };
    const mockSecretStore = {
      get: async (key: string) => {
        if (key === "provider-key-key-1") return "sk-qwen-new";
        return null;
      },
    };

    await syncAllAuthProfiles(stateDir, mockStorage, mockSecretStore);

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    const profiles = store.profiles as Record<string, unknown>;

    expect(profiles["deepseek:active"]).toBeDefined();
    expect(profiles["qwen:active"]).toBeDefined();
  });

  it("activates Codex OAuth without routing it through an OpenAI API key", async () => {
    const mockStorage = {
      providerKeys: {
        getAll: () => [
          { id: "openai-key", provider: "openai", isDefault: false },
          {
            id: "codex-oauth",
            provider: "openai-codex",
            isDefault: false,
            authType: "oauth",
          },
        ],
      },
    };
    const mockSecretStore = {
      get: async (key: string) => {
        if (key === "provider-key-openai-key") return "sk-openai";
        if (key === "oauth-cred-codex-oauth") {
          return JSON.stringify({
            access: "codex-access",
            refresh: "codex-refresh",
            expires: Date.now() + 3600_000,
            email: "codex@example.com",
          });
        }
        return null;
      },
    };

    await syncAllAuthProfiles(stateDir, mockStorage, mockSecretStore);
    const selected = activateAuthProfile(stateDir, "openai-codex", "oauth");
    const store = readJsonFile(resolveAuthProfilePath(stateDir)) as {
      order: Record<string, string[]>;
    };

    expect(selected).toBe("openai:codex@example.com");
    expect(store.order.openai).toEqual(["openai:codex@example.com", "openai:active"]);
  });
});

describe("clearAllAuthProfiles", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = createTempDir();
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("clears all profiles and creates empty store", () => {
    // First, add some profiles
    syncAuthProfile(stateDir, "openai", "sk-openai-key");
    syncAuthProfile(stateDir, "qwen", "sk-qwen-key");
    syncAuthProfile(stateDir, "anthropic", "sk-anthropic-key");

    // Verify they exist
    const filePath = resolveAuthProfilePath(stateDir);
    let store = readJsonFile(filePath) as Record<string, unknown>;
    let profiles = store.profiles as Record<string, unknown>;
    expect(Object.keys(profiles).length).toBe(3);

    // Clear all profiles
    clearAllAuthProfiles(stateDir);

    // Verify store is now empty
    store = readJsonFile(filePath) as Record<string, unknown>;
    expect(store).toEqual({ version: 1, profiles: {}, order: {} });
  });

  it("handles clearing when file doesn't exist", () => {
    // Should create empty store without throwing
    expect(() => clearAllAuthProfiles(stateDir)).not.toThrow();

    const filePath = resolveAuthProfilePath(stateDir);
    expect(existsSync(filePath)).toBe(true);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    expect(store).toEqual({ version: 1, profiles: {}, order: {} });
  });

  it("handles clearing already empty store", () => {
    // Create empty store first
    clearAllAuthProfiles(stateDir);

    // Clear again
    clearAllAuthProfiles(stateDir);

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as Record<string, unknown>;
    expect(store).toEqual({ version: 1, profiles: {}, order: {} });
  });
});

/**
 * Contract tests: verify our auth-profile format matches what the vendor accepts.
 *
 * These tests read the vendor source code directly to extract expected values.
 * If the vendor changes its format, these tests fail BEFORE we ship a broken build.
 */
describe("vendor contract: auth profile format", () => {
  it("OAuth credential fields match vendor's OAuthCredential type", () => {
    const typesSrc = readFileSync(join(VENDOR_ROOT, "src/agents/auth-profiles/types.ts"), "utf-8");
    expect(typesSrc).toContain('type: "oauth"');
    expect(typesSrc).toContain("provider: string");
    expect(typesSrc).toContain("email?: string");
  });

  it("API key credential fields match vendor's ApiKeyCredential type", () => {
    const typesSrc = readFileSync(join(VENDOR_ROOT, "src/agents/auth-profiles/types.ts"), "utf-8");
    expect(typesSrc).toContain('type: "api_key"');
    expect(typesSrc).toContain("provider: string");
    expect(typesSrc).toContain("key?: string");
  });

  it("OAuth base fields stay aligned with vendor OAuth credential usage", () => {
    // The desktop prune step strips vendor .d.ts files, so this contract test
    // verifies the runtime source shape instead of a generated declaration.
    const writerSrc = readFileSync(join(import.meta.dirname, "auth-profile-writer.ts"), "utf-8");
    // In v2026.4.1 the OAuth credential construction moved from
    // src/providers/qwen-portal-oauth.ts to src/agents/cli-credentials.ts.
    const vendorOauthSrc = readFileSync(
      join(VENDOR_ROOT, "src/agents/cli-credentials.ts"),
      "utf-8",
    );

    expect(writerSrc).toContain("access: string");
    expect(writerSrc).toContain("refresh: string");
    expect(writerSrc).toContain("expires: number");

    // Vendor constructs OAuth credentials with the same field names
    expect(vendorOauthSrc).toContain("access: accessToken");
    expect(vendorOauthSrc).toContain("refresh: refreshToken");
    expect(vendorOauthSrc).toContain("expires:");
  });
});

describe("syncAllAuthProfiles: OAuth entries", () => {
  let stateDir: string;

  beforeEach(() => {
    stateDir = createTempDir();
  });

  afterEach(() => {
    rmSync(stateDir, { recursive: true, force: true });
  });

  it("purges obsolete Gemini OAuth runtime profiles and managed home", async () => {
    const filePath = resolveAuthProfilePath(stateDir);
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(
      filePath,
      JSON.stringify({
        version: 1,
        profiles: {
          "google-gemini-cli:user@example.com": {
            type: "oauth",
            provider: "google-gemini-cli",
            access: "access",
            refresh: "refresh",
            expires: Date.now() + 60_000,
          },
          "openai:active": { type: "api_key", provider: "openai", key: "key" },
        },
        order: {
          "google-gemini-cli": ["google-gemini-cli:user@example.com"],
          openai: ["openai:active"],
        },
      }),
    );
    mkdirSync(join(stateDir, "gemini-cli-home", ".gemini"), { recursive: true });

    await syncAllAuthProfiles(
      stateDir,
      { providerKeys: { getAll: () => [] } },
      { get: async () => null },
    );

    const store = readJsonFile(filePath) as {
      profiles: Record<string, unknown>;
      order: Record<string, string[]>;
    };
    expect(store.profiles["google-gemini-cli:user@example.com"]).toBeUndefined();
    expect(store.profiles["openai:active"]).toBeDefined();
    expect(store.order["google-gemini-cli"]).toBeUndefined();
    expect(existsSync(join(stateDir, "gemini-cli-home"))).toBe(false);
  });

  it("writes non-Google OAuth as oauth type normally", async () => {
    const mockStorage = {
      providerKeys: {
        getAll: () => [
          { id: "oauth-key-2", provider: "openai", isDefault: true, authType: "oauth" },
        ],
      },
    };
    const mockSecretStore = {
      get: async (key: string) => {
        if (key === "oauth-cred-oauth-key-2") {
          return JSON.stringify({
            access: "test-access-token",
            refresh: "test-refresh-token",
            expires: Date.now() + 3600_000,
            email: "user@example.com",
          });
        }
        return null;
      },
    };

    await syncAllAuthProfiles(stateDir, mockStorage, mockSecretStore);

    const filePath = resolveAuthProfilePath(stateDir);
    const store = readJsonFile(filePath) as {
      profiles: Record<string, Record<string, unknown>>;
      order: Record<string, string[]>;
    };

    const profile = store.profiles["openai:user@example.com"];
    expect(profile).toBeDefined();
    expect(profile.type).toBe("oauth");
    expect(profile.provider).toBe("openai");
    expect(profile.access).toBe("test-access-token");
  });

  it("writes Codex OAuth directly under OpenClaw's unified openai provider", async () => {
    const mockStorage = {
      providerKeys: {
        getAll: () => [
          {
            id: "codex-oauth-key",
            provider: "openai-codex",
            isDefault: true,
            authType: "oauth",
          },
        ],
      },
    };
    const mockSecretStore = {
      get: async (key: string) =>
        key === "oauth-cred-codex-oauth-key"
          ? JSON.stringify({
              access: "codex-access",
              refresh: "codex-refresh",
              expires: Date.now() + 3600_000,
              email: "codex@example.com",
            })
          : null,
    };

    await syncAllAuthProfiles(stateDir, mockStorage, mockSecretStore);

    const store = readJsonFile(resolveAuthProfilePath(stateDir)) as {
      profiles: Record<string, Record<string, unknown>>;
      order: Record<string, string[]>;
    };
    expect(store.profiles["openai:codex@example.com"]).toMatchObject({
      type: "oauth",
      provider: "openai",
      access: "codex-access",
    });
    expect(Object.keys(store.profiles)).toEqual(["openai:codex@example.com"]);
    expect(store.order.openai).toEqual(["openai:codex@example.com"]);
  });

  it("keeps the RivonClaw cloud key in its own provider namespace", async () => {
    const cloudKey = {
      id: "cloud-rivonclaw-pro",
      provider: "rivonclaw-pro",
      isDefault: true,
      authType: "custom",
    };
    const mockStorage = {
      providerKeys: {
        getAll: () => [cloudKey],
        getActive: () => cloudKey,
      },
    };
    const mockSecretStore = {
      get: async (key: string) =>
        key === "provider-key-cloud-rivonclaw-pro" ? "rcllm_cloud_key" : null,
    };

    await syncAllAuthProfiles(stateDir, mockStorage, mockSecretStore);

    const store = readJsonFile(resolveAuthProfilePath(stateDir)) as {
      profiles: Record<string, Record<string, unknown>>;
      order: Record<string, string[]>;
    };
    expect(store.profiles["rivonclaw-pro:active"]).toEqual({
      type: "api_key",
      provider: "rivonclaw-pro",
      key: "rcllm_cloud_key",
    });
    expect(store.order["rivonclaw-pro"]).toEqual(["rivonclaw-pro:active"]);
    expect(store.profiles["openai:rivonclaw-pro-image"]).toBeUndefined();
  });
});
