import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { auditCoverage, compareInventories, readVendorInventory } from "./audit-provider-sync.mjs";

function fixture(t, manifest) {
  const root = mkdtempSync(join(tmpdir(), "provider-audit-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  if (manifest !== undefined) {
    const dir = join(root, "dist/extensions/fixture");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "openclaw.plugin.json"), JSON.stringify(manifest));
  }
  return root;
}

test("fails fast on missing built catalog instead of returning an empty set", (t) => {
  assert.throws(() => readVendorInventory(fixture(t)), /Required built catalog source is missing/);
});

test("fails fast when manifests contain no usable model catalog", (t) => {
  assert.throws(
    () => readVendorInventory(fixture(t, { id: "fixture", providers: ["demo"] })),
    /No usable built manifest model catalog/,
  );
});

test("fails fast on malformed provider models and model IDs", (t) => {
  for (const models of [null, {}, [{ name: "Missing ID" }]]) {
    assert.throws(
      () =>
        readVendorInventory(
          fixture(t, { id: "fixture", modelCatalog: { providers: { demo: { models } } } }),
        ),
      /Invalid model/,
    );
  }
});

test("reads provider-owned models with context and discovery metadata", (t) => {
  const inventory = readVendorInventory(
    fixture(t, {
      id: "fixture",
      providers: ["demo", "live"],
      modelCatalog: {
        discovery: { demo: "refreshable" },
        providers: {
          demo: { models: [{ id: "model", contextWindow: 32000, contextTokens: 8000 }] },
        },
      },
    }),
  );
  assert.equal(inventory.manifestCount, 1);
  assert.deepEqual(inventory.providers, ["demo", "live"]);
  assert.deepEqual(inventory.models, [
    {
      provider: "demo",
      id: "model",
      name: "model",
      contextWindow: 32000,
      contextTokens: 8000,
      status: "available",
      discovery: "refreshable",
      pluginId: "fixture",
    },
  ]);
});

test("audits actual app coverage including fallbacks and subscriptions, not just extraModels", () => {
  const core = {
    ALL_PROVIDERS: ["fallback", "subscription", "missing", "local"],
    LOCAL_PROVIDER_IDS: ["local"],
    getProviderMeta: () => ({}),
  };
  const result = auditCoverage(
    core,
    { fallback: [{ id: "f" }], subscription: [{ id: "s" }] },
    { providers: [], models: [] },
    (x) => x,
  );
  assert.deepEqual(result.emptyProviders, ["missing"]);
  assert.equal(result.providers.find((p) => p.provider === "local").runtimeDiscovery, true);
});

test("does not exempt an empty subscription or count disabled/runtime declarations as static gaps", () => {
  const core = {
    ALL_PROVIDERS: ["subscription"],
    LOCAL_PROVIDER_IDS: [],
    getProviderMeta: () => ({}),
  };
  const models = [
    { provider: "subscription", id: "live", discovery: "runtime" },
    { provider: "subscription", id: "disabled", status: "disabled" },
    { provider: "alias", id: "static" },
  ];
  const result = auditCoverage(core, {}, { providers: ["alias"], models }, (catalog) => ({
    subscription: catalog.alias,
  }));
  assert.deepEqual(result.emptyProviders, ["subscription"]);
  assert.deepEqual(result.missingDeclaredModels, [
    { provider: "subscription", models: ["static"] },
  ]);
});

test("compares exact provider/model identities and context changes", () => {
  const result = compareInventories(
    {
      vendorDir: "old",
      models: [
        { provider: "p", id: "same", contextWindow: 100 },
        { provider: "p", id: "gone" },
      ],
    },
    {
      models: [
        { provider: "p", id: "same", contextWindow: 200 },
        { provider: "q", id: "same" },
      ],
    },
  );
  assert.deepEqual(result.added, ["q/same"]);
  assert.deepEqual(result.removed, ["p/gone"]);
  assert.deepEqual(result.contextChanged, [
    {
      model: "p/same",
      before: { contextWindow: 100, contextTokens: undefined },
      after: { contextWindow: 200, contextTokens: undefined },
    },
  ]);
});
