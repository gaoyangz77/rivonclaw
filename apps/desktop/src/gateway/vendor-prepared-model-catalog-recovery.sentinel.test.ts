import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const VENDOR_ROOT = resolve(__dirname, "../../../../vendor/openclaw");

describe("OpenClaw v2026.8.1: prepared model catalog metadata generation", () => {
  const worker = readFileSync(
    resolve(VENDOR_ROOT, "src/agents/prepared-model-catalog.worker.ts"),
    "utf8",
  );
  const regression = readFileSync(
    resolve(VENDOR_ROOT, "src/agents/prepared-model-catalog-worker.integration.test.ts"),
    "utf8",
  );

  it("restores the exact Gateway plugin metadata snapshot in the worker", () => {
    expect(worker).toContain(
      "restorePluginMetadataSnapshot(value.pluginMetadataSnapshot)",
    );
    expect(worker).toContain("const prepared = await prepareWorkspaceBuildGroup(");
    expect(worker).toContain("metadata,");
  });

  it("guards every metadata scope with both catalog-first orderings", () => {
    expect(regression).toContain('"keeps %s metadata discovery scope with %s first"');
    expect(regression).toContain('["gateway", "auth-refresh"]');
    expect(regression).toContain('["none", "auth-refresh"]');
    expect(regression).toContain('["activation", "auth-refresh"]');
    expect(regression).toContain('if (first === "auth-refresh")');
  });
});
