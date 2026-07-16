import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import {
  SHOP_ONBOARDING_MARKETS,
  platformAppsForOnboardingMarket,
} from "./shop-onboarding-markets.js";

const apps = [
  { id: "us-app", market: "US", platform: "TIKTOK_SHOP" },
  { id: "gb-shared-app", market: "GB", platform: "TIKTOK_SHOP" },
  { id: "nl-app", market: "NL", platform: "TIKTOK_SHOP" },
];

describe("shop onboarding markets", () => {
  it("only presents the two OAuth credential groups", () => {
    expect(SHOP_ONBOARDING_MARKETS).toEqual([
      GQL.PlatformMarket.Us,
      GQL.PlatformMarket.Row,
    ]);
  });

  it("uses exact market records when available", () => {
    expect(platformAppsForOnboardingMarket(apps, "NL")).toEqual([apps[2]]);
    expect(platformAppsForOnboardingMarket(apps, "US")).toEqual([apps[0]]);
  });

  it("resolves the other-regions group to the shared non-US TikTok app", () => {
    expect(platformAppsForOnboardingMarket(apps, "ROW")).toEqual([apps[1]]);
  });

  it("never falls back from the US app to non-US credentials", () => {
    expect(platformAppsForOnboardingMarket(apps.slice(1), "US")).toEqual([]);
  });
});
