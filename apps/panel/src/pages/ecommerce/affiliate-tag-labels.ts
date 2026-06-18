import { GQL } from "@rivonclaw/core";

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export function creatorTagLabel(t: TranslateFn, tag: GQL.CreatorTag): string {
  if (!tag.systemKey) return tag.name;
  return t(`ecommerce.affiliateWorkspace.creatorSystemTags.${tag.systemKey}`, {
    defaultValue: tag.name,
  });
}
