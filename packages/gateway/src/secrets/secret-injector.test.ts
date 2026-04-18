import { describe, it, expect } from "vitest";
import { resolveSecretEnv, buildGatewayEnv } from "./secret-injector.js";
import type { SecretStore } from "@rivonclaw/secrets";

class MockSecretStore implements SecretStore {
  private store = new Map<string, string>();

  constructor(initial?: Record<string, string>) {
    if (initial) {
      for (const [k, v] of Object.entries(initial)) {
        this.store.set(k, v);
      }
    }
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }
  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }
  async delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }
  async listKeys(): Promise<string[]> {
    return [...this.store.keys()];
  }
}

describe("resolveSecretEnv", () => {
  it("should return empty object when no secrets set", async () => {
    const store = new MockSecretStore();
    const env = await resolveSecretEnv(store);
    expect(Object.keys(env)).toHaveLength(0);
  });

  it("should NOT inject LLM provider API keys (auth-profiles handles these now)", async () => {
    const store = new MockSecretStore({
      "openai-api-key": "sk-openai-123",
      "anthropic-api-key": "sk-ant-456",
    });

    const env = await resolveSecretEnv(store);
    // LLM keys should NOT be in env — they go through auth-profiles.json
    expect(env).not.toHaveProperty("OPENAI_API_KEY");
    expect(env).not.toHaveProperty("ANTHROPIC_API_KEY");
  });

  it("should inject non-LLM static secrets (STT, web search, embedding)", async () => {
    const store = new MockSecretStore({
      "stt-api-key": "stt-key-789",
      "stt-groq-apikey": "groq-stt",
      "websearch-brave-apikey": "brave-key",
      "embedding-openai-apikey": "emb-key",
    });

    const env = await resolveSecretEnv(store);
    expect(env["STT_API_KEY"]).toBe("stt-key-789");
    expect(env["GROQ_API_KEY"]).toBe("groq-stt");
    expect(env["RIVONCLAW_WS_BRAVE_APIKEY"]).toBe("brave-key");
    expect(env["RIVONCLAW_EMB_OPENAI_APIKEY"]).toBe("emb-key");
  });

  it("should skip secrets that are not set", async () => {
    const store = new MockSecretStore({
      "stt-api-key": "stt-key",
    });

    const env = await resolveSecretEnv(store);
    expect(env["STT_API_KEY"]).toBe("stt-key");
    expect(Object.keys(env)).toHaveLength(1);
  });
});

describe("buildGatewayEnv", () => {
  it("should merge process env with non-LLM secrets", async () => {
    const store = new MockSecretStore({
      "stt-api-key": "stt-secret",
    });

    const env = await buildGatewayEnv(store);
    expect(env["STT_API_KEY"]).toBe("stt-secret");
    // Should include process.env values
    expect(env["PATH"]).toBeDefined();
    // Should NOT include LLM keys
    expect(env).not.toHaveProperty("OPENAI_API_KEY");
  });

  it("should merge extra env vars", async () => {
    const store = new MockSecretStore();
    const env = await buildGatewayEnv(store, { CUSTOM_VAR: "custom-value" });
    expect(env["CUSTOM_VAR"]).toBe("custom-value");
  });

  it("should let secrets override extra env", async () => {
    const store = new MockSecretStore({
      "stt-api-key": "from-secrets",
    });

    const env = await buildGatewayEnv(store, { STT_API_KEY: "from-extra" });
    expect(env["STT_API_KEY"]).toBe("from-secrets");
  });
});
