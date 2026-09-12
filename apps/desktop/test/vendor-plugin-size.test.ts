import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { runInNewContext } from "node:vm";

const require = createRequire(import.meta.url);
const builder = createRequire(require.resolve("electron-builder"));
const tar = builder("tar");
const { stripPrivateSourceMaps, stripSelectedPluginSourceMaps, stripRuntimeDevelopmentFiles,
  deduplicateMirroredPluginDependencies, deduplicateRuntimeDependencies, VENDOR_ARCHIVE_ENV } = require("../scripts/vendor-plugin-size.cjs");
const { copySelectedPluginDependencies } = require("../scripts/copy-vendor-deps.cjs");
const { isSelectedPluginNodeModules } = require("../scripts/vendor-plugin-dependencies.cjs");
let root: string;
const write = (file: string, value: string | object) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
};
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), "plugin-size-test-")); });
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });

function fixture(vendor = path.join(root, "vendor")) {
  for (const base of ["dist", "dist-runtime"]) {
    const dir = path.join(vendor, base, "extensions/feishu");
    write(path.join(dir, "package.json"), { name: "@openclaw/feishu", version: "1.0.0", dependencies: { host: "1.0.0", dep: "2.0.0" } });
    const modules = path.join(dir, "node_modules");
    write(path.join(modules, "host/package.json"), { name: "host", version: "1.0.0", main: "index.js", dependencies: { dep: "1.0.0" } });
    write(path.join(modules, "host/index.js"), 'module.exports = require("dep");');
    for (const [name, version] of [["dep", "2.0.0"], ["host/node_modules/dep", "1.0.0"]]) {
      write(path.join(modules, name, "package.json"), { name: "dep", version, main: "index.js" });
      write(path.join(modules, name, "index.js"), `module.exports = ${JSON.stringify(version)};`);
    }
  }
  const source = path.join(vendor, "dist/extensions/feishu/node_modules");
  const destination = path.join(vendor, "dist-runtime/extensions/feishu/node_modules");
  return { vendor, source, destination };
}

function expectPrivateResolution(vendor: string) {
  for (const base of ["dist", "dist-runtime"]) {
    const fromPlugin = createRequire(path.join(vendor, base, "extensions/feishu/package.json"));
    expect(fromPlugin("dep")).toBe("2.0.0");
    expect(fromPlugin("host")).toBe("1.0.0");
  }
}

