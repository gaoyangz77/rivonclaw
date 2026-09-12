import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

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

  it.each(["checkout", "checkout with spaces #100%"])("loads the native build's ESM dependency from %s", (name) => {
    const checkout = path.join(root, name);
    const write = (file: string, content: string) => {
      const target = path.join(checkout, file);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content);
    };
    write("scripts/rebuild-native.cjs", fs.readFileSync(new URL("../../../scripts/rebuild-native.cjs", import.meta.url), "utf8"));
    for (const dir of ["apps/desktop", "packages/storage"]) {
      write(`${dir}/package.json`, "{}");
    }
    write("node_modules/better-sqlite3/package.json", JSON.stringify({ name: "better-sqlite3", version: "13.0.3" }));
    write("node_modules/electron/package.json", JSON.stringify({ name: "electron", version: "42.11.3" }));
    write("node_modules/node-abi/package.json", JSON.stringify({ name: "node-abi", type: "module", exports: "./index.mjs" }));
    write("node_modules/node-abi/index.mjs", `
      export function getAbi(version, runtime) {
        if (version !== "42.11.3" || runtime !== "electron") throw new Error("unexpected ABI lookup");
        return "146";
      }
    `);
    // Stop after the real script imports and calls getAbi, before any native
    // rebuild or Electron download. Fixtures stay inside this test's checkout.
    write("scripts/electron-runtime.cjs", `
      const path = require("node:path");
      module.exports = {
        desktopDir: path.resolve(__dirname, "../apps/desktop"),
        resolveElectronPath: () => "unused-test-runtime",
        readElectronVersions: () => { throw new Error("TEST_ABI_IMPORT_SUCCEEDED"); },
      };
    `);
    const result = spawnSync(process.execPath, [path.join(checkout, "scripts/rebuild-native.cjs")], {
      cwd: checkout,
      encoding: "utf8",
      timeout: 10_000,
      env: { ...process.env, NODE_OPTIONS: "", NODE_PATH: "" },
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("TEST_ABI_IMPORT_SUCCEEDED");
    expect(result.stderr).not.toContain("ERR_UNSUPPORTED_ESM_URL_SCHEME");
    expect(result.stderr).not.toContain("ERR_MODULE_NOT_FOUND");
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
