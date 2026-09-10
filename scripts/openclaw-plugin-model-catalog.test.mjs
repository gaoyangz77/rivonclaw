import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { readPluginModelCatalog } from "./openclaw-plugin-model-catalog.mjs";

function fixture(t, manifests) {
  const root = mkdtempSync(join(tmpdir(), "plugin-catalog-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const manifest of manifests) {
    const dir = join(root, manifest.id);
    mkdirSync(dir);
    writeFileSync(join(dir, "openclaw.plugin.json"), JSON.stringify(manifest));
  }
  return root;
}

test("merges every manifest and preserves native ownership without static rows", (t) => {
  const dir = fixture(t, [
    { id: "z", providers: ["dynamic"], modelCatalog: { discovery: { dynamic: "runtime" } } },
    {
      id: "a",
      providers: ["api"],
      modelCatalog: {
        providers: {
          api: { models: [{ id: "m", name: "Model", contextWindow: 100, contextTokens: 50 }] },
          "catalog-only": { models: [] },
        },
      },
    },
  ]);
  const result = readPluginModelCatalog(dir);
  assert.deepEqual(result.providerIds, ["api", "catalog-only", "dynamic"]);
  assert.deepEqual(result.catalog, {
    api: [{ id: "m", name: "Model", contextWindow: 100, contextTokens: 50 }],
  });
});

test("retains computed Google catalogs, deduplicates, and prefers manifest metadata", (t) => {
  const dir = fixture(t, [
    {
      id: "google",
      providers: ["google"],
      modelCatalog: {
        providers: { google: { models: [{ id: "same", name: "Manifest", contextTokens: 50 }] } },
      },
    },
  ]);
  const result = readPluginModelCatalog(dir, {
    google: [{ id: "same", name: "Computed", contextWindow: 100 }, { id: "new" }],
    "google-vertex": [{ id: "vertex" }],
  });
  assert.deepEqual(result.catalog.google, [
    { id: "same", name: "Manifest", contextWindow: 100, contextTokens: 50 },
    { id: "new", name: "new" },
  ]);
  assert.deepEqual(result.catalog["google-vertex"], [{ id: "vertex", name: "vertex" }]);
  assert.deepEqual(result.providerIds, ["google", "google-vertex"]);
});

test("does not publish disabled rows but retains provider ownership", (t) => {
  const dir = fixture(t, [
    {
      id: "disabled",
      modelCatalog: { providers: { disabled: { models: [{ id: "hidden", status: "disabled" }] } } },
    },
  ]);
  assert.deepEqual(readPluginModelCatalog(dir), { providerIds: ["disabled"], catalog: {} });
});

test("emits no guessed models and no auth, endpoint, or pricing data", (t) => {
  const dir = fixture(t, [
    {
      id: "provider",
      providers: ["no-models"],
      modelCatalog: {
        providers: {
          api: {
            models: [
              {
                id: "m",
                apiKey: "TEST_ONLY",
                baseUrl: "https://example.invalid",
                cost: { input: 5 },
              },
            ],
          },
        },
      },
    },
  ]);
  assert.deepEqual(readPluginModelCatalog(dir).catalog, { api: [{ id: "m", name: "m" }] });
});

test("fails on missing or empty built sources", (t) => {
  const dir = fixture(t, []);
  assert.throws(() => readPluginModelCatalog(join(dir, "missing")), /ENOENT/);
  assert.throws(() => readPluginModelCatalog(dir), /No built plugin manifests/);
});

test("fails rather than silently skipping malformed model metadata", (t) => {
  for (const models of [
    null,
    [{ name: "no id" }],
    [{ id: "m", contextWindow: -1 }],
    [{ id: "m", contextTokens: 1.5 }],
  ]) {
    const dir = fixture(t, [{ id: "bad", modelCatalog: { providers: { bad: { models } } } }]);
    assert.throws(
      () => readPluginModelCatalog(dir),
      /Missing model array|Invalid model ID|Invalid context/,
    );
  }
});
