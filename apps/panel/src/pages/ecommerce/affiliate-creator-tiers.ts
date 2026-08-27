import { GQL } from "@rivonclaw/core";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/**
 * The sample review path is one ordered ladder, not a set of tags. A
 * (relationship, shop) pair holds exactly one rung, and climbing replaces the
 * rung below it. Rank is declared explicitly so nothing ever infers order from
 * the enum's declaration order.
 */
export const CREATOR_SAMPLE_TIER_ORDER: readonly GQL.CreatorSampleTier[] = [
  GQL.CreatorSampleTier.SampleShipped,
  GQL.CreatorSampleTier.SampleDelivered,
  GQL.CreatorSampleTier.SampleFulfilled,
  GQL.CreatorSampleTier.AttributableOrder,
];

const CREATOR_SAMPLE_TIER_MEDAL: Record<GQL.CreatorSampleTier, string> = {
  [GQL.CreatorSampleTier.SampleShipped]: "🥉",
  [GQL.CreatorSampleTier.SampleDelivered]: "🥈",
  [GQL.CreatorSampleTier.SampleFulfilled]: "🥇",
  [GQL.CreatorSampleTier.AttributableOrder]: "💎",
};

/** Business term for one rung, without the medal. */
export function creatorSampleTierName(t: TranslateFn, tier: GQL.CreatorSampleTier): string {
  return t(`ecommerce.affiliateWorkspace.sampleTiers.${tier}`, { defaultValue: tier });
}

export function creatorSampleTierMedal(tier: GQL.CreatorSampleTier): string {
  return CREATOR_SAMPLE_TIER_MEDAL[tier];
}

/** Medal plus the business term, the canonical list/detail rendering. */
export function creatorSampleTierLabel(t: TranslateFn, tier: GQL.CreatorSampleTier): string {
  return `${CREATOR_SAMPLE_TIER_MEDAL[tier]} ${creatorSampleTierName(t, tier)}`;
}

/**
 * No rung reached renders as an em dash. Rendering it as the lowest rung would
 * claim a sample was shipped when none was.
 */
export function creatorSampleTierDisplay(
  t: TranslateFn,
  tier: GQL.CreatorSampleTier | null | undefined,
): string {
  return tier ? creatorSampleTierLabel(t, tier) : "—";
}

/**
 * Resolve the highest current rung from shop-scoped relationship facts.
 * Those facts are authoritative and also let list views retain the same
 * business meaning while a convenience projection is being refreshed.
 */
export function highestCreatorSampleTier(
  tiers: ReadonlyArray<GQL.CreatorSampleTier | null | undefined>,
): GQL.CreatorSampleTier | null {
  let highestIndex = -1;
  for (const tier of tiers) {
    if (!tier) continue;
    const tierIndex = CREATOR_SAMPLE_TIER_ORDER.indexOf(tier);
    if (tierIndex > highestIndex) highestIndex = tierIndex;
  }
  return highestIndex >= 0 ? CREATOR_SAMPLE_TIER_ORDER[highestIndex]! : null;
}

/** Manual tags are free-form seller rows; the catalog name is the only label. */
export function creatorManualTagLabel(tag: Pick<GQL.CreatorManualTag, "name">): string {
  return tag.name;
}
