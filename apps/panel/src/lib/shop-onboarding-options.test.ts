import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  onboardingMarkets,
  onboardingPlatforms,
  onboardingSellerTypes,
  platformAppsForOnboardingSelection,
} from "./shop-onboarding-options.js";

const apps = [
  { id: "us-local", market: "US", platform: "TIKTOK_SHOP", sellerType: "LOCAL" },
  { id: "gb-local", market: "GB", platform: "TIKTOK_SHOP", sellerType: "LOCAL" },
  { id: "nl-local", market: "NL", platform: "TIKTOK_SHOP", sellerType: "LOCAL" },
  { id: "mx-local", market: "MX", platform: "TIKTOK_SHOP", sellerType: "LOCAL" },
  {
    id: "mx-cross-border",
    market: "MX",
    platform: "TIKTOK_SHOP",
    sellerType: "CROSS_BORDER",
  },
  { id: "legacy-row", market: "ROW", platform: "TIKTOK_SHOP", sellerType: "LOCAL" },
];

describe("shop onboarding combinations", () => {
  it("derives concrete platforms and markets from available PlatformApps", () => {
    expect(onboardingPlatforms(apps)).toEqual([GQL.PlatformType.TiktokShop]);
    expect(onboardingMarkets(apps, GQL.PlatformType.TiktokShop)).toEqual([
      GQL.PlatformMarket.Us,
      GQL.PlatformMarket.Gb,
      GQL.PlatformMarket.Nl,
      GQL.PlatformMarket.Mx,
    ]);
  });

  it("derives seller types from the selected platform and market", () => {
    expect(onboardingSellerTypes(apps, "TIKTOK_SHOP", "US")).toEqual(["LOCAL"]);
    expect(onboardingSellerTypes(apps, "TIKTOK_SHOP", "MX")).toEqual([
      "LOCAL",
      "CROSS_BORDER",
    ]);
    expect(onboardingSellerTypes(apps, "TIKTOK_SHOP", "GB")).toEqual(["LOCAL"]);
  });

  it("resolves only the exact three-part selection", () => {
    expect(platformAppsForOnboardingSelection(apps, "TIKTOK_SHOP", "MX", "CROSS_BORDER"))
      .toEqual([apps[4]]);
    expect(platformAppsForOnboardingSelection(apps, "TIKTOK_SHOP", "US", "CROSS_BORDER"))
      .toEqual([]);
    expect(platformAppsForOnboardingSelection(apps, "TIKTOK_SHOP", "ROW", "LOCAL"))
      .toEqual([]);
  });

  it("does not expose legacy ROW routing records as real markets", () => {
    expect(onboardingMarkets([apps[5]], "TIKTOK_SHOP")).toEqual([]);
  });
});
