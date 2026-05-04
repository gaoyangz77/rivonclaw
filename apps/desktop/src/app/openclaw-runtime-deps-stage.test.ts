import { mkdtempSync, readlinkSync, rmSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  ensurePackagedOpenClawRuntimeDepsStage,
  __test,
} from "./openclaw-runtime-deps-stage.js";

const roots: string[] = [];

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "rivonclaw-runtime-deps-"));
  roots.push(root);
  return root;
}

function createPackagedVendor(root: string): string {
  const vendorDir = join(root, "resources", "vendor", "openclaw");
  mkdirSync(join(vendorDir, "node_modules", "grammy"), { recursive: true });
  writeFileSync(join(vendorDir, "package.json"), JSON.stringify({ version: "2026.4.27" }), "utf-8");
  writeFileSync(join(vendorDir, "node_modules", "grammy", "package.json"), "{}", "utf-8");
  return vendorDir;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("ensurePackagedOpenClawRuntimeDepsStage", () => {
  it("links the packaged vendor node_modules into OpenClaw's external stage root", () => {
    const root = tempRoot();
    const vendorDir = createPackagedVendor(root);
    const stateDir = join(root, "state");

    ensurePackagedOpenClawRuntimeDepsStage({ vendorDir, stateDir });

    const stageRoot = __test.bundledRuntimeDepsRoot(vendorDir, stateDir);
    const stageNodeModules = join(stageRoot, "node_modules");
    expect(existsSync(join(stageNodeModules, "grammy", "package.json"))).toBe(true);
    expect(readlinkSync(stageNodeModules)).toBe(join(vendorDir, "node_modules"));
  });

  it("does not create a stage for source checkouts", () => {
    const root = tempRoot();
    const vendorDir = createPackagedVendor(root);
    mkdirSync(join(vendorDir, ".git"), { recursive: true });
    const stateDir = join(root, "state");

    ensurePackagedOpenClawRuntimeDepsStage({ vendorDir, stateDir });

    expect(existsSync(__test.bundledRuntimeDepsRoot(vendorDir, stateDir))).toBe(false);
  });
});