describe("mirrored plugin dependency size", () => {
  it("hardlinks only identical relative files, preserving nested versions, paths and module resolution", () => {
    const { vendor, source, destination } = fixture();
    write(path.join(source, "host/different.js"), "source");
    write(path.join(destination, "host/different.js"), "target");
    const result = deduplicateMirroredPluginDependencies(vendor);
    expect(result.linkedFiles).toBe(6);
    expect(result.savedBytes).toBeGreaterThan(0);
    for (const relative of ["dep/index.js", "host/node_modules/dep/index.js"]) {
      const left = fs.statSync(path.join(source, relative));
      const right = fs.lstatSync(path.join(destination, relative));
      expect(right.isSymbolicLink()).toBe(false);
      expect(right.ino).toBe(left.ino);
      expect(right.dev).toBe(left.dev);
      expect(fs.realpathSync(path.join(source, relative))).not.toBe(fs.realpathSync(path.join(destination, relative)));
    }
    expect(fs.readFileSync(path.join(destination, "host/different.js"), "utf8")).toBe("target");
    expectPrivateResolution(vendor);
    const again = deduplicateMirroredPluginDependencies(vendor);
    expect(again.linkedFiles).toBe(0);
    expect(again.alreadyLinked).toBe(6);
  });

  it("does not change executable permissions or follow private file symlinks", () => {
    const { vendor, source, destination } = fixture();
    write(path.join(source, "host/tool.js"), "tool");
    write(path.join(destination, "host/tool.js"), "tool");
    fs.chmodSync(path.join(source, "host/tool.js"), 0o755);
    fs.chmodSync(path.join(destination, "host/tool.js"), 0o644);
    write(path.join(root, "outside.js"), "outside");
    fs.symlinkSync(path.join(root, "outside.js"), path.join(destination, "host/alias.js"));
    write(path.join(source, "host/alias.js"), "outside");
    deduplicateMirroredPluginDependencies(vendor);
    expect(fs.lstatSync(path.join(destination, "host/alias.js")).isSymbolicLink()).toBe(true);
    if (process.platform !== "win32") {
      expect(fs.statSync(path.join(destination, "host/tool.js")).mode & 0o777).toBe(0o644);
      expect(fs.statSync(path.join(destination, "host/tool.js")).ino).not.toBe(fs.statSync(path.join(source, "host/tool.js")).ino);
    }
  });

  it("keeps the original file intact when hardlink creation fails", () => {
    const { vendor, destination } = fixture();
    const file = path.join(destination, "dep/index.js");
    const before = fs.readFileSync(file);
    vi.spyOn(fs, "linkSync").mockImplementation(() => { throw Object.assign(new Error("cross-device"), { code: "EXDEV" }); });
    expect(() => deduplicateMirroredPluginDependencies(vendor)).toThrow("Cannot hardlink mirrored runtime file");
    expect(fs.readFileSync(file)).toEqual(before);
    expect(fs.readdirSync(path.dirname(file)).some((name) => name.includes("rivonclaw-hardlink"))).toBe(false);
  });

  it("re-establishes destination-only hardlinks after Windows/Linux afterPack copying", () => {
    const { vendor, source } = fixture();
    deduplicateMirroredPluginDependencies(vendor);
    const packed = path.join(root, "packed");
    fs.cpSync(vendor, packed, { recursive: true });
    const left = path.join(packed, "dist/extensions/feishu/node_modules/dep/index.js");
    const right = path.join(packed, "dist-runtime/extensions/feishu/node_modules/dep/index.js");
    expect(fs.statSync(left).ino).not.toBe(fs.statSync(right).ino);
    copySelectedPluginDependencies(vendor, packed);
    expect(fs.statSync(left).ino).toBe(fs.statSync(right).ino);
    expect(fs.statSync(left).ino).not.toBe(fs.statSync(path.join(source, "dep/index.js")).ino);
    expectPrivateResolution(packed);
  });

  it("tar records a hardlink, extraction preserves it, and private imports still resolve", async () => {
    const { vendor } = fixture();
    // A large repeated file makes the archive-size assertion independent of header padding.
    for (const base of ["dist", "dist-runtime"]) write(path.join(vendor, base, "extensions/feishu/node_modules/dep/large.js"), "x".repeat(256 * 1024));
    const full = path.join(root, "full.tar");
    const packed = path.join(root, "dedup.tar");
    const env = { ...process.env, ...VENDOR_ARCHIVE_ENV };
    execFileSync("tar", ["-cf", full, "-C", vendor, "dist", "dist-runtime"], { env });
    deduplicateMirroredPluginDependencies(vendor);
    execFileSync("tar", ["-cf", packed, "-C", vendor, "dist", "dist-runtime"], { env });
    const links: string[] = [];
    await tar.t({ file: packed, onReadEntry: (entry: any) => { if (entry.type === "Link") links.push(entry.path); } });
    expect(links).toContain("dist-runtime/extensions/feishu/node_modules/dep/large.js");
    expect(fs.statSync(full).size - fs.statSync(packed).size).toBeGreaterThanOrEqual(256 * 1024);
    const extracted = path.join(root, "extracted");
    fs.mkdirSync(extracted);
    execFileSync("tar", ["-xf", packed, "-C", extracted]);
    const left = path.join(extracted, "dist/extensions/feishu/node_modules/dep/large.js");
    const right = path.join(extracted, "dist-runtime/extensions/feishu/node_modules/dep/large.js");
    expect(fs.statSync(left).ino).toBe(fs.statSync(right).ino);
    expectPrivateResolution(extracted);
  });
});

