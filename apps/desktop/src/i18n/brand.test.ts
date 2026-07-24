import { describe, expect, it } from "vitest";
import { brandName } from "./brand.js";

describe("brandName", () => {
  it("uses TK匠 for Chinese", () => {
    expect(brandName("zh")).toBe("TK匠");
  });

  it("uses TK Copilot for every non-Chinese locale and fallback", () => {
    expect(brandName("en")).toBe("TK Copilot");
    expect(brandName("de")).toBe("TK Copilot");
    expect(brandName("unknown")).toBe("TK Copilot");
  });
});
