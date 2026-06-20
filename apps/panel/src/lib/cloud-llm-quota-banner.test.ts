import { describe, expect, it } from "vitest";
import { resolveCloudLlmQuotaBannerState } from "./cloud-llm-quota-banner.js";

const cloudKey = [{ provider: "rivonclaw-pro", isDefault: true }];

function overview(usages: Array<{ window: string; remainingPercent: number }>, code = "ALLOWED") {
  return {
    accountLlm: {
      entitlement: {
        code,
        usage: usages,
      },
    },
  };
}

describe("resolveCloudLlmQuotaBannerState", () => {
  it("does not warn when the active key is not RivonClaw cloud LLM", () => {
    expect(resolveCloudLlmQuotaBannerState(
      [{ provider: "openai", isDefault: true }],
      overview([{ window: "FIVE_HOURS", remainingPercent: 0 }]),
    )).toBeNull();
  });

  it("returns an error when a five-hour quota window is exhausted", () => {
    expect(resolveCloudLlmQuotaBannerState(
      cloudKey,
      overview([{ window: "FIVE_HOURS", remainingPercent: 0 }]),
    )).toMatchObject({
      severity: "error",
      exhaustedWindows: ["FIVE_HOURS"],
    });
  });

  it("returns an error when the billing decision reports quota exceeded", () => {
    expect(resolveCloudLlmQuotaBannerState(
      cloudKey,
      overview([], "QUOTA_EXCEEDED"),
    )).toMatchObject({ severity: "error" });
  });

  it("returns a warning when a weekly quota window has 5 percent remaining", () => {
    expect(resolveCloudLlmQuotaBannerState(
      cloudKey,
      overview([{ window: "WEEK", remainingPercent: 5 }]),
    )).toMatchObject({
      severity: "warning",
      lowWindows: ["WEEK"],
    });
  });

  it("ignores unrelated quota windows", () => {
    expect(resolveCloudLlmQuotaBannerState(
      cloudKey,
      overview([{ window: "DAY", remainingPercent: 0 }]),
    )).toBeNull();
  });
});
