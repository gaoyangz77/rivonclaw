/**
 * Shop display labels, resolved together with whether the label is sensitive.
 *
 * ~20 call sites inline the chain `alias || shopName || platformShopId || id`.
 * Privacy mode has to mask only one link of that chain: the platform-issued
 * shop name. An alias is chosen by the operator precisely so a shop can be
 * named on a shared screen, and the ids are opaque — neither is sensitive.
 * Resolving the label and its sensitivity in one call keeps that judgement in
 * one place instead of repeating it beside every label.
 */

/**
 * Structural shape, not the MST Shop model: callers pass MST nodes, GraphQL
 * DTOs, or plain fixtures.
 */
export interface ShopDisplayLike {
  id?: string | null;
  alias?: string | null;
  shopName?: string | null;
  platformShopId?: string | null;
}

export interface ShopDisplayLabel {
  /** The text to render. */
  text: string;
  /** Whether `text` must be masked while privacy mode is on. */
  sensitive: boolean;
}

/**
 * Resolve a shop's display label and whether privacy mode must mask it.
 *
 * @param shop     The shop, or null/undefined when the lookup missed.
 * @param fallback Text to use when the shop carries no usable identifier.
 */
export function shopDisplayLabel(
  shop: ShopDisplayLike | null | undefined,
  fallback = "",
): ShopDisplayLabel {
  const alias = shop?.alias?.trim();
  if (alias) return { text: alias, sensitive: false };

  const shopName = shop?.shopName?.trim();
  if (shopName) return { text: shopName, sensitive: true };

  const platformShopId = shop?.platformShopId?.trim();
  if (platformShopId) return { text: platformShopId, sensitive: false };

  const id = shop?.id?.trim();
  if (id) return { text: id, sensitive: false };

  return { text: fallback, sensitive: false };
}
