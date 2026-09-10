import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { resolveElectronPath } = require("../../../scripts/electron-runtime.cjs");
const { run } = require("../../../scripts/rebuild-native.cjs");
const { findWorkspaceBundles, isolatedEnvironment, assertNoLifecycleMarkers } = require("../scripts/verify-vendor-runtime-contract.cjs");

describe("Electron runtime packaging guards", () => {
  let root: string;
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "electron-runtime-")); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it("fails without provisioning and never invokes Electron's downloading main export", () => {
    fs.writeFileSync(path.join(root, "index.js"), "throw Error('must not run')");
    expect(() => resolveElectronPath(root)).toThrow("not provisioned");
    fs.writeFileSync(path.join(root, "path.txt"), "../../outside");
    expect(() => resolveElectronPath(root)).toThrow("Invalid or missing");
    fs.mkdirSync(path.join(root, "dist"));
    fs.writeFileSync(path.join(root, "dist/electron"), "binary");
    fs.writeFileSync(path.join(root, "path.txt"), "electron\n");
    expect(resolveElectronPath(root)).toBe(path.join(root, "dist/electron"));
  });

  it("does not swallow a failed native build exit code", () => {
    expect(() => run(process.execPath, ["-e", "process.exit(7)"], root)).toThrow("exit 7");
  });

  it("discovers both legacy js and new mjs workspace chunks, not declarations", () => {
    fs.mkdirSync(path.join(root, "dist"));
    for (const name of ["workspace-old.js", "workspace-new.mjs", "workspace-new.d.mts", "other.mjs"])
      fs.writeFileSync(path.join(root, "dist", name), "");
    expect(findWorkspaceBundles(root).map((file: string) => path.basename(file))).toEqual(["workspace-new.mjs", "workspace-old.js"]);
  });

  it("removes inherited host runtime and OpenClaw state overrides", () => {
    expect(isolatedEnvironment({ PATH: "path", Path: "windows-host", path: "lower-case-host", NODE_PATH: "host", NODE_OPTIONS: "--require host", OPENCLAW_CONFIG_PATH: "real-user", FS_SAFE_NATIVE_MODE: "required", HOME: "real-home" })).toEqual({});
  });

  it.each([".openclaw-lifecycle-pending", "dist/openclaw-install-guard"])("rejects unfinished package marker %s", (marker) => {
    fs.mkdirSync(path.dirname(path.join(root, marker)), { recursive: true });
    fs.writeFileSync(path.join(root, marker), "pending");
    expect(() => assertNoLifecycleMarkers(root)).toThrow("forbidden pruned path");
    expect(fs.existsSync(path.join(root, marker))).toBe(true);
  });
});
