import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  SHOP_ONBOARDING_MARKETS,
  platformAppsForOnboardingMarket,
} from "./shop-onboarding-markets.js";

const apps = [
  { id: "us-app", market: "US", platform: "TIKTOK_SHOP", sellerType: "LOCAL" },
  { id: "gb-shared-app", market: "GB", platform: "TIKTOK_SHOP", sellerType: "LOCAL" },
  { id: "nl-app", market: "NL", platform: "TIKTOK_SHOP", sellerType: "LOCAL" },
  { id: "mx-local-app", market: "MX", platform: "TIKTOK_SHOP", sellerType: "LOCAL" },
  {
    id: "mx-cross-border-app",
    market: "MX",
    platform: "TIKTOK_SHOP",
    sellerType: "CROSS_BORDER",
  },
];

describe("shop onboarding markets", () => {
  it("presents dedicated US and Mexico choices plus the other-regions group", () => {
    expect(SHOP_ONBOARDING_MARKETS).toEqual([
      GQL.PlatformMarket.Us,
      GQL.PlatformMarket.Mx,
      GQL.PlatformMarket.Row,
    ]);
  });

  it("uses exact market records when available", () => {
    expect(platformAppsForOnboardingMarket(apps, "NL")).toEqual([apps[2]]);
    expect(platformAppsForOnboardingMarket(apps, "US")).toEqual([apps[0]]);
    expect(platformAppsForOnboardingMarket(apps, "MX")).toEqual([apps[3], apps[4]]);
  });

  it("resolves the other-regions group to the shared non-US TikTok app", () => {
    expect(platformAppsForOnboardingMarket(apps, "ROW")).toEqual([apps[1]]);
  });

  it("never falls back from the US app to non-US credentials", () => {
    expect(platformAppsForOnboardingMarket(apps.slice(1), "US")).toEqual([]);
  });
});
