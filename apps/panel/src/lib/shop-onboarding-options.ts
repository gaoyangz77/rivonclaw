import { GQL } from "@rivonclaw/core";
import type { PlatformApp } from "@rivonclaw/core/models";

type OnboardingPlatformApp = Pick<PlatformApp, "market" | "platform" | "sellerType">;

function uniqueValues(values: readonly string[]): string[] {
  return [...new Set(values)];
}

/**
 * PlatformApps are the source of truth for supported onboarding combinations.
 * ROW was previously a UI routing group; it is not a concrete shop market and
 * must never be submitted as part of an OAuth selection.
 */
function isConcreteMarket(app: OnboardingPlatformApp): boolean {
  return app.market !== GQL.PlatformMarket.Row;
}

export function onboardingPlatforms(platformApps: readonly OnboardingPlatformApp[]): string[] {
  return uniqueValues(
    platformApps
      .filter(isConcreteMarket)
      .map((app) => app.platform),
  );
}

export function onboardingMarkets(
  platformApps: readonly OnboardingPlatformApp[],
  platform: string,
): string[] {
  if (!platform) return [];
  return uniqueValues(
    platformApps
      .filter((app) => isConcreteMarket(app) && app.platform === platform)
      .map((app) => app.market),
  );
}

export function onboardingSellerTypes(
  platformApps: readonly OnboardingPlatformApp[],
  platform: string,
  market: string,
): string[] {
  if (!platform || !market) return [];
  return uniqueValues(
    platformApps
      .filter((app) => app.platform === platform && app.market === market)
      .map((app) => app.sellerType),
  ).sort((left, right) => {
    if (left === GQL.PlatformSellerType.Local) return -1;
    if (right === GQL.PlatformSellerType.Local) return 1;
    return left.localeCompare(right);
  });
}

/** Resolve only an exact platform + market + seller type combination. */
export function platformAppsForOnboardingSelection<T extends OnboardingPlatformApp>(
  platformApps: readonly T[],
  platform: string,
  market: string,
  sellerType: string,
): T[] {
  if (!platform || !market || !sellerType || market === GQL.PlatformMarket.Row) return [];
  return platformApps.filter(
    (app) =>
      app.platform === platform &&
      app.market === market &&
      app.sellerType === sellerType,
  );
}
