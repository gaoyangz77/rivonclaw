import { GQL } from "@rivonclaw/core";

type SampleOrderFields = {
  sampleWorkStatus: GQL.SampleWorkStatus;
  reviewDisposition?: GQL.AffiliateSampleReviewDisposition | null;
};

function sampleDisplayPriority(sample: SampleOrderFields): number {
  if (sample.reviewDisposition === GQL.AffiliateSampleReviewDisposition.SoftRejected) return 2;
  switch (sample.sampleWorkStatus) {
    case GQL.SampleWorkStatus.RequestPendingReview:
      return 0;
    case GQL.SampleWorkStatus.Cancelled:
    case GQL.SampleWorkStatus.Expired:
    case GQL.SampleWorkStatus.Fulfilled:
    case GQL.SampleWorkStatus.FulfillmentFailed:
      return 2;
    default:
      // In-flight applications and unresolved platform status stay above history.
      return 1;
  }
}

/** Presentation only: reviewable first, in-flight next, handled/history last.
 * Stable sorting preserves query order within each group and never mutates source data.
 */
export function sortAffiliateSamplesPendingFirst<T extends SampleOrderFields>(
  samples: readonly T[],
): T[] {
  return [...samples].sort((a, b) => sampleDisplayPriority(a) - sampleDisplayPriority(b));
}
