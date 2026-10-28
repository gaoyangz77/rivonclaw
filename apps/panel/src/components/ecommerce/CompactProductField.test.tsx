import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { applySnapshot } from "mobx-state-tree";
import { runtimeStatusStore } from "../../store/runtime-status-store.js";
import { CompactProductField } from "./CompactProductField.js";

vi.mock("../images/RemoteMediaImage.js", () => ({
  RemoteMediaImage: ({ sourceUrl, sensitive }: { sourceUrl: string; sensitive: boolean }) => (
    <img src={sourceUrl} alt="" data-sensitive={String(sensitive)} />
  ),
}));

afterEach(() => {
  cleanup();
  applySnapshot(runtimeStatusStore.appSettings, { privacyMode: false });
});

it("prioritizes distinct seller SKUs, with a secondary full-name tooltip and private image", () => {
  const title = "HolyLegend 14K Real Gold-Plated Long Product Name";
  const { container } = render(
    <CompactProductField
      title={title}
      imageUrl="https://example.com/product.jpg"
      skus={[" SELLER-1 ", "SELLER-1", null, "", "SELLER-2"]}
      skuLabel="SKU"
    />,
  );
  expect(container.querySelector(".commerce-compact-product-field-primary")?.textContent).toBe(
    "SKUSELLER-1+1",
  );
  expect(screen.getByText("SELLER-1").getAttribute("title")).toBe("SELLER-1 · SELLER-2");
  expect(screen.getByText(title).getAttribute("title")).toBe(title);
  expect(container.querySelector("img")?.getAttribute("data-sensitive")).toBe("true");
});

it("keeps product name and SKU tooltips masked in privacy mode", () => {
  render(<CompactProductField title="Private product" skus={["SECRET-SKU"]} skuLabel="SKU" />);
  act(() => applySnapshot(runtimeStatusStore.appSettings, { privacyMode: true }));
  for (const text of ["Private product", "SECRET-SKU"]) {
    expect(screen.getByText(text).getAttribute("title")).toBeNull();
    expect(screen.getByText(text).getAttribute("data-tk-private")).toBe("text");
  }
});

it("keeps a SKU-only product identifiable without inventing a title", () => {
  const { container } = render(
    <CompactProductField skus={["SELLER-ONLY"]} skuLabel="SKU" productId="product-1" />,
  );
  expect(screen.getByText("SELLER-ONLY")).toBeTruthy();
  expect(container.querySelector(".commerce-compact-product-field-name")).toBeNull();
  expect(container.querySelector(".commerce-compact-product-field-media svg")).toBeTruthy();
});

it("falls back to name and product ID when seller SKUs are unavailable", () => {
  render(
    <CompactProductField
      title="Product without SKU"
      skus={[null, " "]}
      skuLabel="SKU"
      productId="product-1"
      productIdLabel="ID"
    />,
  );
  expect(screen.getByText("Product without SKU")).toBeTruthy();
  expect(screen.getByText("ID · product-1").getAttribute("title")).toBe("product-1");
  expect(screen.queryByText("SKU")).toBeNull();
});

it("shows the caller's empty label when all catalog facts are missing", () => {
  render(<CompactProductField skuLabel="SKU" emptyTitle="Unknown product" />);
  expect(screen.getByText("Unknown product")).toBeTruthy();
});
