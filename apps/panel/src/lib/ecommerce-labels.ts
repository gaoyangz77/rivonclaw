export function formatShopRegionLabel(
  region: string | undefined | null,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!region) return "\u2014";
  const normalizedRegion = region.toUpperCase();
  return t(`ecommerce.market.${normalizedRegion}`, { defaultValue: normalizedRegion });
}
