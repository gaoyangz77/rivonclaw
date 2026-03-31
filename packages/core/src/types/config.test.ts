import { describe, it, expect } from "vitest";
import { rivonClawConfigSchema } from "./config.js";

describe("rivonClawConfigSchema", () => {
  it("accepts a valid config", () => {
    const result = rivonClawConfigSchema.safeParse({
      region: "cn",
      language: "zh",
      gatewayVersion: "2026.2.10",
      panelPort: 4000,
    });
    expect(result.success).toBe(true);
  });

  it("rejects port below 1024", () => {
    const result = rivonClawConfigSchema.safeParse({
      region: "us",
      language: "en",
      gatewayVersion: "0.0.0",
      panelPort: 80,
    });
    expect(result.success).toBe(false);
  });

  it("rejects port above 65535", () => {
    const result = rivonClawConfigSchema.safeParse({
      region: "us",
      language: "en",
      gatewayVersion: "0.0.0",
      panelPort: 70000,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer port", () => {
    const result = rivonClawConfigSchema.safeParse({
      region: "us",
      language: "en",
      gatewayVersion: "0.0.0",
      panelPort: 4000.5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = rivonClawConfigSchema.safeParse({
      region: "us",
    });
    expect(result.success).toBe(false);
  });
});
