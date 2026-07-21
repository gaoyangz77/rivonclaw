import { GQL } from "@rivonclaw/core";
import type { PlatformApp } from "@rivonclaw/core/models";

/**
 * US has dedicated credentials, Mexico supports both seller types, and all
 * remaining non-US local sellers share the global credentials.
 */
export const SHOP_ONBOARDING_MARKETS = [
  GQL.PlatformMarket.Us,
  GQL.PlatformMarket.Mx,
  GQL.PlatformMarket.Row,
] as const;

/**
 * Resolve the credential record for an OAuth market group. TikTok returns the
 * actual shop region during OAuth, so ROW is only a UI grouping value and never
 * becomes the connected shop's stored region.
 */
export function platformAppsForOnboardingMarket<
  T extends Pick<PlatformApp, "market" | "platform" | "sellerType">,
>(platformApps: readonly T[], market: string): T[] {
  const exactMatches = platformApps.filter((app) => app.market === market);
  if (
    exactMatches.length > 0 ||
    market === GQL.PlatformMarket.Us ||
    market === GQL.PlatformMarket.Mx
  ) {
    return exactMatches;
  }

  const sharedTikTokApps = platformApps.filter(
    (app) =>
      app.platform === GQL.PlatformType.TiktokShop &&
      app.market !== GQL.PlatformMarket.Us &&
      app.sellerType === GQL.PlatformSellerType.Local,
  );
  const sharedApp =
    sharedTikTokApps.find((app) => app.market === GQL.PlatformMarket.Gb) ??
    sharedTikTokApps.find((app) => app.market === GQL.PlatformMarket.Row) ??
    sharedTikTokApps[0];

  return sharedApp ? [sharedApp] : [];
}
