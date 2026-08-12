import { describe, expect, it, vi } from "vitest";
import { BEFORE_NAVIGATE_EVENT, navigationAllowed } from "./navigation-guard.js";

describe("navigation guard", () => {
  it("allows navigation when no active editor blocks it", () => {
    expect(navigationAllowed("/one", "/two")).toBe(true);
  });

  it("lets an active editor cancel navigation and exposes route context", () => {
    const listener = vi.fn((event: Event) => event.preventDefault());
    window.addEventListener(BEFORE_NAVIGATE_EVENT, listener);

    expect(navigationAllowed("/commerce/product-knowledge", "/commerce/shops")).toBe(false);
    expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
      from: "/commerce/product-knowledge",
      to: "/commerce/shops",
    });

    window.removeEventListener(BEFORE_NAVIGATE_EVENT, listener);
  });
});
