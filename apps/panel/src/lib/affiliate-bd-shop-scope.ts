/**
 * A business developer's shop access scope (ADR-110): pure rules shared by the
 * BD editor, the BD summaries, and the Creator owner dropdown.
 *
 * The scope has two grants. `regions` is DYNAMIC: every shop of the account in
 * that region, including shops connected later. `shopIds` is STATIC: exactly
 * those shops. Both empty means unrestricted. Ticking every current shop of a
 * region is therefore NOT the same as granting the region, and nothing here
 * ever converts one into the other silently.
 *
 * Everything works on plain strings; callers hand in ids and regions read from
 * the entity store, never MST nodes.
 */
import { GQL } from "@rivonclaw/core";
import { graphQLErrorCode } from "./graphql-error-code.js";

export const SHOP_REGIONS: GQL.ShopRegion[] = Object.values(GQL.ShopRegion);

const GRANTABLE_REGIONS: ReadonlySet<string> = new Set(SHOP_REGIONS);

/** Whether a shop region value can be granted as a whole region. */
export function isGrantableShopRegion(region: string | null | undefined): region is GQL.ShopRegion {
  return region != null && GRANTABLE_REGIONS.has(region);
}

export interface BusinessDeveloperShopScope {
  regions: readonly string[];
  shopIds: readonly string[];
}

/** The shop facts the scope rules need. */
export interface ScopeShop {
  id: string;
  region: string | null;
}

/** Both grants empty: the developer may serve every shop, present and future. */
export function isUnrestrictedShopScope(scope: BusinessDeveloperShopScope): boolean {
  return scope.regions.length === 0 && scope.shopIds.length === 0;
}

/** Whether the scope covers one shop: its region is granted, or it is granted itself. */
export function shopScopeCoversShop(scope: BusinessDeveloperShopScope, shop: ScopeShop): boolean {
  if (isUnrestrictedShopScope(scope)) return true;
  if (scope.shopIds.includes(shop.id)) return true;
  return shop.region != null && scope.regions.includes(shop.region);
}

/**
 * Whether a developer may own a Creator relationship that spans `shopIds`
 * (ADR-110): unrestricted, or the scope covers at least ONE of those shops. A
 * relationship without shops can only be owned by an unrestricted developer.
 *
 * `regionByShopId` is the account's shop-to-region lookup. A shop missing from
 * it still counts when it is granted by id; it can never be covered by region.
 */
export function shopScopeCoversAnyShop(
  scope: BusinessDeveloperShopScope,
  shopIds: readonly string[],
  regionByShopId: ReadonlyMap<string, string | null>,
): boolean {
  if (isUnrestrictedShopScope(scope)) return true;
  return shopIds.some((shopId) =>
    shopScopeCoversShop(scope, { id: shopId, region: regionByShopId.get(shopId) ?? null }),
  );
}

/**
 * The developers a Creator's owner dropdown may offer (ADR-110): active ones
 * whose shop access covers at least one of the Creator's shops. The current
 * owner is kept even when out of scope — the select must still show it — and
 * is flagged `covered: false` so the caller can mark it.
 */
export function ownerAssignmentCandidates<
  T extends BusinessDeveloperShopScope & { id: string; archivedAt?: string | null },
>(
  developers: readonly T[],
  creatorShopIds: readonly string[],
  regionByShopId: ReadonlyMap<string, string | null>,
  currentOwnerId: string,
): Array<{ developer: T; covered: boolean }> {
  return developers.flatMap((developer) => {
    if (developer.archivedAt) return [];
    const covered = shopScopeCoversAnyShop(developer, creatorShopIds, regionByShopId);
    return covered || developer.id === currentOwnerId ? [{ developer, covered }] : [];
  });
}

// ─────────────────────────── editor draft ───────────────────────────

/** "ALL" is the explicit unrestricted choice; "SPECIFIC" requires a selection. */
export type ShopScopeMode = "ALL" | "SPECIFIC";

/** The scope as the editor holds it. Primitives only. */
export interface BusinessDeveloperShopScopeDraft {
  shopScopeMode: ShopScopeMode;
  regions: GQL.ShopRegion[];
  shopIds: string[];
}

export function shopScopeDraftFrom(
  scope: BusinessDeveloperShopScope,
  /**
   * Shops that exist and can be picked. Granted ids outside this set belong to
   * shops that were deleted; dropping them keeps a save from sending ids the
   * backend rejects. The mode is read BEFORE pruning, so a scope that only
   * held deleted shops stays "SPECIFIC" and blocks save instead of silently
   * turning unrestricted.
   */
  knownShopIds?: ReadonlySet<string>,
): BusinessDeveloperShopScopeDraft {
  return {
    shopScopeMode: isUnrestrictedShopScope(scope) ? "ALL" : "SPECIFIC",
    regions: [...scope.regions] as GQL.ShopRegion[],
    shopIds: knownShopIds
      ? scope.shopIds.filter((shopId) => knownShopIds.has(shopId))
      : [...scope.shopIds],
  };
}

