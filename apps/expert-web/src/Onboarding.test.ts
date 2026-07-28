import { describe, expect, it } from "vitest";
import { buildProfileMarkets } from "./Onboarding.js";

describe("buildProfileMarkets", () => {
  it("combines localized click selections with free-form context", () => {
    const names: Record<string, string> = {
      US: "美国",
      JP: "日本",
    };

    expect(
      buildProfileMarkets(
        ["US", "JP"],
        "我也可能考虑欧洲，但还没有决定",
        (code) => names[code] ?? code,
      ),
    ).toEqual(["美国 (US)", "日本 (JP)", "我也可能考虑欧洲，但还没有决定"]);
  });

  it("keeps a free-form market description as one natural-language statement", () => {
    expect(buildProfileMarkets([], "东南亚，优先考虑华人用户多的市场", (code) => code)).toEqual([
      "东南亚，优先考虑华人用户多的市场",
    ]);
  });
});
