import { describe, expect, it } from "vitest";
import { redactUserPaths, sanitizeTelemetryErrorText } from "./telemetry-sanitize.js";

describe("redactUserPaths", () => {
  it.each([
    ["/Users/alice/Library/x.sqlite", "~/Library/x.sqlite"],
    ["/home/bob/.rivonclaw/db", "~/.rivonclaw/db"],
    ["C:\\Users\\Chong Tian\\AppData", "~\\AppData"],
    ["D:\\Users\\carol\\AppData\\x.sqlite", "~\\AppData\\x.sqlite"],
    ["C:/Users/dave/AppData/x.sqlite", "~/AppData/x.sqlite"],
  ])("redacts %s", (input, expected) => {
    expect(redactUserPaths(input)).toBe(expected);
  });
});

describe("sanitizeTelemetryErrorText", () => {
  it("keeps the gateway's startup failure readable without the user name", () => {
    const message =
      "SQLite integrity check timed out after 30 seconds for C:\\Users\\chongtianhou\\AppData\\Roaming\\RivonClaw\\openclaw\\agents\\customer-service\\openclaw-agent.sqlite. Stop the Gateway service (lastObservedPhase=checking)";

    expect(sanitizeTelemetryErrorText(message, 500)).toBe(
      "SQLite integrity check timed out after 30 seconds for ~\\AppData\\Roaming\\RivonClaw\\openclaw\\agents\\customer-service\\openclaw-agent.sqlite. Stop the Gateway service (lastObservedPhase=checking)",
    );
  });

  it("masks token-like runs", () => {
    expect(
      sanitizeTelemetryErrorText(
        "auth failed for sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789 header",
        500,
      ),
    ).toBe("auth failed for [redacted] header");
  });

  it("collapses whitespace and caps the length", () => {
    const result = sanitizeTelemetryErrorText(
      "first line\n  second line " + "word ".repeat(40),
      40,
    );

    expect(result).toHaveLength(40);
    expect(result.startsWith("first line second line word")).toBe(true);
    expect(result.endsWith("…")).toBe(true);
  });
});
