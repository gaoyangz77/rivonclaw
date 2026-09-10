import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, cpSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { ensureVendorRuntime } from "./extractor.js";

const paths = vi.hoisted(() => ({ userData: "" }));
vi.mock("electron", () => ({ app: { getPath: () => paths.userData } }));
vi.mock("node:child_process", () => ({ execSync: vi.fn() }));

const require = createRequire(import.meta.url);
const { DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS, STAGED_VENDOR_SOURCE_PLUGINS } =
  require("../../scripts/vendor-runtime-plugin-inventory.cjs");
const runtimeFiles = [
  "openclaw.mjs", "package.json", "skills/SKILL.md",
  ...["AGENTS.md", "BOOTSTRAP.md", "SOUL.md", "TOOLS.md"].map((name) => `docs/reference/templates/${name}`),
  "dist/extensions/acpx/openclaw.plugin.json", "dist/extensions/memory-core/openclaw.plugin.json",
  ...DESKTOP_REQUIRED_BUNDLED_PLUGIN_IDS.map((id: string) => `dist-runtime/extensions/${id}/openclaw.plugin.json`),
  ...STAGED_VENDOR_SOURCE_PLUGINS.map(({ id }: { id: string }) => `dist-runtime/extensions/${id}/index.js`),
];
let root: string;
let archiveDir: string;
let target: string;
function seedRuntime(directory: string) {
  for (const name of runtimeFiles) {
    const file = join(directory, name);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, "fixture");
  }
}

beforeEach(() => {
  vi.resetAllMocks();
  root = mkdtempSync(join(tmpdir(), "vendor-extractor-"));
  paths.userData = join(root, "user data");
  archiveDir = join(root, "archive");
  target = join(paths.userData, "runtime", "test-v9", "openclaw");
  mkdirSync(archiveDir, { recursive: true });
  writeFileSync(join(archiveDir, "vendor-runtime-manifest.json"), JSON.stringify({
    version: "test-v9", archiveFile: "vendor-runtime.tar", openclawVersion: "test", archiveSizeBytes: 7,
  }));
  writeFileSync(join(archiveDir, "vendor-runtime.tar"), "fixture");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("packaged runtime compiled plugin entries", () => {
  it("accepts a complete JavaScript-only runtime without repeatedly extracting", async () => {
    seedRuntime(target);
    expect(await ensureVendorRuntime(archiveDir)).toBe(target);
    expect(await ensureVendorRuntime(archiveDir)).toBe(target);
    expect(execSync).not.toHaveBeenCalled();
    expect(existsSync(join(target, "dist-runtime/extensions/groq/index.ts"))).toBe(false);
  });

  it("extracts compiled plugin entries and reuses the resulting cache", async () => {
    const template = join(root, "template");
    seedRuntime(template);
    vi.mocked(execSync).mockImplementation((command) => {
      const destination = /-C "([^"]+)"/.exec(String(command))?.[1];
      expect(destination).toBeTruthy();
      cpSync(template, destination!, { recursive: true });
      return Buffer.alloc(0);
    });
    expect(await ensureVendorRuntime(archiveDir)).toBe(target);
    expect(await ensureVendorRuntime(archiveDir)).toBe(target);
    expect(execSync).toHaveBeenCalledTimes(1);
  });

  it("does not accept a missing built entry just because the old source entry exists", async () => {
    seedRuntime(target);
    rmSync(join(target, "dist-runtime/extensions/groq/index.js"));
    writeFileSync(join(target, "dist-runtime/extensions/groq/index.ts"), "old source");
    vi.mocked(execSync).mockImplementation(() => { throw new Error("fixture extraction failed"); });
    await expect(ensureVendorRuntime(archiveDir)).rejects.toThrow("fixture extraction failed");
    expect(execSync).toHaveBeenCalledTimes(1);
  });
});
