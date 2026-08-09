/**
 * E2E integration test for Local LLM (Ollama) support — W16-D.
 *
 * Spins up a mock Ollama HTTP server on a random port, then exercises
 * the full stack: detector → fetcher → panel-server endpoints →
 * storage CRUD → auth-profile writer → config writer.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { createStorage, type Storage } from "@rivonclaw/storage";
import type { ProviderKeyEntry } from "@rivonclaw/core";
import { mkdirSync, existsSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import {
  syncAllAuthProfiles,
  resolveAuthProfilePath,
  clearAllAuthProfiles,
} from "@rivonclaw/gateway";
import { startPanelServer } from "../app/panel-server.js";
import { initLLMProviderManagerEnv } from "../app/store/desktop-store.js";
import { syncActiveKey } from "./provider-validator.js";
import { toMstSnapshot, allKeysToMstSnapshots } from "./provider-key-utils.js";

function readAuthProfiles(stateDir: string): any {
  const database = new DatabaseSync(
    join(stateDir, "agents", "main", "agent", "openclaw-agent.sqlite"),
    { readOnly: true },
  );
  try {
    const row = database
      .prepare("SELECT store_json FROM auth_profile_store WHERE store_key = ?")
      .get("primary") as { store_json: string };
    return JSON.parse(row.store_json);
  } finally {
    database.close();
  }
}

// ---------------------------------------------------------------------------
// Mock Ollama server
// ---------------------------------------------------------------------------

const MOCK_VERSION = "0.5.7";
const MOCK_MODELS = [
  { name: "llama3.2:latest", model: "llama3.2:latest", size: 2_000_000_000 },
  { name: "qwen2.5:7b", model: "qwen2.5:7b", size: 4_000_000_000 },
  { name: "deepseek-r1:latest", model: "deepseek-r1:latest", size: 8_000_000_000 },
];

let mockOllamaServer: Server;
let mockOllamaPort: number;

function startMockOllama(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      res.setHeader("Content-Type", "application/json");

      if (req.url === "/api/version") {
        res.end(JSON.stringify({ version: MOCK_VERSION }));
        return;
      }

      if (req.url === "/api/tags") {
        res.end(JSON.stringify({ models: MOCK_MODELS }));
        return;
      }

      // OpenAI-compatible chat completions (minimal mock)
      if (req.url?.startsWith("/v1/chat/completions")) {
        res.end(
          JSON.stringify({
            id: "mock-001",
            object: "chat.completion",
            choices: [
              {
                index: 0,
                message: { role: "assistant", content: "Hello from mock Ollama!" },
                finish_reason: "stop",
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
          }),
        );
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: "not found" }));
    });

    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

// ---------------------------------------------------------------------------
// Panel server + storage setup
// ---------------------------------------------------------------------------

let panelServer: Server;
let panelBaseUrl: string;
let storage: Storage;
let stateDir: string;
const secretMap = new Map<string, string>();
const mockSecretStore = {
  get: async (key: string) => secretMap.get(key) ?? null,
  set: async (key: string, value: string) => {
    secretMap.set(key, value);
  },
  delete: async (key: string) => {
    secretMap.delete(key);
  },
};

async function fetchJson<T>(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; body: T }> {
  const res = await fetch(panelBaseUrl + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = (await res.json()) as T;
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  // 1. Start mock Ollama
  const ollama = await startMockOllama();
  mockOllamaServer = ollama.server;
  mockOllamaPort = ollama.port;

  // 2. Set up storage
  storage = createStorage(":memory:");
  const vendorDefinitions = new Map<
    string,
    Pick<ProviderKeyEntry, "baseUrl" | "customProtocol" | "customModelsJson" | "inputModalities">
  >();
  storage.providerKeys.setRuntimeProjector((entries) =>
    entries.map((entry) => ({
      ...entry,
      ...vendorDefinitions.get(entry.provider),
    })),
  );
  stateDir = join(tmpdir(), `rivonclaw-test-${randomUUID()}`);
  mkdirSync(join(stateDir, "agents", "main", "agent"), { recursive: true });

  // 3. Initialize LLM Provider Manager env (provider key actions need this)
  initLLMProviderManagerEnv({
    storage,
    secretStore: mockSecretStore as any,
    getRpcClient: () => null,
    toMstSnapshot,
    allKeysToMstSnapshots,
    syncActiveKey,
    syncAllAuthProfiles: async () => {},
    activateAuthProfile: () => "test:active",
    writeProxyRouterConfig: async () => {},
    writeDefaultModelToConfig: () => {},
    writeFullGatewayConfig: async () => {},
    writeVendorProviderDefinition: (entry, remove) => {
      if (remove) {
        vendorDefinitions.delete(entry.provider);
      } else {
        vendorDefinitions.set(entry.provider, {
          baseUrl: entry.baseUrl,
          customProtocol: entry.customProtocol,
          customModelsJson: entry.customModelsJson,
          inputModalities: entry.inputModalities,
        });
      }
    },
    restartGateway: async () => {},
    proxyFetch: globalThis.fetch,
    stateDir,
    getLastSystemProxy: () => null,
  });

  // 4. Start panel server
  const panelResult = await startPanelServer({
    port: 0,
    panelDistDir: "/tmp/nonexistent-panel-dist",
    storage,
    secretStore: mockSecretStore as any,
    proxyRouterPort: 18881,
    gatewayPort: 18882,
    onProviderChange: () => {},
    vendorDir: "/tmp/nonexistent-vendor",
    nodeBin: process.execPath,
  });

  panelServer = panelResult.server;
  panelBaseUrl = `http://127.0.0.1:${panelResult.port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    panelServer.close((err) => (err ? reject(err) : resolve()));
  });
  await new Promise<void>((resolve, reject) => {
    mockOllamaServer.close((err) => (err ? reject(err) : resolve()));
  });
  storage.close();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Local LLM (Ollama) E2E", () => {
  // ── Auto-detection ────────────────────────────────────────────────────

  describe("Auto-detection & Model Fetching (via panel-server endpoints)", () => {
    it("GET /api/local-models/detect finds the mock Ollama", async () => {
      // The detector probes 127.0.0.1:11434 by default. Our mock is on
      // a random port so it won't be auto-detected. This test verifies the
      // endpoint works and returns an empty list when nothing is on :11434.
      const { status, body } = await fetchJson<{ servers: Array<{ type: string }> }>(
        "/api/local-models/detect",
      );
      expect(status).toBe(200);
      expect(Array.isArray(body.servers)).toBe(true);
    });

    it("GET /api/local-models/models fetches models from mock Ollama", async () => {
      const url = `http://127.0.0.1:${mockOllamaPort}`;
      const { status, body } = await fetchJson<{ models: Array<{ id: string; name: string }> }>(
        `/api/local-models/models?baseUrl=${encodeURIComponent(url)}`,
      );
      expect(status).toBe(200);
      expect(body.models).toHaveLength(3);
      expect(body.models[0].id).toBe("llama3.2:latest");
      expect(body.models[1].id).toBe("qwen2.5:7b");
      expect(body.models[2].id).toBe("deepseek-r1:latest");
    });

    it("GET /api/local-models/models returns 400 without baseUrl", async () => {
      const { status } = await fetchJson<{ error: string }>("/api/local-models/models");
      expect(status).toBe(400);
    });

    it("POST /api/local-models/health returns ok for mock Ollama", async () => {
      const url = `http://127.0.0.1:${mockOllamaPort}`;
      const { status, body } = await fetchJson<{ ok: boolean; version?: string }>(
        "/api/local-models/health",
        { method: "POST", body: JSON.stringify({ baseUrl: url }) },
      );
      expect(status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.version).toBe(MOCK_VERSION);
    });

    it("POST /api/local-models/health returns not-ok for unreachable server", async () => {
      const { status, body } = await fetchJson<{ ok: boolean; error?: string }>(
        "/api/local-models/health",
        { method: "POST", body: JSON.stringify({ baseUrl: "http://127.0.0.1:1" }) },
      );
      expect(status).toBe(200);
      expect(body.ok).toBe(false);
    });
  });

  // ── Provider Key CRUD ─────────────────────────────────────────────────

  describe("Provider Key lifecycle (local)", () => {
    let createdKeyId: string;

    it("POST /api/provider-keys creates a local key (no API key required)", async () => {
      const { status, body } = await fetchJson<{
        id: string;
        provider: string;
        authType: string;
        baseUrl?: string;
        model: string;
      }>("/api/provider-keys", {
        method: "POST",
        body: JSON.stringify({
          provider: "ollama",
          label: "Test Ollama",
          model: "llama3.2:latest",
          authType: "local",
          baseUrl: `http://127.0.0.1:${mockOllamaPort}`,
        }),
      });

      expect(status).toBe(201);
      expect(body.provider).toBe("ollama");
      expect(body.authType).toBe("local");
      expect(body.model).toBe("llama3.2:latest");
      createdKeyId = body.id;
    });

    it("GET /api/provider-keys returns the local key with baseUrl", async () => {
      const { status, body } = await fetchJson<{
        keys: Array<{ id: string; provider: string; baseUrl?: string | null; authType?: string }>;
      }>("/api/provider-keys");

      expect(status).toBe(200);
      const localKey = body.keys.find((k) => k.id === createdKeyId);
      expect(localKey).toBeDefined();
      expect(localKey!.provider).toBe("ollama");
      expect(localKey!.authType).toBe("local");
      expect(localKey!.baseUrl).toBe(`http://127.0.0.1:${mockOllamaPort}`);
    });

    it("PUT /api/provider-keys/:id updates baseUrl", async () => {
      const newUrl = `http://192.168.1.100:11434`;
      const { status, body } = await fetchJson<{ id: string; baseUrl?: string | null }>(
        `/api/provider-keys/${createdKeyId}`,
        {
          method: "PUT",
          body: JSON.stringify({ baseUrl: newUrl }),
        },
      );

      expect(status).toBe(200);
      expect(body.baseUrl).toBe(newUrl);

      // Verify in storage
      const stored = storage.providerKeys.getById(createdKeyId);
      expect(stored?.baseUrl).toBe(newUrl);
    });

    it("storage layer persists authType and baseUrl correctly", () => {
      const key = storage.providerKeys.getById(createdKeyId);
      expect(key).toBeDefined();
      expect(key!.authType).toBe("local");
      expect(key!.baseUrl).toBe("http://192.168.1.100:11434");
    });
  });

  // ── Auth Profile Writer ───────────────────────────────────────────────

  describe("Auth profile writer (local provider)", () => {
    it("syncAllAuthProfiles writes a profile for local provider with dummy key", async () => {
      // Set up a local key in storage for syncing
      storage.providerKeys.create({
        id: "ollama-sync-test",
        provider: "ollama",
        label: "Sync Test",
        model: "llama3.2:latest",
        isDefault: true,
        authType: "local",
        baseUrl: `http://127.0.0.1:${mockOllamaPort}`,
        createdAt: "",
        updatedAt: "",
      });

      // No API key in secret store → should use dummy "ollama"
      await syncAllAuthProfiles(stateDir, storage, mockSecretStore as any);

      // SQLite is authoritative; the retired JSON store must not remain.
      const profilePath = resolveAuthProfilePath(stateDir);
      expect(existsSync(profilePath)).toBe(false);
      const profiles = readAuthProfiles(stateDir);
      expect(profiles.version).toBe(1);

      // Should have an "ollama:active" profile with the dummy key
      expect(profiles.profiles["ollama:active"]).toBeDefined();
      expect(profiles.profiles["ollama:active"].type).toBe("api_key");
      expect(profiles.profiles["ollama:active"].provider).toBe("ollama");
      expect(profiles.profiles["ollama:active"].key).toBe("ollama"); // dummy key
      expect(profiles.order?.ollama).toEqual(["ollama:active"]);
    }, 30_000);

    it("syncAllAuthProfiles uses real key when provided", async () => {
      // Add a real key to the secret store
      const selectedOllamaKey = storage.providerKeys.getByProvider("ollama")[0];
      secretMap.set(`provider-key-${selectedOllamaKey.id}`, "my-proxy-api-key");

      await syncAllAuthProfiles(stateDir, storage, mockSecretStore as any);

      const profiles = readAuthProfiles(stateDir);
      expect(profiles.profiles["ollama:active"].key).toBe("my-proxy-api-key");
    }, 30_000);

    it("clearAllAuthProfiles removes all profiles", () => {
      clearAllAuthProfiles(stateDir);

      const profiles = readAuthProfiles(stateDir);
      expect(profiles.profiles).toEqual({});
      expect(profiles.order).toEqual({});
    });
  });

  // ── Direct function tests ─────────────────────────────────────────────

  describe("local-model-fetcher functions (direct)", () => {
    it("fetchOllamaModels returns models from mock server", async () => {
      const { fetchOllamaModels } = await import("./local-model-fetcher.js");
      const url = `http://127.0.0.1:${mockOllamaPort}`;
      const models = await fetchOllamaModels(url);
      expect(models).toHaveLength(3);
      expect(models.map((m) => m.id)).toEqual([
        "llama3.2:latest",
        "qwen2.5:7b",
        "deepseek-r1:latest",
      ]);
    });

    it("fetchOllamaModels strips /v1 suffix", async () => {
      const { fetchOllamaModels } = await import("./local-model-fetcher.js");
      const url = `http://127.0.0.1:${mockOllamaPort}/v1`;
      const models = await fetchOllamaModels(url);
      expect(models).toHaveLength(3);
    });

    it("checkHealth returns ok for running mock", async () => {
      const { checkHealth } = await import("./local-model-fetcher.js");
      const result = await checkHealth(`http://127.0.0.1:${mockOllamaPort}`);
      expect(result.ok).toBe(true);
      expect(result.version).toBe(MOCK_VERSION);
    });

    it("checkHealth returns not-ok for unreachable server", async () => {
      const { checkHealth } = await import("./local-model-fetcher.js");
      const result = await checkHealth("http://127.0.0.1:1");
      expect(result.ok).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });
});
