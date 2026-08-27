import { GQL } from "@rivonclaw/core";

export const CREATOR_SYSTEM_TAG_ORDER: readonly GQL.AffiliateCreatorSystemTag[] = [
  GQL.AffiliateCreatorSystemTag.NoCampaignDisturb,
];

export function creatorSystemTagLabel(
  t: (key: string, options?: Record<string, unknown>) => string,
  tag: GQL.AffiliateCreatorSystemTag,
): string {
  return t(`ecommerce.affiliateWorkspace.systemTags.values.${tag}.label`, {
    defaultValue: tag,
  });
}

export function creatorSystemTagDescription(
  t: (key: string, options?: Record<string, unknown>) => string,
  tag: GQL.AffiliateCreatorSystemTag,
): string {
  return t(`ecommerce.affiliateWorkspace.systemTags.values.${tag}.description`, {
    defaultValue: tag,
  });
}
