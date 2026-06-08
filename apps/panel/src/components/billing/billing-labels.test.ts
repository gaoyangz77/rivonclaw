import { describe, expect, it } from "vitest";
import { checkoutProviderOptions, preferredCheckoutProvider } from "./billing-labels.js";

describe("billing checkout provider labels", () => {
  it("keeps payment method order stable across languages", () => {
    expect(checkoutProviderOptions("en-US")).toEqual(["STRIPE", "LAKALA"]);
    expect(checkoutProviderOptions("zh-CN")).toEqual(["STRIPE", "LAKALA"]);
  });

  it("chooses the language-preferred default without reordering elements", () => {
    const providers = checkoutProviderOptions("zh-CN");

    expect(preferredCheckoutProvider("zh-CN", providers)).toBe("LAKALA");
    expect(preferredCheckoutProvider("en-US", providers)).toBe("STRIPE");
  });

  it("falls back to the first available provider when the preferred provider is unavailable", () => {
    expect(preferredCheckoutProvider("zh-CN", ["STRIPE"])).toBe("STRIPE");
    expect(preferredCheckoutProvider("en-US", ["LAKALA"])).toBe("LAKALA");
  });
});
