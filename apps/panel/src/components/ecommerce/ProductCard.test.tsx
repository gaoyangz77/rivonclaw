// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { applySnapshot } from "mobx-state-tree";
import { runtimeStatusStore } from "../../store/runtime-status-store.js";
import { ProductCard } from "./ProductCard.js";

function setPrivacyMode(enabled: boolean) {
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: enabled });
}

afterEach(() => {
  cleanup();
  setPrivacyMode(false);
});

describe("ProductCard", () => {
  it("prioritizes concise product, shop, and Seller SKU information", () => {
    const onChange = vi.fn();
    render(
      <ProductCard
        title="A deliberately long product title"
        shopAlias="US hero shop"
        shopName="Official Store Name"
        sellerSkus={["SKU-ONE", "SKU-TWO", "SKU-THREE"]}
        aliasLabel="Shop alias"
        sellerSkuLabel="Seller SKU"
        selection={{ checked: false, label: "Select product", onChange }}
      />,
    );

    expect(screen.getByText("A deliberately long product title")).toBeTruthy();
    expect(screen.getByText("US hero shop")).toBeTruthy();
    expect(screen.getByText("Official Store Name")).toBeTruthy();
    expect(screen.getByText("SKU-ONE")).toBeTruthy();
    expect(screen.getByText("SKU-TWO")).toBeTruthy();
    expect(screen.queryByText("SKU-THREE")).toBeNull();
    expect(screen.getByText("+1")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select product" }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("masks the product title, product image, and platform shop name", () => {
    setPrivacyMode(true);
    render(
      <ProductCard
        title="Merino wool base layer"
        imageUrl="https://cdn.example.test/cover.jpg"
        shopAlias="US hero shop"
        shopName="Official Store Name"
        sellerSkus={["SKU-ONE"]}
        aliasLabel="Shop alias"
        sellerSkuLabel="Seller SKU"
      />,
    );

    const title = screen.getByText("Merino wool base layer");
    expect(title.tagName).toBe("STRONG");
    expect(title.getAttribute("data-tk-private")).toBe("text");
    // A blurred title whose tooltip still spells it out is not masked at all.
    expect(title.getAttribute("title")).toBeNull();

    const shopName = screen.getByText("Official Store Name");
    expect(shopName.tagName).toBe("SMALL");
    expect(shopName.getAttribute("data-tk-private")).toBe("text");

    // The alias is the operator's own label, so it stays readable on a shared
    // screen — that is the whole point of setting one.
    const alias = screen.getByText("US hero shop");
    expect(alias.hasAttribute("data-tk-private")).toBe(false);
    expect(alias.getAttribute("title")).toBe("Shop alias: US hero shop");

    // The cover is never fetched while masked: no request, nothing painted.
    const image = document.querySelector<HTMLImageElement>(".commerce-product-card-image");
    expect(image?.getAttribute("data-tk-private")).toBe("media");
    expect(image?.getAttribute("src")?.startsWith("data:image/gif")).toBe(true);
    expect(image?.getAttribute("alt")).toBe("");
  });

  it("masks the Seller SKU codes and drops the tooltip that spelled them out", () => {
    setPrivacyMode(true);
    render(
      <ProductCard
        title="Merino wool base layer"
        shopName="Official Store Name"
        sellerSkus={["SKU-ONE", "SKU-TWO", "SKU-THREE"]}
        aliasLabel="Shop alias"
        sellerSkuLabel="Seller SKU"
      />,
    );

    // The codes share one marked wrapper, so the tooltip listing every SKU is
    // suppressed with them rather than sitting on an unmasked ancestor.
    const codes = screen.getByText("SKU-ONE").parentElement;
    expect(codes?.getAttribute("data-tk-private")).toBe("text");
    expect(codes?.getAttribute("title")).toBeNull();

    // The "Seller SKU" label is the operator's own bearing, not seller data.
    const label = screen.getByText("Seller SKU");
    expect(label.hasAttribute("data-tk-private")).toBe(false);
  });

  it("keeps the Seller SKU tooltip while privacy mode is off, and marks nothing without SKUs", () => {
    const { unmount } = render(
      <ProductCard
        title="Merino wool base layer"
        shopName="Official Store Name"
        sellerSkus={["SKU-ONE", "SKU-TWO"]}
        aliasLabel="Shop alias"
        sellerSkuLabel="Seller SKU"
      />,
    );

    expect(screen.getByText("SKU-ONE").parentElement?.getAttribute("title")).toBe(
      "SKU-ONE · SKU-TWO",
    );
    unmount();

    // Nothing sensitive is on screen when the product has no SKU at all.
    render(
      <ProductCard
        title="Merino wool base layer"
        shopName="Official Store Name"
        sellerSkus={[]}
        aliasLabel="Shop alias"
        sellerSkuLabel="Seller SKU"
      />,
    );

    expect(screen.getByText("—").parentElement?.hasAttribute("data-tk-private")).toBe(false);
  });

  it("keeps the title and its tooltip readable while privacy mode is off", () => {
    render(
      <ProductCard
        title="Merino wool base layer"
        shopName="Official Store Name"
        sellerSkus={["SKU-ONE"]}
        aliasLabel="Shop alias"
        sellerSkuLabel="Seller SKU"
      />,
    );

    expect(screen.getByText("Merino wool base layer").getAttribute("title")).toBe(
      "Merino wool base layer",
    );

    act(() => setPrivacyMode(true));

    expect(screen.getByText("Merino wool base layer").getAttribute("title")).toBeNull();
  });
});
