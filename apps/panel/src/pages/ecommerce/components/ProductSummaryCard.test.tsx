import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import type { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { ProductSummaryCard } from "./ProductSummaryCard.js";

/**
 * A seller reviewing a sample application needs to see which variant the
 * Creator asked for — not just the product. These tests pin the three states
 * that matter: the SKU is in the loaded catalog, it is not (the summary keeps
 * only the first 12), and the request named no SKU at all.
 */

const SKU_IMAGE_URL = "https://p16-oec.tiktokcdn.com/applied-sku.jpeg";
const COVER_IMAGE_URL = "https://p16-oec.tiktokcdn.com/product-cover.jpeg";

function productSummary(
  skus: Array<{ skuId: string; skuName?: string | null; sellerSku?: string | null }>,
): GQL.EcomProductSummary {
  return {
    productId: "1729000000000000001",
    title: "Freshwater pearl necklace",
    coverImage: COVER_IMAGE_URL,
    status: "ACTIVATE",
    priceMin: null,
    priceMax: null,
    skus: skus.map((sku) => ({
      skuId: sku.skuId,
      skuName: sku.skuName ?? null,
      sellerSku: sku.sellerSku ?? null,
      price: null,
      currency: null,
    })),
  } as GQL.EcomProductSummary;
}

function renderCard(props: Partial<Parameters<typeof ProductSummaryCard>[0]>) {
  return render(
    <MockedProvider mocks={[]}>
      <ProductSummaryCard
        product={productSummary([])}
        productId="1729000000000000001"
        shopId="shop-1"
        allowInlineLoad={false}
        {...props}
      />
    </MockedProvider>,
  );
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

describe("applied SKU on the product summary card", () => {
  it("shows the variant name and the seller's own code when the SKU is in the loaded catalog", () => {
    renderCard({
      product: productSummary([
        { skuId: "sku-other", sellerSku: "NECK-8MM-18IN" },
        { skuId: "sku-applied", sellerSku: "NECK-8MM-26IN" },
      ]),
      appliedForSku: {
        skuId: "sku-applied",
        skuName: "8 mm, 26 inches",
        skuImageUrl: SKU_IMAGE_URL,
      },
    });

    expect(screen.getByText("Applied SKU")).toBeTruthy();
    expect(screen.getByText("8 mm, 26 inches")).toBeTruthy();
    expect(screen.getByText("NECK-8MM-26IN")).toBeTruthy();
    // The seller code of a different variant must never stand in for it.
    expect(screen.queryByText("NECK-8MM-18IN")).toBeNull();
  });

  it("still names the variant when the applied SKU is outside the 12-SKU catalog slice", () => {
    renderCard({
      // The summary carries only the first 12 SKUs, so the applied one can be
      // legitimately absent — a wrong seller code would be worse than none.
      product: productSummary([{ skuId: "sku-other", sellerSku: "NECK-8MM-18IN" }]),
      appliedForSku: { skuId: "sku-applied", skuName: "8 mm, 26 inches", skuImageUrl: null },
    });

    expect(screen.getByText("8 mm, 26 inches")).toBeTruthy();
    expect(screen.queryByText("Seller SKU")).toBeNull();
    expect(screen.queryByText("NECK-8MM-18IN")).toBeNull();
  });

  it("renders no applied-SKU row when the request named no SKU", () => {
    const { container } = renderCard({
      product: productSummary([{ skuId: "sku-applied", sellerSku: "NECK-8MM-26IN" }]),
    });

    expect(container.querySelector(".affiliate-product-applied-sku")).toBeNull();
    expect(screen.queryByText("Applied SKU")).toBeNull();
  });

  it("renders no applied-SKU row when only an opaque SKU id is known", () => {
    const { container } = renderCard({
      appliedForSku: { skuId: "sku-applied", skuName: null, skuImageUrl: null },
    });

    expect(container.querySelector(".affiliate-product-applied-sku")).toBeNull();
  });

  it("shows one image for one product: the cover, never a second SKU picture", () => {
    // The variant's own picture is a near-duplicate of the cover beside it, and
    // two pictures of one product read as two products.
    const { container } = renderCard({
      product: productSummary([{ skuId: "sku-applied", sellerSku: "NECK-8MM-26IN" }]),
      appliedForSku: {
        skuId: "sku-applied",
        skuName: "8 mm, 26 inches",
        skuImageUrl: SKU_IMAGE_URL,
      },
    });

    expect(container.querySelector(".affiliate-product-thumb")).toBeTruthy();
    expect(container.querySelector(".affiliate-product-applied-sku-thumb")).toBeNull();
    const painted = [...container.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(painted).not.toContain(SKU_IMAGE_URL);
  });

  it("sits inside the product body, not in a panel of its own", () => {
    // The SKU describes the product the card already shows, so it belongs in
    // that product's own meta stack rather than boxed away from its name.
    const { container } = renderCard({
      product: productSummary([{ skuId: "sku-applied", sellerSku: "NECK-8MM-26IN" }]),
      appliedForSku: { skuId: "sku-applied", skuName: "8 mm, 26 inches", skuImageUrl: null },
    });

    const row = container.querySelector(".affiliate-product-applied-sku");
    expect(row?.closest(".affiliate-product-body")).toBeTruthy();
  });
});
