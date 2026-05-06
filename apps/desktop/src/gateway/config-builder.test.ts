import { describe, expect, it } from "vitest";
import { DEFAULT_GATEWAY_TOOL_ALLOWLIST } from "./config-builder.js";

describe("gateway config builder", () => {
  it("does not enable the OpenClaw pdf tool by default", () => {
    expect(DEFAULT_GATEWAY_TOOL_ALLOWLIST).not.toContain("pdf");
  });
});