describe("private source-map pruning", () => {
  it("removes test/build cache payloads without deleting runtime caches or data files", () => {
    const modules = path.join(root, "node_modules");
    for (const dir of [".experimental-vitest-cache", ".vitest", ".vite", ".turbo"]) {
      write(path.join(modules, dir, "v1/code.bin"), "compiled cache");
    }
    write(path.join(modules, "runtime/cache/data.json"), "runtime data");
    expect(stripRuntimeDevelopmentFiles(modules)).toEqual({ files: 4, bytes: 56 });
    expect(fs.readFileSync(path.join(modules, "runtime/cache/data.json"), "utf8")).toBe("runtime data");
    expect(stripRuntimeDevelopmentFiles(modules).files).toBe(0);
  });
  it("removes declarations and explicit tests but retains runtime TS, assets, licenses and SDK declarations", () => {
    const { vendor, source } = fixture();
    for (const name of ["index.d.ts", "index.d.mts", "index.d.cts", "index.test.ts", "index.spec.cjs"]) {
      write(path.join(source, "host", name), "development only");
    }
    for (const name of ["index.ts", "index.mts", "test-data.json", "LICENSE", "testing.js"]) {
      write(path.join(source, "host", name), "runtime");
    }
    write(path.join(vendor, "dist/plugin-sdk/index.d.ts"), "export {};");
    expect(stripRuntimeDevelopmentFiles(source).files).toBe(5);
    expect(stripRuntimeDevelopmentFiles(source).files).toBe(0);
    for (const name of ["index.ts", "index.mts", "test-data.json", "LICENSE", "testing.js"]) {
      expect(fs.existsSync(path.join(source, "host", name))).toBe(true);
    }
    expect(fs.existsSync(path.join(vendor, "dist/plugin-sdk/index.d.ts"))).toBe(true);
    expectPrivateResolution(vendor);
  });
  it("prunes maps from both runtime roots without stripping canonical SDK output", () => {
    const { vendor, source, destination } = fixture();
    for (const dir of [source, destination]) write(path.join(dir, "dep/index.js.map"), { version: 3, sources: [], mappings: "" });
    write(path.join(vendor, "dist/plugin-sdk/index.d.ts"), "export {};");
    expect(stripSelectedPluginSourceMaps(vendor).files).toBe(2);
    expect(fs.existsSync(path.join(source, "dep/index.js.map"))).toBe(false);
    expect(fs.existsSync(path.join(destination, "dep/index.js.map"))).toBe(false);
    expect(fs.existsSync(path.join(vendor, "dist/plugin-sdk/index.d.ts"))).toBe(true);
    const prune = fs.readFileSync(new URL("../scripts/prune-vendor-deps.cjs", import.meta.url), "utf8");
    expect(prune).toContain("const privateMaps = stripSelectedPluginSourceMaps(vendorDir);");
    expectPrivateResolution(vendor);
  });

  it("removes only valid JS/TS source maps through the existing prune boundary", () => {
    const { vendor, source } = fixture();
    for (const name of ["index.js.map", "index.mjs.map", "index.cjs.map", "index.d.ts.map"]) {
      write(path.join(source, "host", name), { version: 3, sources: ["../src/index.ts"], names: [], mappings: "AAAA" });
    }
    write(path.join(source, "host/index.js"), 'module.exports = require("dep");\n//# sourceMappingURL=index.js.map');
    write(path.join(source, "host/LICENSE"), "Keep the license.");
    write(path.join(source, "host/index.d.ts"), "export {};");
    write(path.join(source, "host/asset.js.map"), { data: "not a source map" });
    write(path.join(source, "host/location.map"), { version: 3, sources: [], mappings: "" });
    const script = fs.readFileSync(new URL("../scripts/prune-vendor-deps.cjs", import.meta.url), "utf8");
    const fn = script.slice(script.indexOf("function stripNonRuntimeFiles("), script.indexOf("\nfunction stripOtherDarwinArch("));
    const strip = runInNewContext(`${fn}; stripNonRuntimeFiles`, { vendorDir: vendor, isSelectedPluginNodeModules, stripPrivateSourceMaps });
    expect(strip(source).files).toBe(4);
    for (const name of ["LICENSE", "index.d.ts", "asset.js.map", "location.map"]) expect(fs.existsSync(path.join(source, "host", name))).toBe(true);
    expectPrivateResolution(vendor);
    expect(strip(source).files).toBe(0);
  });

  it("uses the same AppleDouble-free tar environment in production", () => {
    expect(VENDOR_ARCHIVE_ENV).toEqual({ COPYFILE_DISABLE: "1" });
    const archive = fs.readFileSync(new URL("../scripts/archive-vendor-runtime.cjs", import.meta.url), "utf8");
    expect(archive).toContain("env: { ...process.env, ...VENDOR_ARCHIVE_ENV }");
  });
});

