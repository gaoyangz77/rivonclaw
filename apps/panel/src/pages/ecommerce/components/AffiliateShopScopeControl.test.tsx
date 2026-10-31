// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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
  it("finds an alias by the platform shop name", () => {
    render(<AffiliateShopScopeControl shops={shops} selected={[]} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "ecommerce.affiliateAnalytics.selectedShops" }));

    fireEvent.change(screen.getByRole("searchbox", { name: "common.searchShops" }), {
      target: { value: "Official Store" },
    });

    expect(screen.getByText("US hero shop")).toBeTruthy();
    expect(screen.queryByText("Windboss Benessere")).toBeNull();
  });

  it("masks a platform shop name but never the operator's own alias", () => {
    setPrivacyMode(true);
    render(<AffiliateShopScopeControl shops={shops} selected={[]} onChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "ecommerce.affiliateAnalytics.selectedShops" }));

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
    fireEvent.click(screen.getByRole("button", { name: "ecommerce.affiliateAnalytics.selectedShops" }));

    expect(screen.getByText("Windboss Benessere").getAttribute("data-tk-private")).toBe("text");
    expect(screen.getByText("US hero shop").hasAttribute("data-tk-private")).toBe(false);

    act(() => setPrivacyMode(true));

    expect(screen.getByText("Windboss Benessere").getAttribute("data-tk-private")).toBe("text");
    expect(screen.getByText("US hero shop").hasAttribute("data-tk-private")).toBe(false);
  });
});

describe("AffiliateShopScopeControl bulk selection", () => {
  function renderControlled(initial: string[]) {
    const onChange = vi.fn();
    function Harness() {
      const [selected, setSelected] = useState(initial);
      return (
        <AffiliateShopScopeControl
          shops={shops}
          selected={selected}
          onChange={(next) => {
            onChange(next);
            setSelected(next);
          }}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "ecommerce.affiliateAnalytics.selectedShops" }));
    return onChange;
  }

  it("turns into deselect-all once every shop is selected, so a seller can clear and pick a few", () => {
    const onChange = renderControlled(["shop-alias"]);

    fireEvent.click(screen.getByRole("button", { name: "ecommerce.affiliateAnalytics.selectAll" }));
    expect(onChange).toHaveBeenLastCalledWith(["shop-alias", "shop-plain", "shop-bare"]);

    fireEvent.click(screen.getByRole("button", { name: "ecommerce.affiliateAnalytics.deselectAll" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(screen.getByRole("button", { name: "ecommerce.affiliateAnalytics.selectAll" })).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: /Windboss Benessere/ }));
    expect(onChange).toHaveBeenLastCalledWith(["shop-plain"]);
  });

  it("acts only on the shops the search shows", () => {
    const onChange = renderControlled(["shop-bare"]);
    fireEvent.change(screen.getByRole("searchbox", { name: "common.searchShops" }), {
      target: { value: "Windboss" },
    });

    fireEvent.click(screen.getByRole("button", { name: "ecommerce.affiliateAnalytics.selectAll" }));
    expect(onChange).toHaveBeenLastCalledWith(["shop-plain", "shop-bare"]);

    fireEvent.click(screen.getByRole("button", { name: "ecommerce.affiliateAnalytics.deselectAll" }));
    expect(onChange).toHaveBeenLastCalledWith(["shop-bare"]);
  });

  it("disables the bulk button when the search matches nothing", () => {
    renderControlled([]);
    fireEvent.change(screen.getByRole("searchbox", { name: "common.searchShops" }), {
      target: { value: "no such shop" },
    });
    expect(
      (screen.getByRole("button", { name: "ecommerce.affiliateAnalytics.selectAll" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});
