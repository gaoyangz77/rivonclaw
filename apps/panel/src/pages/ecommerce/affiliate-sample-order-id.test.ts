import { describe, expect, it } from "vitest";
import { sampleOrderIdForCard } from "./affiliate-sample-order-id.js";

describe("Sample card order ID", () => {
  it.each([undefined, null, "", "  ", "0", "00"])("does not display %s", value => {
    expect(sampleOrderIdForCard(value)).toBeNull();
  });
  it("preserves opaque IDs as strings and trims whitespace", () => {
    expect(sampleOrderIdForCard("  8071789659962573985 ")).toBe("8071789659962573985");
  });
  it("can use a valid legacy ID instead of a zero snapshot", () => {
    expect(sampleOrderIdForCard("0", "1234567890123456789")).toBe("1234567890123456789");
  });
});
