/**
 * Normalize a backend ShopPlatform enum value (e.g., "TIKTOK_SHOP") into a
 * short lowercase name suitable for session keys (e.g., "tiktok").
 */
export function normalizePlatform(raw: string): string {
  return raw.replace(/_(?:SHOP|STORE)$/i, "").toLowerCase();
}

/**
 * Creator-facing names for the platforms the Affiliate workflow can name in a
 * message to a Creator.
 *
 * Keyed by the normalized token so this map and `normalizePlatform` cannot drift
 * apart: adding a platform means adding it here or the name goes absent, which
 * is the honest outcome — never a wrong one.
 */
const CREATOR_FACING_PLATFORM_NAMES: Readonly<Record<string, string>> = {
  tiktok: "TikTok Shop",
};

/**
 * The platform as the Creator knows it, or null when we have no name for it.
 *
 * The internal token is lossy and lowercase (`tiktok`), so it must never be
 * shown to a Creator. A run that has to say where an earlier conversation
 * happened needs the real name; before this existed a live run simply omitted
 * the platform rather than translate the token itself, leaving its first
 * WhatsApp message with no way for the Creator to place it.
 *
 * Returns null rather than guessing for an unmapped platform: the workflow rule
 * requires writing around an unavailable element, and a plausible-looking wrong
 * platform name in a Creator-facing message is worse than its absence.
 */
export function creatorFacingPlatformName(platform: string): string | null {
  return CREATOR_FACING_PLATFORM_NAMES[normalizePlatform(platform)] ?? null;
}
