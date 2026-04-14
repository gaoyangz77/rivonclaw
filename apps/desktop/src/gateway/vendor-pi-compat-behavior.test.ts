import { describe, it, expect, afterEach, vi } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

/**
 * Behavioral regression tests for vendor patch 0008: Pi SDK compatibility shim.
 *
 * Unlike the sentinel test (vendor-pi-compat-validation.sentinel.test.ts) which
 * only verifies source code patterns, these tests exercise the actual
 * monkey-patched Pi ModelRegistry at runtime. They prove that custom models
 * survive Pi SDK's validateConfig when auth-mode providers (token/oauth/aws-sdk)
 * are present in models.json.
 *
 * The vendor module is dynamically imported. Its transitive dependencies
 * (plugin hooks, auth profiles, etc.) are mocked since only the
 * validateConfig prototype patch and ModelRegistry creation are under test.
 */

const VENDOR_FILE = resolve(
  import.meta.dirname!,
  "../../../../vendor/openclaw/src/agents/pi-model-discovery.ts",
);

/** Guard: skip the entire suite when the vendor source is absent. */
function isVendorAvailable(): boolean {
  return existsSync(VENDOR_FILE);
}

// ── Stub out transitive vendor dependencies ──────────────────────────
// Only the Pi SDK interaction matters; plugin hooks, auth profile stores,
// and env-key resolvers are not relevant to validateConfig behavior.
vi.mock("../../../../vendor/openclaw/src/plugins/provider-model-compat.js", () => ({
  normalizeModelCompat: (model: unknown) => model,
}));
vi.mock("../../../../vendor/openclaw/src/plugins/provider-runtime.js", () => ({
  applyProviderResolvedModelCompatWithPlugins: () => undefined,
  applyProviderResolvedTransportWithPlugin: () => undefined,
  normalizeProviderResolvedModelWithPlugin: () => undefined,
  resolveProviderSyntheticAuthWithPlugin: () => undefined,
}));
vi.mock("../../../../vendor/openclaw/src/plugins/synthetic-auth.runtime.js", () => ({
  resolveRuntimeSyntheticAuthProviderRefs: () => [],
}));
vi.mock("../../../../vendor/openclaw/src/agents/auth-profiles/store.js", () => ({
  ensureAuthProfileStore: () => ({}),
}));
vi.mock("../../../../vendor/openclaw/src/agents/model-auth-env-vars.js", () => ({
  resolveProviderEnvApiKeyCandidates: () => ({}),
}));
vi.mock("../../../../vendor/openclaw/src/agents/model-auth-env.js", () => ({
  resolveEnvApiKey: () => undefined,
}));
vi.mock("../../../../vendor/openclaw/src/agents/pi-auth-credentials.js", () => ({
  resolvePiCredentialMapFromStore: () => ({}),
}));

const runOrSkip = isVendorAvailable() ? describe : describe.skip;

// Minimal model entry shape returned by Pi SDK ModelRegistry.getAll()
interface PiModelEntry {
  id: string;
  name: string;
  provider: string;
  api: string;
  input?: string[];
}

