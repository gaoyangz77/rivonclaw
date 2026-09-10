import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const builderRequire = createRequire(require.resolve("electron-builder"));
const yamlEntry = createRequire(builderRequire.resolve("app-builder-lib")).resolve("yaml");
const {
  materializeSelectedPluginDependencies, assertSelectedPluginDependencies,
  materializeSelectedPluginAssets, resolvePackage, isSelectedPluginNodeModules,
  materializeRuntimeModuleLinks, assertBundledPluginEntries,
} = require("../scripts/vendor-plugin-dependencies.cjs");
const { copySelectedPluginDependencies, shouldCopyVendorNative } = require("../scripts/copy-vendor-deps.cjs");
const { stripPrivateSourceMaps } = require("../scripts/vendor-plugin-size.cjs");

describe("selected vendor plugin payload", () => {
  let root: string;
  const ids = ["feishu"];
  const write = (file: string, text: string) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
  };
  function pkg(dir: string, name: string, version: string, dependencies = {}, extra = {}) {
    write(path.join(dir, "package.json"), JSON.stringify({ name, version, dependencies, ...extra }));
    write(path.join(dir, "index.js"), "module.exports = 42;");
    return dir;
  }
  function link(from: string, name: string, target: string) {
    const dest = path.join(from, "node_modules", name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.symlinkSync(target, dest, process.platform === "win32" ? "junction" : "dir");
  }
  function lockText(text: string) {
    // Use the packaging toolchain's real YAML parser without depending on vendor.
    const yaml = pkg(path.join(root, "node_modules/yaml"), "yaml", "1.0.0");
    write(path.join(yaml, "index.js"), `module.exports = require(${JSON.stringify(yamlEntry)});`);
    write(path.join(root, "pnpm-lock.yaml"), text);
  }
  function lock(snapshots: Record<string, unknown>, overrides: Record<string, string> = {}) {
    lockText(JSON.stringify({ snapshots, overrides, importers: {} }));
  }
  beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "vendor-plugin-deps-")); });
  afterEach(() => { fs.rmSync(root, { recursive: true, force: true }); });

  it("preserves source-installed versions, transitive conflicts and cycles after source removal", () => {
    const plugin = pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { a: "1.0.0" });
    const source = pkg(path.join(root, "extensions/feishu"), "@openclaw/feishu", "2026.9.3");
    const a = pkg(path.join(root, "node_modules/.store/a"), "a", "1.0.0", { b: "1.0.0", shared: "^1.0.0" });
    const b = pkg(path.join(root, "node_modules/.store/b"), "b", "1.0.0", { a: "1.0.0", shared: "^2.0.0" });
    const one = pkg(path.join(root, "node_modules/.store/one"), "shared", "1.0.0");
    const two = pkg(path.join(root, "node_modules/.store/two"), "shared", "2.0.0");
    pkg(path.join(root, "node_modules/shared"), "shared", "3.0.0");
    link(source, "a", a); link(a, "b", b); link(b, "a", a);
    link(a, "shared", one); link(b, "shared", two);
    materializeSelectedPluginDependencies(root, ids);
    fs.rmSync(path.join(root, "extensions"), { recursive: true });
    fs.rmSync(path.join(root, "node_modules"), { recursive: true });
    expect(() => assertSelectedPluginDependencies(root, ids)).not.toThrow();
    const copiedB = resolvePackage("b", resolvePackage("a", plugin));
    expect(JSON.parse(fs.readFileSync(path.join(resolvePackage("shared", copiedB), "package.json"), "utf8")).version).toBe("2.0.0");
    expect(isSelectedPluginNodeModules(root, path.join(plugin, "node_modules"), ids)).toBe(true);
    expect(fs.lstatSync(resolvePackage("a", plugin)).isSymbolicLink()).toBe(false);
  });

  it("fails on a missing required dependency, but permits missing optional peers", () => {
    const plugin = pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", {}, {
      peerDependencies: { optional: "1.0.0" }, peerDependenciesMeta: { optional: { optional: true } },
    });
    expect(() => materializeSelectedPluginDependencies(root, ids)).not.toThrow();
    pkg(plugin, "@openclaw/feishu", "2026.9.3", { missing: "1.0.0" });
    expect(() => materializeSelectedPluginDependencies(root, ids)).toThrow("Missing runtime dependency");
  });

  it("rejects a wrong hoisted version rather than silently shipping it", () => {
    pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { dep: "1.0.0" });
    pkg(path.join(root, "node_modules/dep"), "dep", "2.0.0");
    expect(() => materializeSelectedPluginDependencies(root, ids)).toThrow("does not satisfy");
  });

  it("ignores optional peers found only in the surrounding build checkout", () => {
    const payload = path.join(root, "packed/vendor/openclaw");
    const plugin = pkg(path.join(payload, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", {}, {
      peerDependencies: { encoding: "^0.1.0" }, peerDependenciesMeta: { encoding: { optional: true } },
    });
    pkg(path.join(root, "node_modules/encoding"), "encoding", "0.1.13");
    expect(resolvePackage("encoding", plugin)).not.toBeNull();
    expect(() => materializeSelectedPluginDependencies(payload, ids)).not.toThrow();
    expect(fs.existsSync(path.join(plugin, "node_modules/encoding"))).toBe(false);
    expect(() => assertSelectedPluginDependencies(payload, ids)).not.toThrow();
  });

  it("does not satisfy required dependencies from the surrounding build checkout", () => {
    const payload = path.join(root, "packed/vendor/openclaw");
    pkg(path.join(payload, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { encoding: "^0.1.0" });
    pkg(path.join(root, "node_modules/encoding"), "encoding", "0.1.13");
    expect(() => materializeSelectedPluginDependencies(payload, ids)).toThrow("Missing runtime dependency");
    expect(() => assertSelectedPluginDependencies(payload, ids)).toThrow("Missing packaged runtime dependency");
  });

  it("still rejects optional dependencies linked outside the payload", () => {
    const payload = path.join(root, "packed/vendor/openclaw");
    const plugin = pkg(path.join(payload, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", {}, {
      optionalDependencies: { encoding: "^0.1.0" },
    });
    const outside = pkg(path.join(root, "node_modules/encoding"), "encoding", "0.1.13");
    link(plugin, "encoding", outside);
    expect(() => materializeSelectedPluginDependencies(payload, ids)).toThrow("escapes vendor payload");
    expect(() => assertSelectedPluginDependencies(payload, ids)).toThrow("escapes vendor payload");
  });

  it.each([false, true])("preserves direct/transitive version conflicts through the real prune walkers (direct first: %s)", (directFirst) => {
    const deps = directFirst ? { shared: "11.0.2", sdk: "1.0.0" } : { sdk: "1.0.0", shared: "11.0.2" };
    const plugin = pkg(path.join(root, "dist-runtime/extensions/feishu"), "@openclaw/feishu", "2026.9.3", deps);
    const source = pkg(path.join(root, "extensions/feishu"), "@openclaw/feishu", "2026.9.3");
    pkg(path.join(root, "node_modules/sdk"), "sdk", "1.0.0", { shared: "^10.3.0" });
    pkg(path.join(root, "node_modules/shared"), "shared", "10.9.1");
    const direct = pkg(path.join(root, "node_modules/.store/shared11"), "shared", "11.0.2");
    link(source, "shared", direct);
    materializeSelectedPluginDependencies(root, ids);
    expect(() => assertSelectedPluginDependencies(root, ids)).not.toThrow();

    const pruning = fs.readFileSync(new URL("../scripts/prune-vendor-deps.cjs", import.meta.url), "utf8");
    const functions = ["removeSymlinksAndNestedNodeModules", "stripNonRuntimeFiles"].map((name) => {
      const start = pruning.indexOf(`function ${name}(`);
      expect(start).toBeGreaterThan(0);
      return pruning.slice(start, pruning.indexOf("\nfunction ", start + 1));
    }).join("\n");
    const junk = pkg(path.join(root, "dist-runtime/extensions/unselected/node_modules/junk"), "junk", "1.0.0");
    runInNewContext(`${functions}\nremoveSymlinksAndNestedNodeModules(target); stripNonRuntimeFiles(target);`, {
      fs, path, vendorDir: root, target: path.join(root, "dist-runtime"), isSelectedPluginNodeModules,
      dirSize: () => 0, fileCount: () => 0, stripPrivateSourceMaps,
      STRIP_DIRS: new Set(), STRIP_FILES: new Set(), STRIP_DTS_RE: /\.d\.ts$/, STRIP_EXTS: [],
    });
    expect(fs.existsSync(junk)).toBe(false);
    fs.rmSync(path.join(root, "node_modules"), { recursive: true });
    fs.rmSync(path.join(root, "extensions"), { recursive: true });
    expect(() => assertSelectedPluginDependencies(root, ids)).not.toThrow();
    const sdk = resolvePackage("sdk", plugin);
    expect(JSON.parse(fs.readFileSync(path.join(resolvePackage("shared", sdk), "package.json"), "utf8")).version).toBe("10.9.1");
    expect(JSON.parse(fs.readFileSync(path.join(resolvePackage("shared", plugin), "package.json"), "utf8")).version).toBe("11.0.2");
  });

  it("copies required npm dependencies named after Node builtins", () => {
    const plugin = pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { buffer: "^6.0.3" });
    pkg(path.join(root, "node_modules/buffer"), "buffer", "6.0.3");
    materializeSelectedPluginDependencies(root, ids);
    fs.rmSync(path.join(root, "node_modules"), { recursive: true });
    expect(createRequire(path.join(plugin, "index.js"))("buffer/")).toBe(42);
    expect(() => assertSelectedPluginDependencies(root, ids)).not.toThrow();
    fs.rmSync(path.join(plugin, "node_modules/buffer"), { recursive: true });
    expect(() => assertSelectedPluginDependencies(root, ids)).toThrow(/Missing packaged runtime dependency buffer|Runtime dependency escapes vendor payload/);
  });

  it.each(["protobufjs", "@larksuiteoapi/node-sdk@1.73.0>protobufjs"])(
    "honors exact locked %s overrides and preserves them without the source lockfile",
    (selector) => {
      const plugin = pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { "@larksuiteoapi/node-sdk": "1.73.0" });
      const sdk = pkg(path.join(root, "node_modules/@larksuiteoapi/node-sdk"), "@larksuiteoapi/node-sdk", "1.73.0", { protobufjs: "^7.2.6" });
      pkg(path.join(root, "node_modules/protobufjs"), "protobufjs", "8.7.2");
      lock({ "@larksuiteoapi/node-sdk@1.73.0": { dependencies: { protobufjs: "8.7.2" } } }, { [selector]: "8.7.2" });
      materializeSelectedPluginDependencies(root, ids);
      expect(JSON.parse(fs.readFileSync(path.join(sdk, "package.json"), "utf8")).dependencies.protobufjs).toBe("^7.2.6");
      const copied = resolvePackage("@larksuiteoapi/node-sdk", plugin);
      expect(JSON.parse(fs.readFileSync(path.join(copied, "package.json"), "utf8")).dependencies.protobufjs).toBe("8.7.2");
      fs.rmSync(path.join(root, "pnpm-lock.yaml"));
      fs.rmSync(path.join(root, "node_modules"), { recursive: true });
      expect(() => assertSelectedPluginDependencies(root, ids)).not.toThrow();
    },
  );

  it("rejects a wrong installed version even when it satisfies the original range", () => {
    pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { sdk: "1.0.0" });
    pkg(path.join(root, "node_modules/sdk"), "sdk", "1.0.0", { dep: "^8.0.0" });
    pkg(path.join(root, "node_modules/dep"), "dep", "8.7.3");
    lock({ "sdk@1.0.0": { dependencies: { dep: "8.7.2" } } }, { dep: "8.7.2" });
    expect(() => materializeSelectedPluginDependencies(root, ids)).toThrow("Locked runtime dependency");
  });

  const bootstrapLock = `---
lockfileVersion: '9.0'
importers:
  .:
    configDependencies: {}
    packageManagerDependencies:
      pnpm: {specifier: 12.3.4, version: 12.3.4}
packages: {}
snapshots:
  sdk@1.0.0:
    dependencies: {dep: 99.0.0}
`;
  const projectLock = `---
lockfileVersion: '9.0'
overrides: {dep: 8.7.2}
importers:
  extensions/feishu:
    dependencies:
      sdk: {specifier: 1.0.0, version: 1.0.0}
packages: {}
snapshots:
  sdk@1.0.0:
    dependencies: {dep: 8.7.2}
`;

  it.each(["LF", "BOM + CRLF"])("reads pnpm 12's project document, not bootstrap resolutions (%s)", (format) => {
    const plugin = pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { sdk: "1.0.0" });
    pkg(path.join(root, "extensions/feishu"), "@openclaw/feishu", "2026.9.3");
    pkg(path.join(root, "node_modules/sdk"), "sdk", "1.0.0", { dep: "^7.0.0" });
    pkg(path.join(root, "node_modules/dep"), "dep", "8.7.2");
    const content = bootstrapLock + projectLock;
    lockText(format === "LF" ? content : `\uFEFF${content.replace(/\n/g, "\r\n")}`);
    materializeSelectedPluginDependencies(root, ids);
    expect(JSON.parse(fs.readFileSync(path.join(resolvePackage("sdk", plugin), "package.json"), "utf8")).dependencies.dep).toBe("8.7.2");
    fs.rmSync(path.join(root, "node_modules"), { recursive: true });
    fs.rmSync(path.join(root, "pnpm-lock.yaml"));
    expect(() => assertSelectedPluginDependencies(root, ids)).not.toThrow();
  });

  it.each([
    ["bootstrap only", bootstrapLock],
    ["missing project graph", bootstrapLock + "---\nlockfileVersion: '9.0'\n"],
    ["extra document", bootstrapLock + projectLock + projectLock],
    ["two project documents", projectLock + projectLock],
    ["malformed project", bootstrapLock + "---\nimporters: [\n"],
  ])("fails closed for a %s lockfile", (_label, content) => {
    lockText(content);
    expect(() => materializeSelectedPluginDependencies(root, ids)).toThrow();
  });

  it("does not apply another parent version's locked override", () => {
    pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { sdk: "2.0.0" });
    pkg(path.join(root, "node_modules/sdk"), "sdk", "2.0.0", { dep: "^7.0.0" });
    pkg(path.join(root, "node_modules/dep"), "dep", "8.7.2");
    lock({ "sdk@1.0.0": { dependencies: { dep: "8.7.2" } } }, { "sdk@1.0.0>dep": "8.7.2" });
    expect(() => materializeSelectedPluginDependencies(root, ids)).toThrow("does not satisfy");
  });

  it("handles locked alias replacements and peer-suffixed resolutions", () => {
    const plugin = pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { sdk: "1.0.0" });
    pkg(path.join(root, "node_modules/sdk"), "sdk", "1.0.0", { legacy: "^1.0.0" });
    pkg(path.join(root, "node_modules/legacy"), "replacement", "2.0.0");
    lock({ "sdk@1.0.0(peer@1.0.0)": { dependencies: { legacy: "replacement@2.0.0(peer@1.0.0)" } } }, { legacy: "npm:replacement@2.0.0" });
    materializeSelectedPluginDependencies(root, ids);
    expect(resolvePackage("legacy", resolvePackage("sdk", plugin))).not.toBeNull();
    expect(() => assertSelectedPluginDependencies(root, ids)).not.toThrow();
  });

  it.each(["3.25.76", "4.4.3"])("accepts the installed Zod %s peer context without requiring unrelated contexts to match", (version) => {
    const plugin = pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { "zod-to-json-schema": "3.25.2" });
    pkg(path.join(root, "node_modules/zod-to-json-schema"), "zod-to-json-schema", "3.25.2", {}, { peerDependencies: { zod: "^3.25.0 || ^4.0.0" } });
    pkg(path.join(root, "node_modules/zod"), "zod", version);
    lock({
      "zod-to-json-schema@3.25.2(zod@3.25.76)": { dependencies: { zod: "3.25.76" } },
      "zod-to-json-schema@3.25.2(zod@4.4.3)": { dependencies: { zod: "4.4.3" } },
    });
    materializeSelectedPluginDependencies(root, ids);
    fs.rmSync(path.join(root, "node_modules"), { recursive: true });
    const schema = resolvePackage("zod-to-json-schema", plugin);
    expect(JSON.parse(fs.readFileSync(path.join(resolvePackage("zod", schema), "package.json"), "utf8")).version).toBe(version);
    expect(() => assertSelectedPluginDependencies(root, ids)).not.toThrow();
  });

  it("rejects an ambiguous out-of-range replacement across peer contexts", () => {
    pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { sdk: "1.0.0" });
    pkg(path.join(root, "node_modules/sdk"), "sdk", "1.0.0", { dep: "^7.0.0" });
    pkg(path.join(root, "node_modules/dep"), "dep", "8.7.2");
    lock({
      "sdk@1.0.0(peer@1.0.0)": { dependencies: { dep: "8.7.2" } },
      "sdk@1.0.0(peer@2.0.0)": { dependencies: { dep: "9.0.0" } },
    });
    expect(() => materializeSelectedPluginDependencies(root, ids)).toThrow("Locked runtime dependency");
  });

  it("materializes locally built patched mjs sidecars and copies private dependencies", () => {
    const built = pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { dep: "1.0.0" });
    const overlay = pkg(path.join(root, "dist-runtime/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { dep: "1.0.0" });
    pkg(path.join(root, "node_modules/dep"), "dep", "1.0.0");
    write(path.join(built, "patched.mjs"), "export const localPatch = true;");
    fs.symlinkSync(path.join(built, "patched.mjs"), path.join(overlay, "patched.mjs"));
    materializeSelectedPluginDependencies(root, ids);
    materializeSelectedPluginAssets(root, ids);
    expect(fs.lstatSync(path.join(overlay, "patched.mjs")).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(path.join(overlay, "patched.mjs"), "utf8")).toContain("localPatch");
    const packed = path.join(root, "packed");
    pkg(path.join(packed, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { dep: "1.0.0" });
    pkg(path.join(packed, "dist-runtime/extensions/feishu"), "@openclaw/feishu", "2026.9.3", { dep: "1.0.0" });
    copySelectedPluginDependencies(root, packed);
    expect(() => assertSelectedPluginDependencies(packed, ids)).not.toThrow();
  });

  it("rejects asset links outside the vendor payload", () => {
    const plugin = pkg(path.join(root, "dist/extensions/feishu"), "@openclaw/feishu", "2026.9.3");
    fs.symlinkSync(__filename, path.join(plugin, "outside.mjs"));
    expect(() => materializeSelectedPluginAssets(root, ids)).toThrow("escapes vendor payload");
  });

  it("preserves unselected CJS plugin entries and chunks before link cleanup, including a partial-prune retry", () => {
    const extra = { openclaw: { extensions: ["./index.cjs"], setupEntry: "./setup-entry.cjs", channel: { configuredState: { specifier: "./configured-state.cjs" } } } };
    const built = pkg(path.join(root, "dist/extensions/msteams"), "@openclaw/msteams", "2026.9.3", {}, extra);
    const overlay = pkg(path.join(root, "dist-runtime/extensions/msteams"), "@openclaw/msteams", "2026.9.3", {}, extra);
    for (const name of ["index.cjs", "setup-entry.cjs", "configured-state.cjs", "chunk.cjs", "lazy.mjs"]) {
      write(path.join(built, name), name === "index.cjs" ? 'module.exports = require("./chunk.cjs");' : "module.exports = 42;");
      if (name !== "chunk.cjs") fs.symlinkSync(path.join(built, name), path.join(overlay, name));
    }
    write(path.join(overlay, "index.js"), "// preserve upstream ESM wrapper");
    materializeRuntimeModuleLinks(root);
    materializeRuntimeModuleLinks(root);
    expect(() => assertBundledPluginEntries(root)).not.toThrow();
    expect(require(path.join(overlay, "index.cjs"))).toBe(42);
    expect(fs.lstatSync(path.join(overlay, "lazy.mjs")).isSymbolicLink()).toBe(false);
    expect(fs.readFileSync(path.join(overlay, "index.js"), "utf8")).toContain("preserve upstream ESM wrapper");
  });

  it.each(["index.cjs", "setup-entry.cjs", "configured-state.cjs"])("rejects an unselected plugin's missing %s", (missing) => {
    const extra = { openclaw: { extensions: ["./index.cjs"], setupEntry: "./setup-entry.cjs", channel: { configuredState: { specifier: "./configured-state.cjs" } } } };
    const dir = pkg(path.join(root, "dist-runtime/extensions/msteams"), "@openclaw/msteams", "2026.9.3", {}, extra);
    for (const name of ["index.cjs", "setup-entry.cjs", "configured-state.cjs"]) if (name !== missing) write(path.join(dir, name), "module.exports = {};");
    expect(() => assertBundledPluginEntries(root)).toThrow(`Missing retained plugin entry: dist-runtime/msteams/./${missing}`);
  });

  it("keeps fs-safe native runtime binaries and rejects unrelated addons", () => {
    expect(shouldCopyVendorNative("/node_modules/fs-safe-win32-x64-msvc/fs-safe.node")).toBe(true);
    expect(shouldCopyVendorNative("C:\\node_modules\\fs-safe-linux-x64-gnu\\fs-safe.node")).toBe(true);
    expect(shouldCopyVendorNative("/node_modules/sqlite-vec-darwin-arm64/vec0.dylib")).toBe(true);
    expect(shouldCopyVendorNative("C:\\app\\node_modules\\@koromix\\koffi-win32-x64\\koffi.node")).toBe(true);
    expect(shouldCopyVendorNative("/node_modules/@koromix/koffi-win32-arm64/koffi.node")).toBe(true);
    expect(shouldCopyVendorNative("/node_modules/unselected/addon.node")).toBe(false);
    expect(shouldCopyVendorNative("/dist/workspace-chunk.mjs")).toBe(true);
  });
});