/** What a save sends: "ALL" always clears both grants, whatever the draft still holds. */
export function shopScopeOfDraft(draft: BusinessDeveloperShopScopeDraft): {
  regions: GQL.ShopRegion[];
  shopIds: string[];
} {
  return draft.shopScopeMode === "ALL"
    ? { regions: [], shopIds: [] }
    : { regions: draft.regions, shopIds: draft.shopIds };
}

/** "SPECIFIC" with nothing selected would mean unrestricted, so it may not be saved. */
export function isShopScopeDraftSaveable(draft: BusinessDeveloperShopScopeDraft): boolean {
  return (
    draft.shopScopeMode === "ALL" || draft.regions.length > 0 || draft.shopIds.length > 0
  );
}

function sortedKey(values: readonly string[]): string {
  return [...values].sort().join("|");
}

/**
 * Whether the draft differs from the stored scope. A source that is itself an
 * earlier draft carries its own mode (a "specific" draft can legitimately be
 * empty after deleted shops were pruned); a backend scope derives it.
 */
export function isShopScopeDraftChanged(
  draft: BusinessDeveloperShopScopeDraft,
  source: BusinessDeveloperShopScope & { shopScopeMode?: ShopScopeMode },
): boolean {
  const saved = source.shopScopeMode
    ? { ...shopScopeDraftFrom(source), shopScopeMode: source.shopScopeMode }
    : shopScopeDraftFrom(source);
  if (draft.shopScopeMode !== saved.shopScopeMode) return true;
  if (draft.shopScopeMode === "ALL") return false;
  return (
    sortedKey(draft.regions) !== sortedKey(saved.regions) ||
    sortedKey(draft.shopIds) !== sortedKey(saved.shopIds)
  );
}

export function withShopScopeMode(
  draft: BusinessDeveloperShopScopeDraft,
  shopScopeMode: ShopScopeMode,
): BusinessDeveloperShopScopeDraft {
  return { ...draft, shopScopeMode };
}

/**
 * Tick or untick a whole region. Ticking drops that region's individually
 * ticked shops: the region grant already includes them, and keeping both would
 * leave stale ids behind when the region is unticked later.
 */
export function toggleShopScopeRegion(
  draft: BusinessDeveloperShopScopeDraft,
  region: GQL.ShopRegion,
  granted: boolean,
  regionShopIds: readonly string[],
): BusinessDeveloperShopScopeDraft {
  if (!granted) {
    return { ...draft, regions: draft.regions.filter((item) => item !== region) };
  }
  const dropped = new Set(regionShopIds);
  return {
    ...draft,
    regions: draft.regions.includes(region) ? draft.regions : [...draft.regions, region],
    shopIds: draft.shopIds.filter((shopId) => !dropped.has(shopId)),
  };
}

export function toggleShopScopeShop(
  draft: BusinessDeveloperShopScopeDraft,
  shopId: string,
  granted: boolean,
): BusinessDeveloperShopScopeDraft {
  if (!granted) return { ...draft, shopIds: draft.shopIds.filter((item) => item !== shopId) };
  return {
    ...draft,
    shopIds: draft.shopIds.includes(shopId) ? draft.shopIds : [...draft.shopIds, shopId],
  };
}

/**
 * "Select every region": whole-region grants for every region that has shops,
 * so shops connected later stay included. Shops of a region that cannot be
 * granted whole (no region on record) are ticked individually so the choice
 * still covers everything that exists today. Regions without shops keep
 * whatever the draft already holds.
 */
export function grantEveryShopScopeRegion(
  draft: BusinessDeveloperShopScopeDraft,
  shops: readonly ScopeShop[],
): BusinessDeveloperShopScopeDraft {
  const grantedRegions = new Set<GQL.ShopRegion>(draft.regions);
  const individualShopIds = new Set<string>();
  for (const shop of shops) {
    if (isGrantableShopRegion(shop.region)) grantedRegions.add(shop.region);
    else individualShopIds.add(shop.id);
  }
  const coveredByRegion = new Set(
    shops.filter((shop) => isGrantableShopRegion(shop.region)).map((shop) => shop.id),
  );
  return {
    ...draft,
    regions: SHOP_REGIONS.filter((region) => grantedRegions.has(region)),
    shopIds: [
      ...draft.shopIds.filter((shopId) => !coveredByRegion.has(shopId)),
      ...[...individualShopIds].filter((shopId) => !draft.shopIds.includes(shopId)),
    ],
  };
}

export function clearShopScopeSelection(
  draft: BusinessDeveloperShopScopeDraft,
): BusinessDeveloperShopScopeDraft {
  return { ...draft, regions: [], shopIds: [] };
}

export interface ShopScopeRegionGroup {
  /** `null` for shops with no region on record. */
  region: string | null;
  shopIds: string[];
}

/** Shops grouped by region, regions in code order and the region-less group last. */
export function groupShopIdsByRegion(shops: readonly ScopeShop[]): ShopScopeRegionGroup[] {
  const groups = new Map<string | null, string[]>();
  for (const shop of shops) {
    const region = shop.region || null;
    groups.set(region, [...(groups.get(region) ?? []), shop.id]);
  }
  return [...groups.entries()]
    .map(([region, shopIds]) => ({ region, shopIds }))
    .sort((left, right) => {
      if (left.region === right.region) return 0;
      if (left.region === null) return 1;
      if (right.region === null) return -1;
      return left.region.localeCompare(right.region);
    });
}