runOrSkip(
  "vendor patch 0008 behavioral: Pi SDK validateConfig compatibility shim",
  () => {
    let tmpDir: string | undefined;

    afterEach(() => {
      if (tmpDir) {
        rmSync(tmpDir, { recursive: true, force: true });
        tmpDir = undefined;
      }
    });

    /**
     * Scenario A: auth: "token" provider + normal custom provider
     *
     * Without the patch, the codex provider (auth: "token", no apiKey) causes
     * Pi SDK's validateConfig to reject the entire providers config, dropping
     * ALL custom models — including the unrelated test-custom provider that
     * has a valid apiKey.
     */
    it('auth: "token" provider does not prevent custom models from loading', async () => {
      const piDiscovery = await import(VENDOR_FILE);

      tmpDir = mkdtempSync(join(tmpdir(), "pi-compat-token-"));
      const modelsJson = {
        providers: {
          codex: {
            baseUrl: "https://chatgpt.com/backend-api",
            auth: "token",
            api: "openai-codex-responses",
            models: [
              { id: "gpt-5.4", name: "gpt-5.4", input: ["text", "image"] },
            ],
          },
          "test-custom": {
            baseUrl: "https://api.example.com/v1",
            api: "openai-completions",
            apiKey: "test-key-123",
            models: [
              { id: "gpt-5.4", name: "gpt-5.4", input: ["text", "image"] },
              {
                id: "gpt-5.4-mini",
                name: "gpt-5.4-mini",
                input: ["text", "image"],
              },
            ],
          },
        },
      };
      writeFileSync(
        join(tmpDir, "models.json"),
        JSON.stringify(modelsJson, null, 2),
      );

      // Create an in-memory auth storage (no disk auth needed for this test)
      const authStorage = (piDiscovery.AuthStorage as { inMemory: (data: object) => unknown }).inMemory({});
      const registry = piDiscovery.discoverModels(authStorage as never, tmpDir);
      const all = registry.getAll() as PiModelEntry[];

      // test-custom models must be present
      const testCustomModels = all.filter(
        (m) => m.provider === "test-custom",
      );
      expect(testCustomModels.length).toBeGreaterThanOrEqual(2);

      const gpt54 = testCustomModels.find((m) => m.id === "gpt-5.4");
      expect(gpt54).toBeDefined();
      expect(gpt54!.input).toContain("image");

      const gpt54Mini = testCustomModels.find(
        (m) => m.id === "gpt-5.4-mini",
      );
      expect(gpt54Mini).toBeDefined();

      // codex provider models must also be present (the shim injects a
      // synthetic apiKey during validation, not a permanent one — but the
      // models should still load into the registry)
      const codexModels = all.filter((m) => m.provider === "codex");
      expect(codexModels.length).toBeGreaterThanOrEqual(1);
    });

    /**
     * Scenario B: auth: "oauth" provider does not break custom models
     *
     * Same principle as Scenario A but with auth: "oauth" instead of "token".
     */
    it('auth: "oauth" provider does not prevent custom models from loading', async () => {
      const piDiscovery = await import(VENDOR_FILE);

      tmpDir = mkdtempSync(join(tmpdir(), "pi-compat-oauth-"));
      const modelsJson = {
        providers: {
          "oauth-provider": {
            baseUrl: "https://oauth.example.com/v1",
            auth: "oauth",
            api: "openai-completions",
            models: [
              { id: "oauth-model-1", name: "OAuth Model", input: ["text"] },
            ],
          },
          "test-custom-2": {
            baseUrl: "https://api.example.com/v1",
            api: "openai-completions",
            apiKey: "test-key-456",
            models: [
              {
                id: "test-vision",
                name: "Test Vision",
                input: ["text", "image"],
              },
            ],
          },
        },
      };
      writeFileSync(
        join(tmpDir, "models.json"),
        JSON.stringify(modelsJson, null, 2),
      );

      const authStorage = (piDiscovery.AuthStorage as { inMemory: (data: object) => unknown }).inMemory({});
      const registry = piDiscovery.discoverModels(authStorage as never, tmpDir);
      const all = registry.getAll() as PiModelEntry[];

      // test-custom-2 models must be present
      const testCustomModels = all.filter(
        (m) => m.provider === "test-custom-2",
      );
      expect(testCustomModels.length).toBeGreaterThanOrEqual(1);

      const testVision = testCustomModels.find(
        (m) => m.id === "test-vision",
      );
      expect(testVision).toBeDefined();
      expect(testVision!.input).toContain("image");

      // oauth-provider models should also be in the registry
      const oauthModels = all.filter(
        (m) => m.provider === "oauth-provider",
      );
      expect(oauthModels.length).toBeGreaterThanOrEqual(1);
    });
  },
);
