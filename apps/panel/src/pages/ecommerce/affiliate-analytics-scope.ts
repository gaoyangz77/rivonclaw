/**
 * Shop scope shared by the Overview and Explore tabs.
 *
 * `AffiliateAnalyticsShop` is a plain primitive DTO, never an MST node: the
 * entitlement-filtered shop list is projected out of the entity store during
 * render and must not be captured in React state, refs or async closures
 * (`.claude/rules/mst-react-state.md`).
 */

export interface AffiliateAnalyticsShop {
  id: string;
  shopName?: string | null;
  alias?: string | null;
  region?: string | null;
}

/**
 * Keeps a shop selection valid against the currently authorized shops. Returns
 * the same array reference when nothing changed so callers can skip a setState.
 */
export function reconcileShopSelection(current: string[], shops: readonly AffiliateAnalyticsShop[]): string[] {
  const allowed = new Set(shops.map((shop) => shop.id));
  const kept = current.filter((id) => allowed.has(id));
  if (kept.length === current.length) return current;
  return kept.length ? kept : shops.map((shop) => shop.id);
}
