import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { preparePluginManifest, packageExternalPlugins } = require("../scripts/package-external-plugins.cjs");
const roots: string[] = [];
function write(file: string, content: string | object) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
}
function fixture(name = "@rivonclaw/rivonclaw-event-bridge", dependencies: Record<string, string> = { "@rivonclaw/plugin-sdk": "workspace:*" }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "external-plugin-test-"));
  roots.push(root);
  const source = path.join(root, "repo/extensions/plugin");
  const dest = path.join(root, "resources/extensions/plugin");
  const manifest = { name, version: "1.0.0", type: "module", dependencies, openclaw: { extensions: ["./dist/index.mjs"] } };
  write(path.join(source, "package.json"), manifest);
  write(path.join(dest, "package.json"), manifest);
  write(path.join(dest, "openclaw.plugin.json"), { id: "test-plugin" });
  write(path.join(dest, "dist/index.mjs"), "export default {};\n");
  write(path.join(root, "repo/vendor/openclaw/package.json"), { exports: { "./plugin-sdk/test": "./dist/test.mjs" } });
  return { root, source, dest };
}
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

describe("packaged external plugin manifests", () => {
  it("removes only reviewed bundled dependencies and preserves source metadata", () => {
    const { source, dest } = fixture();
    const before = fs.readFileSync(path.join(source, "package.json"), "utf8");
    const { manifest } = preparePluginManifest(source, dest, {});
    expect(manifest.dependencies).toEqual({});
    expect(manifest.openclaw.extensions).toEqual(["./dist/index.mjs"]);
    expect(fs.readFileSync(path.join(source, "package.json"), "utf8")).toBe(before);
  });

  it.each([
    'import "@rivonclaw/plugin-sdk";',
    'export { x } from "@rivonclaw/plugin-sdk/subpath";',
    'await import("@rivonclaw/plugin-sdk/subpath");',
    'require("@rivonclaw/plugin-sdk");',
    '__require("@rivonclaw/plugin-sdk");',
  ])("rejects falsely bundled runtime imports: %s", (code) => {
    const { source, dest } = fixture();
    write(path.join(dest, "dist/chunk.mjs"), code);
    expect(() => preparePluginManifest(source, dest, {})).toThrow("Claimed bundled dependency still imported");
  });

  it("fails closed on unreviewed dependencies and undeclared imports", () => {
    const { source, dest } = fixture(undefined, { surprise: "1.0.0" });
    expect(() => preparePluginManifest(source, dest, {})).toThrow("Unreviewed runtime dependency");
    write(path.join(dest, "dist/index.mjs"), 'import "other-package";');
    expect(() => preparePluginManifest(source, dest, {})).toThrow("Undeclared packaged external");
  });

  it("validates SDK exports and missing relative chunks", () => {
    const { source, dest } = fixture();
    write(path.join(dest, "dist/index.mjs"), 'import "openclaw/plugin-sdk/retired";');
    expect(() => preparePluginManifest(source, dest, {})).toThrow("Unexported OpenClaw SDK");
    write(path.join(dest, "dist/index.mjs"), 'import "./absent.mjs";');
    expect(() => preparePluginManifest(source, dest, {})).toThrow("Missing or escaping");
  });

  it("requires all copied PDF.js assets before removing its dependency", () => {
    const { source, dest } = fixture("@rivonclaw/rivonclaw-cloud-tools", { "pdfjs-dist": "5.7.284" });
    expect(() => preparePluginManifest(source, dest, {})).toThrow("pdfjs/pdf.mjs");
    write(path.join(dest, "dist/pdfjs/pdf.mjs"), "export {};\n");
    expect(() => preparePluginManifest(source, dest, {})).toThrow("pdfjs/pdf.worker.mjs");
  });

  it("allows ws accelerators only inside an actual catch fallback", () => {
    const { source, dest } = fixture("@rivonclaw/rivonclaw-mobile-chat-channel", { ws: "8.18.0" });
    write(path.join(dest, "dist/index.mjs"), 'try { __require("bufferutil"); } catch {}');
    expect(preparePluginManifest(source, dest, {}).manifest.dependencies).toEqual({});
    write(path.join(dest, "dist/index.mjs"), '__require("bufferutil");');
    expect(() => preparePluginManifest(source, dest, {})).toThrow("Undeclared packaged external");
  });

  it("ships real dynamic imports and their complete closure in packaged-only node_modules", () => {
    const { root, source, dest } = fixture("openclaw-weixin", {
      "@tencent-weixin/openclaw-weixin": "^2.4.1", "qrcode-terminal": "0.12.0", "silk-wasm": "3.7.1",
    });
    write(path.join(dest, "dist/index.mjs"), 'await import("qrcode-terminal"); await import("silk-wasm");');
    for (const [name, version] of [["qrcode-terminal", "0.12.0"], ["silk-wasm", "3.7.1"]]) {
      write(path.join(source, "node_modules", name, "package.json"), { name, version, main: "index.js", dependencies: { child: "1.0.0" } });
      write(path.join(source, "node_modules", name, "index.js"), 'module.exports = require("child");');
    }
    write(path.join(source, "node_modules/child/package.json"), { name: "child", version: "1.0.0", main: "index.js" });
    write(path.join(source, "node_modules/child/index.js"), "module.exports = 42;");
    const result = packageExternalPlugins(path.join(root, "resources"), path.join(root, "repo"));
    expect(result[0].dependencies).toEqual(["qrcode-terminal", "silk-wasm"]);
    expect(createRequire(path.join(dest, "package.json"))("silk-wasm")).toBe(42);
    expect(fs.existsSync(path.join(dest, "node_modules/child/package.json"))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8")).dependencies).toHaveProperty("@tencent-weixin/openclaw-weixin");
  });

  it("fails instead of hiding a real missing external", () => {
    const { root, dest } = fixture("openclaw-weixin", { "missing-media-fixture": "3.7.1" });
    write(path.join(dest, "dist/index.mjs"), 'await import("missing-media-fixture");');
    expect(() => packageExternalPlugins(path.join(root, "resources"), path.join(root, "repo"))).toThrow("Missing runtime dependency");
  });
});