describe("root and private runtime dependency deduplication", () => {
  it("archives shared root/private files once and preserves imports after extraction", async () => {
    const { vendor, source, destination } = fixture();
    const target = path.join(vendor, "node_modules/dep");
    fs.cpSync(path.join(source, "dep"), target, { recursive: true });
    for (const dir of [target, path.join(source, "dep"), path.join(destination, "dep")]) {
      write(path.join(dir, "large.js"), "x".repeat(256 * 1024));
    }
    deduplicateMirroredPluginDependencies(vendor);
    const before = path.join(root, "before.tar");
    const after = path.join(root, "after.tar");
    const env = { ...process.env, ...VENDOR_ARCHIVE_ENV };
    execFileSync("tar", ["-cf", before, "-C", vendor, "node_modules", "dist", "dist-runtime"], { env });
    deduplicateRuntimeDependencies(vendor);
    execFileSync("tar", ["-cf", after, "-C", vendor, "node_modules", "dist", "dist-runtime"], { env });
    expect(fs.statSync(before).size - fs.statSync(after).size).toBeGreaterThanOrEqual(256 * 1024);
    const extracted = path.join(root, "extracted");
    fs.mkdirSync(extracted);
    await tar.x({ file: after, cwd: extracted });
    expectPrivateResolution(extracted);
    expect(fs.statSync(path.join(extracted, "node_modules/dep/large.js")).ino)
      .toBe(fs.statSync(path.join(extracted, "dist/extensions/feishu/node_modules/dep/large.js")).ino);
  });

  it("leaves originals intact on failed linking", () => {
    const { vendor, source } = fixture();
    const file = path.join(source, "dep/index.js");
    const before = fs.readFileSync(file);
    vi.spyOn(fs, "linkSync").mockImplementation(() => { throw new Error("link failed"); });
    expect(() => deduplicateRuntimeDependencies(vendor)).toThrow("link failed");
    expect(fs.readFileSync(file)).toEqual(before);
    expect(fs.readdirSync(path.dirname(file)).some((name) => name.includes("rivonclaw-hardlink"))).toBe(false);
  });

  it("shares identical package files across all three copies without changing private resolution", () => {
    const { vendor, source, destination } = fixture();
    fs.cpSync(path.join(source, "dep"), path.join(vendor, "node_modules/dep"), { recursive: true });
    deduplicateMirroredPluginDependencies(vendor);
    const result = deduplicateRuntimeDependencies(vendor);
    expect(result.savedBytes).toBeGreaterThan(0);
    const files = [path.join(vendor, "node_modules/dep/index.js"),
      path.join(source, "dep/index.js"), path.join(destination, "dep/index.js")];
    expect(new Set(files.map((file) => fs.statSync(file).ino)).size).toBe(1);
    expect(files.every((file) => !fs.lstatSync(file).isSymbolicLink())).toBe(true);
    expect(deduplicateRuntimeDependencies(vendor).linkedFiles).toBe(0);
    expectPrivateResolution(vendor);
  });

  it("keeps identical bytes separate across package versions and names", () => {
    const { vendor, source } = fixture();
    const current = path.join(source, "dep");
    const nested = path.join(source, "host/node_modules/dep");
    const scoped = path.join(vendor, "node_modules/@example/dep");
    write(path.join(scoped, "package.json"), { name: "@example/dep", version: "2.0.0" });
    for (const dir of [current, nested, scoped]) write(path.join(dir, "shared.js"), "same bytes");
    deduplicateRuntimeDependencies(vendor);
    expect(new Set([current, nested, scoped].map((dir) => fs.statSync(path.join(dir, "shared.js")).ino)).size).toBe(3);
    expectPrivateResolution(vendor);
  });

  it("does not share different bytes, native binaries, permissions or external hardlinks", () => {
    const { vendor, source, destination } = fixture();
    const target = path.join(vendor, "node_modules/dep");
    fs.cpSync(path.join(source, "dep"), target, { recursive: true });
    for (const dir of [target, path.join(source, "dep"), path.join(destination, "dep")]) {
      write(path.join(dir, "native.node"), "native");
      write(path.join(dir, "data.json"), "original");
      write(path.join(dir, "mode.js"), "original");
      write(path.join(dir, "external.js"), "external");
    }
    write(path.join(target, "data.json"), "modified");
    fs.chmodSync(path.join(target, "mode.js"), 0o755);
    fs.linkSync(path.join(target, "external.js"), path.join(root, "external.js"));
    const original = fs.statSync(path.join(target, "external.js")).ino;
    deduplicateRuntimeDependencies(vendor);
    for (const file of ["native.node", "data.json", "external.js", ...(process.platform === "win32" ? [] : ["mode.js"])]) {
      expect(fs.statSync(path.join(target, file)).ino).not.toBe(fs.statSync(path.join(source, "dep", file)).ino);
    }
    expect(fs.statSync(path.join(target, "external.js")).ino).toBe(original);
    expectPrivateResolution(vendor);
  });
});
