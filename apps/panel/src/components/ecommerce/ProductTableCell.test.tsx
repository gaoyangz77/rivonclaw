// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { applySnapshot } from "mobx-state-tree";
import { runtimeStatusStore } from "../../store/runtime-status-store.js";
import { ProductTableCell } from "./ProductTableCell.js";

afterEach(() => {
  cleanup();
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: false });
});

describe("ProductTableCell", () => {
  it("shows a 48px media slot, full title tooltip, and compact seller SKU count", () => {
    render(
      <ProductTableCell
        title="A long product name"
        skus={["SELLER-A", "SELLER-B"]}
        skuLabel="SKU"
        productId="product-1"
      />,
    );
    expect(document.querySelector(".commerce-product-table-cell-media")).not.toBeNull();
    expect(screen.getByText("A long product name").getAttribute("title")).toBe("A long product name");
    expect(screen.getByText("SELLER-A").getAttribute("title")).toBe("SELLER-A · SELLER-B");
    expect(screen.getByText("+1")).not.toBeNull();
  });

  it("keeps seller-authored text and tooltips private", () => {
    render(<ProductTableCell title="Secret product" skus={["SECRET-SKU"]} skuLabel="SKU" />);
    act(() => applySnapshot(runtimeStatusStore.appSettings, { privacyMode: true }));
    expect(screen.getByText("Secret product").getAttribute("title")).toBeNull();
    expect(screen.getByText("SECRET-SKU").getAttribute("title")).toBeNull();
  });
});
