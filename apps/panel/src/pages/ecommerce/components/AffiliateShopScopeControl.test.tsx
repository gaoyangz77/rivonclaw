// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { applySnapshot } from "mobx-state-tree";
import { runtimeStatusStore } from "../../../store/runtime-status-store.js";
import type { AffiliateAnalyticsShop } from "../affiliate-analytics-scope.js";
import { AffiliateShopScopeControl } from "./AffiliateShopScopeControl.js";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const shops = [
  { id: "shop-alias", alias: "US hero shop", shopName: "Official Store Name", region: "US" },
  { id: "shop-plain", alias: null, shopName: "Windboss Benessere", region: "IT" },
  { id: "shop-bare", alias: null, shopName: null, region: "DE" },
] as unknown as AffiliateAnalyticsShop[];

function setPrivacyMode(enabled: boolean) {
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: enabled });
}

afterEach(() => {
  cleanup();
  setPrivacyMode(false);
});

describe("AffiliateShopScopeControl privacy masking", () => {
  it("masks a platform shop name but never the operator's own alias", () => {
    setPrivacyMode(true);
    render(<AffiliateShopScopeControl shops={shops} selected={[]} onChange={() => {}} />);

    // An alias exists precisely so the shop can be named on a shared screen.
    expect(screen.getByText("US hero shop").hasAttribute("data-tk-private")).toBe(false);
    expect(screen.queryByText("Official Store Name")).toBeNull();

    expect(screen.getByText("Windboss Benessere").getAttribute("data-tk-private")).toBe("text");

    // The id is opaque, so it stays readable.
    expect(screen.getByText("shop-bare").hasAttribute("data-tk-private")).toBe(false);
  });

  it("marks the same nodes regardless of whether privacy mode is on", () => {
    // Masking is CSS-driven off `html[data-privacy]`, so the marks are stable
    // and only the document attribute flips.
    render(<AffiliateShopScopeControl shops={shops} selected={[]} onChange={() => {}} />);

    expect(screen.getByText("Windboss Benessere").getAttribute("data-tk-private")).toBe("text");
    expect(screen.getByText("US hero shop").hasAttribute("data-tk-private")).toBe(false);

    act(() => setPrivacyMode(true));

    expect(screen.getByText("Windboss Benessere").getAttribute("data-tk-private")).toBe("text");
    expect(screen.getByText("US hero shop").hasAttribute("data-tk-private")).toBe(false);
  });
});
