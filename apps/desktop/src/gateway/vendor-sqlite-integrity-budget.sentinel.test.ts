import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PATCH_FILE = resolve(
  __dirname,
  "../../../../vendor-patches/openclaw/0043-vendor-openclaw-scale-SQLite-integrity-budget-with-d.patch",
);
const PATCHED_VENDOR_ROOT = resolve(__dirname, "../../../../tmp/vendor-patched/openclaw");
const VENDOR_ROOT = existsSync(PATCHED_VENDOR_ROOT)
  ? PATCHED_VENDOR_ROOT
  : resolve(__dirname, "../../../../vendor/openclaw");

describe("vendor patch 0043: size-aware SQLite integrity budget", () => {
  const patch = readFileSync(PATCH_FILE, "utf8");
  const integrityWorker = readFileSync(
    resolve(VENDOR_ROOT, "src/infra/sqlite-integrity-worker.ts"),
    "utf8",
  );
  const readonlyWorker = readFileSync(
    resolve(VENDOR_ROOT, "src/infra/sqlite-readonly-worker.ts"),
    "utf8",
  );

  it("budgets the integrity child by database size instead of the fixed inspection limit", () => {
    expect(readonlyWorker).toContain("export function resolveSqliteIntegrityTimeoutMs(");
    expect(readonlyWorker).toContain("Math.ceil(Number(sizeBytes) / (32 * 1024 * 1024)) * 1000");
    expect(readonlyWorker).toContain("const SQLITE_INTEGRITY_TIMEOUT_MAX_MS = 30 * 60_000");
    expect(integrityWorker).toContain("timeout: timeoutMs,");
    expect(integrityWorker).not.toContain("timeout: SQLITE_INSPECTION_TIMEOUT_MS,");
  });

  it("keeps the observed phase in integrity timeout errors", () => {
    expect(integrityWorker).toContain("(budget for ${size})");
    expect(integrityWorker).toContain("lastObservedPhase=${lastObservedPhase}");
  });

  it("records both upstream commits and the removal condition", () => {
    expect(patch).toContain("a6a4e88da29863c8527bef2710f7090e3a0d95d8");
    expect(patch).toContain("31a823079ed837c43ac0cd85a0c46d9dcbc6750c");
    expect(patch).toContain("Removal:");
    expect(patch).toContain(
      "apps/desktop/src/gateway/vendor-sqlite-integrity-budget.sentinel.test.ts",
    );
  });
});
