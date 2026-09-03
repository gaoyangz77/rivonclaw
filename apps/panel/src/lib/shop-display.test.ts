import { describe, expect, it } from "vitest";
import { shopDisplayLabel } from "./shop-display.js";

describe("shopDisplayLabel", () => {
  it("prefers the alias and never marks it sensitive", () => {
    expect(
      shopDisplayLabel({
        id: "shop-a",
        alias: "Ireland",
        shopName: "Windboss BenessereIE",
        platformShopId: "7490",
      }),
    ).toEqual({ text: "Ireland", sensitive: false });
  });

  it("ignores a whitespace-only alias", () => {
    expect(shopDisplayLabel({ id: "shop-a", alias: "   ", shopName: "Windboss" })).toEqual({
      text: "Windboss",
      sensitive: true,
    });
  });

  it("marks the platform shop name sensitive", () => {
    expect(
      shopDisplayLabel({ id: "shop-a", shopName: " Windboss Benessere ", platformShopId: "7490" }),
    ).toEqual({ text: "Windboss Benessere", sensitive: true });
  });

  it("falls back to the platform shop id, which is not sensitive", () => {
    expect(shopDisplayLabel({ id: "shop-a", platformShopId: "7490" })).toEqual({
      text: "7490",
      sensitive: false,
    });
  });

  it("falls back to the local id, which is not sensitive", () => {
    expect(shopDisplayLabel({ id: "shop-a" })).toEqual({ text: "shop-a", sensitive: false });
  });

  it("falls back to the caller's text when the shop is missing entirely", () => {
    expect(shopDisplayLabel(null, "Unknown shop")).toEqual({
      text: "Unknown shop",
      sensitive: false,
    });
    expect(shopDisplayLabel(undefined)).toEqual({ text: "", sensitive: false });
  });
});
