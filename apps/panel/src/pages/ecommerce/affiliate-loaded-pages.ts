import type { GQL } from "@rivonclaw/core";

export function affiliateTimelinePageInfo(page: GQL.AffiliateRelationshipTimelinePayload) {
  return { hasMore: page.hasOlder, nextCursor: page.olderCursor ?? null };
}
export function affiliateHistoryPageInfo(page: GQL.AffiliateCreatorMessageHistoryPayload) {
  return {
    hasMore: page.hasMore,
    nextCursor: page.nextOffset == null ? null : String(page.nextOffset),
  };
}
export function affiliateHistoryCursor(
  input: GQL.AffiliateCreatorMessageHistoryInput,
  cursor: string | null,
): GQL.AffiliateCreatorMessageHistoryInput {
  return cursor === null ? input : { ...input, offset: Number(cursor) };
}
function mergeProductSummaries(
  previous: GQL.AffiliateRelationshipProductSummary[],
  next: GQL.AffiliateRelationshipProductSummary[],
) {
  return [
    ...new Map(
      [...previous, ...next].map((entry) => [`${entry.shopId}:${entry.product.productId}`, entry]),
    ).values(),
  ];
}
export function mergeSampleDetailPages(
  previous: GQL.AffiliateRelationshipSampleApplicationPage,
  next: GQL.AffiliateRelationshipSampleApplicationPage,
): GQL.AffiliateRelationshipSampleApplicationPage {
  return {
    ...next,
    items: [...previous.items, ...next.items],
    productSummaries: mergeProductSummaries(previous.productSummaries, next.productSummaries),
  };
}
export function mergePlatformDetailPages(
  previous: GQL.AffiliateRelationshipPlatformCollaborationPage,
  next: GQL.AffiliateRelationshipPlatformCollaborationPage,
): GQL.AffiliateRelationshipPlatformCollaborationPage {
  return {
    ...next,
    items: [...previous.items, ...next.items],
    productSummaries: mergeProductSummaries(previous.productSummaries, next.productSummaries),
  };
}
