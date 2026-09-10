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
const { stripPrivateSourceMaps, stripSelectedPluginSourceMaps, deduplicateMirroredPluginDependencies, VENDOR_ARCHIVE_ENV } = require("../scripts/vendor-plugin-size.cjs");
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
