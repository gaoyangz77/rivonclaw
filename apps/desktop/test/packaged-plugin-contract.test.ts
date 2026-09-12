import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { assertLoadedPluginInventory, runExternalNativeRuntimeSmoke } = require("../scripts/verify-vendor-runtime-contract.cjs");
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true }); });

function canvasFixture(code?: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "canvas-contract-"));
  roots.push(root);
  const plugin = path.join(root, "extensions-merchant/rivonclaw-cloud-tools");
  fs.mkdirSync(plugin, { recursive: true });
  fs.writeFileSync(path.join(plugin, "package.json"), JSON.stringify({ name: "test-plugin", version: "1.0.0" }));
  if (code !== undefined) {
    const canvas = path.join(plugin, "node_modules/@napi-rs/canvas");
    fs.mkdirSync(canvas, { recursive: true });
    fs.writeFileSync(path.join(canvas, "package.json"), JSON.stringify({ name: "@napi-rs/canvas", version: "1.0.0", main: "index.js" }));
    fs.writeFileSync(path.join(canvas, "index.js"), code);
    const native = path.join(plugin, `node_modules/@napi-rs/canvas-darwin-${process.arch}`);
    fs.mkdirSync(native, { recursive: true });
    fs.writeFileSync(path.join(native, "package.json"), JSON.stringify({ name: `@napi-rs/canvas-darwin-${process.arch}`, version: "1.0.0" }));
  }
  return root;
}

describe("external native runtime smoke", () => {
  it("rejects a missing Canvas payload", () => {
    expect(() => runExternalNativeRuntimeSmoke(canvasFixture())).toThrow("Missing packaged Canvas runtime");
  });
  it("propagates native loading failures", () => {
    expect(() => runExternalNativeRuntimeSmoke(canvasFixture('throw new Error("native load failed");'))).toThrow("native load failed");
  });
  it.each([0, 1])("renders and checks the output rather than only the manifest (bytes=%i)", (bytes) => {
    const root = canvasFixture(`exports.createCanvas = () => ({ getContext: () => ({ fillRect() {} }), toBuffer: () => Buffer.alloc(${bytes}) });`);
    if (bytes) expect(() => runExternalNativeRuntimeSmoke(root)).not.toThrow();
    else expect(() => runExternalNativeRuntimeSmoke(root)).toThrow("Packaged Canvas rendering failed");
  });
});
const methods = ["rivonclaw.weixin.login.start", "rivonclaw.weixin.login.wait"];
const inventory = (status: string, gatewayMethods = methods) => [{
  plugin: { id: "openclaw-weixin", status, channelIds: ["openclaw-weixin"], error: "missing dependency" },
  gatewayMethods,
}];

describe("actual packaged plugin inventory contract", () => {
  it("reads top-level QR method registrations from aggregate runtime inspection", () => {
    expect(() => assertLoadedPluginInventory(inventory("loaded"), ["openclaw-weixin"], true)).not.toThrow();
  });
  it("rejects dependency-health errors even when channel registration succeeded", () => {
    expect(() => assertLoadedPluginInventory(inventory("error"), ["openclaw-weixin"], true)).toThrow("missing dependency");
  });
  it("rejects missing plugins and missing QR registrations", () => {
    expect(() => assertLoadedPluginInventory([], ["openclaw-weixin"], true)).toThrow("did not discover");
    expect(() => assertLoadedPluginInventory(inventory("loaded", [methods[0]]), ["openclaw-weixin"], true)).toThrow(methods[1]);
  });
  it("checks every external plugin rather than only the vendor allowlist", () => {
    expect(() => assertLoadedPluginInventory(inventory("loaded"), ["openclaw-weixin", "rivonclaw-cs"], true)).toThrow("rivonclaw-cs");
  });
});
