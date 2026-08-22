import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0038-vendor-openclaw-recover-invalid-prepared-model-catalog-generations.patch",
);
const PATCHED_VENDOR_ROOT = resolve(__dirname, "../../../../tmp/vendor-patched/openclaw");
const VENDOR_ROOT = existsSync(PATCHED_VENDOR_ROOT)
  ? PATCHED_VENDOR_ROOT
  : resolve(__dirname, "../../../../vendor/openclaw");

describe("vendor patch 0038: prepared model catalog generation recovery", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");
  const workerBoundary = readFileSync(
    resolve(VENDOR_ROOT, "src/agents/prepared-model-catalog-worker.ts"),
    "utf8",
  );
  const catalogBoundary = readFileSync(
    resolve(VENDOR_ROOT, "src/agents/prepared-model-catalog.ts"),
    "utf8",
  );
  const runtime = readFileSync(
    resolve(VENDOR_ROOT, "src/agents/prepared-model-runtime.ts"),
    "utf8",
  );
  const regression = readFileSync(
    resolve(VENDOR_ROOT, "src/agents/prepared-model-catalog-worker.integration.test.ts"),
    "utf8",
  );

  it("classifies only a reconstructed generation mismatch as recoverable", () => {
    expect(workerBoundary).toContain('message.status === "generation-invalid"');
    expect(workerBoundary).toContain("PreparedModelCatalogGenerationInvalidError");
    expect(catalogBoundary).toContain(
      "replacePreparedModelRuntimeSnapshotAfterCatalogGenerationMismatch(snapshot)",
    );
  });

  it("rebuilds the configured owner behind a shared recovery gate", () => {
    expect(runtime).toContain(
      "replacePreparedModelRuntimeSnapshotAfterCatalogGenerationMismatch",
    );
    expect(runtime).toContain("catalogGenerationRecoveries");
    expect(runtime).toContain("pendingModelRuntimeReplacement = replacement");
  });

  it("carries the failing-first models.list regression including a concurrent reader", () => {
    expect(regression).toContain(
      'it("rebuilds the published owner before models.list retries a generation mismatch"',
    );
    expect(regression).toContain("registerPreparedModelRuntimePublicationListener");
    expect(regression).toContain("concurrentRecovered?.entries");
  });

  it("records the exact upstream source and removal condition", () => {
    expect(patch).toContain("PR #126224");
    expect(patch).toContain("issue #126108");
    expect(patch).toContain("059bea02f804144e33e169f90267d365b4d6a490");
    expect(patch).toContain("Removal:");
    expect(patch).toContain(
      "apps/desktop/src/gateway/vendor-prepared-model-catalog-recovery.sentinel.test.ts",
    );
  });
});
