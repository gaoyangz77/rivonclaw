/**
 * Normalize a backend ShopPlatform enum value (e.g., "TIKTOK_SHOP") into a
 * short lowercase name suitable for session keys (e.g., "tiktok").
 */
export function normalizePlatform(raw: string): string {
  return raw.replace(/_(?:SHOP|STORE)$/i, "").toLowerCase();
}
