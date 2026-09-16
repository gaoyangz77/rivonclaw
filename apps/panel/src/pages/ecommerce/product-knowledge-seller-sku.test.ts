import { describe, expect, it } from "vitest";
import { splitSellerSkuInput } from "./product-knowledge-seller-sku.js";

describe("splitSellerSkuInput", () => {
  it("splits on ASCII and full-width commas and trims each entry", () => {
    expect(splitSellerSkuInput("A1, B-2，C3")).toEqual(["A1", "B-2", "C3"]);
  });

  it("keeps a single Seller SKU working exactly as before", () => {
    expect(splitSellerSkuInput("  SELLER-1  ")).toEqual(["SELLER-1"]);
  });

  it("drops empty entries from trailing or doubled separators", () => {
    expect(splitSellerSkuInput("A1,,B-2, ，")).toEqual(["A1", "B-2"]);
  });

  it("removes duplicates while preserving input order", () => {
    expect(splitSellerSkuInput("C3, A1, C3 , A1")).toEqual(["C3", "A1"]);
  });

  it("preserves case because platform Seller SKUs are case-sensitive", () => {
    expect(splitSellerSkuInput("Seller-1, SELLER-1")).toEqual(["Seller-1", "SELLER-1"]);
  });

  it("returns an empty list for blank input", () => {
    expect(splitSellerSkuInput("   ,  ，  ")).toEqual([]);
  });
});