export interface ShopScopeRegionState {
  /** The region itself is granted: its shops, now and later, are included. */
  wholeRegion: boolean;
  selectedShopCount: number;
  /** Some shops ticked individually while the region itself is not granted. */
  indeterminate: boolean;
  /**
   * Every current shop is ticked individually while the region is not granted.
   * Shops connected later would NOT be included, which the editor must say.
   */
  everyCurrentShopTickedWithoutRegion: boolean;
}

export function shopScopeRegionState(
  draft: BusinessDeveloperShopScopeDraft,
  region: string | null,
  regionShopIds: readonly string[],
): ShopScopeRegionState {
  const wholeRegion = region != null && (draft.regions as string[]).includes(region);
  const selectedShopCount = regionShopIds.filter((shopId) => draft.shopIds.includes(shopId)).length;
  const allTicked = regionShopIds.length > 0 && selectedShopCount === regionShopIds.length;
  return {
    wholeRegion,
    selectedShopCount,
    indeterminate: !wholeRegion && selectedShopCount > 0,
    everyCurrentShopTickedWithoutRegion:
      !wholeRegion && isGrantableShopRegion(region) && allTicked,
  };
}

// ─────────────────────────── shop candidates ───────────────────────────

/** A shop a scope can grant, as the editor and the summaries show it. */
export interface ScopeShopDisplay extends ScopeShop {
  alias: string | null;
  shopName: string | null;
  platformShopId: string | null;
}

interface ScopeShopSource {
  id: string;
  platform: string;
  region?: string | null;
  alias?: string | null;
  shopName?: string | null;
  platformShopId?: string | null;
}

/**
 * The shops a business developer can be granted: every TikTok shop of the
 * account whatever its authorization status — an expired shop still has
 * Creators. Plain objects, so callers can read it during render without
 * holding MST nodes.
 */
export function scopeShopsFrom(shops: readonly ScopeShopSource[]): ScopeShopDisplay[] {
  return shops
    .filter((shop) => shop.platform === GQL.ShopPlatform.TiktokShop)
    .map((shop) => ({
      id: shop.id,
      region: shop.region || null,
      alias: shop.alias ?? null,
      shopName: shop.shopName ?? null,
      platformShopId: shop.platformShopId ?? null,
    }));
}

// ─────────────────────────── summary ───────────────────────────

export interface ShopScopeSummary {
  /** Granted regions, in code order. Their shops are not listed again. */
  wholeRegions: string[];
  /** Individually granted shops outside every granted region, grouped by region. */
  shopGroups: Array<{ region: string | null; shops: ScopeShopDisplay[] }>;
  /** Granted shop ids that no longer match any shop. */
  missingShopCount: number;
}

/** What a restricted scope covers, in the shape the list and detail summaries render. */
export function summarizeShopScope(
  scope: BusinessDeveloperShopScope,
  shops: readonly ScopeShopDisplay[],
): ShopScopeSummary {
  const shopById = new Map(shops.map((shop) => [shop.id, shop]));
  const grantedRegions = new Set(scope.regions);
  const known = scope.shopIds.flatMap((shopId) => {
    const shop = shopById.get(shopId);
    return shop ? [shop] : [];
  });
  const outsideGrantedRegions = known.filter(
    (shop) => shop.region == null || !grantedRegions.has(shop.region),
  );
  const shopGroups = groupShopIdsByRegion(outsideGrantedRegions).map((group) => ({
    region: group.region,
    shops: group.shopIds.map((shopId) => shopById.get(shopId)!),
  }));
  return {
    wholeRegions: [...scope.regions].sort((left, right) => left.localeCompare(right)),
    shopGroups,
    missingShopCount: scope.shopIds.length - known.length,
  };
}

// ─────────────────────────── backend refusals ───────────────────────────

/** Translation keys (under `ecommerce.affiliateTeam`) for the scope refusals the backend raises. */
const SHOP_SCOPE_ERROR_KEYS: Record<string, string> = {
  /** A granted shop id is unknown or belongs to another account. */
  AFFILIATE_BUSINESS_DEVELOPER_SHOP_NOT_FOUND: "ecommerce.affiliateTeam.shopScopeShopNotFound",
  /** The assigned developer's scope covers none of the Creator's shops. */
  AFFILIATE_BUSINESS_DEVELOPER_OUT_OF_SHOP_SCOPE: "ecommerce.affiliateTeam.ownerOutOfShopScope",
};

/**
 * The translation key explaining a shop-scope refusal, or null when the error
 * is anything else and the caller should keep its own message.
 */
export function businessDeveloperShopScopeErrorKey(error: unknown): string | null {
  const code = graphQLErrorCode(error);
  return code ? (SHOP_SCOPE_ERROR_KEYS[code] ?? null) : null;
}
