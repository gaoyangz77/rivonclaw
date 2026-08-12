// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProductCard } from "./ProductCard.js";

afterEach(cleanup);

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
});
