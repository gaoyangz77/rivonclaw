import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { assertLoadedPluginInventory } = require("../scripts/verify-vendor-runtime-contract.cjs");
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
