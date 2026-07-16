import { GQL } from "@rivonclaw/core";
import type { PlatformApp } from "@rivonclaw/core/models";

/** OAuth credentials only differ between the US app and the shared non-US app. */
export const SHOP_ONBOARDING_MARKETS = [
  GQL.PlatformMarket.Us,
  GQL.PlatformMarket.Row,
] as const;

/**
 * Resolve the credential record for an OAuth market group. TikTok returns the
 * actual shop region during OAuth, so ROW is only a UI grouping value and never
 * becomes the connected shop's stored region.
 */
export function platformAppsForOnboardingMarket<
  T extends Pick<PlatformApp, "market" | "platform">,
>(platformApps: readonly T[], market: string): T[] {
  const exactMatches = platformApps.filter((app) => app.market === market);
  if (exactMatches.length > 0 || market === GQL.PlatformMarket.Us) {
    return exactMatches;
  }

  const sharedTikTokApps = platformApps.filter(
    (app) =>
      app.platform === GQL.PlatformType.TiktokShop &&
      app.market !== GQL.PlatformMarket.Us,
  );
  const sharedApp =
    sharedTikTokApps.find((app) => app.market === GQL.PlatformMarket.Gb) ??
    sharedTikTokApps.find((app) => app.market === GQL.PlatformMarket.Row) ??
    sharedTikTokApps[0];

  return sharedApp ? [sharedApp] : [];
}
