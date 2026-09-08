import { describe, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import { sortAffiliateSamplesPendingFirst } from "./affiliate-sample-order.js";

function sample(
  id: string,
  sampleWorkStatus: GQL.SampleWorkStatus,
  reviewDisposition = GQL.AffiliateSampleReviewDisposition
    .Open as GQL.AffiliateSampleReviewDisposition,
) {
  return { id, sampleWorkStatus, reviewDisposition };
}

describe("Creator Detail sample order", () => {
  it("puts pending review before in-flight work, then handled and historical applications", () => {
    const records = [
      sample("expired", GQL.SampleWorkStatus.Expired),
      sample("shipping", GQL.SampleWorkStatus.ShippedInTransit),
      sample("fulfilled", GQL.SampleWorkStatus.Fulfilled),
      sample("pending", GQL.SampleWorkStatus.RequestPendingReview),
      sample("cancelled", GQL.SampleWorkStatus.Cancelled),
      sample("awaiting-shipment", GQL.SampleWorkStatus.ApprovedAwaitingShipment),
      sample("failed", GQL.SampleWorkStatus.FulfillmentFailed),
      sample("awaiting-content", GQL.SampleWorkStatus.DeliveredAwaitingContent),
      sample("content-review", GQL.SampleWorkStatus.ContentObservedReviewing),
      sample("unknown", GQL.SampleWorkStatus.PlatformStatusUnknown),
    ];
    expect(sortAffiliateSamplesPendingFirst(records).map(({ id }) => id)).toEqual([
      "pending",
      "shipping",
      "awaiting-shipment",
      "awaiting-content",
      "content-review",
      "unknown",
      "expired",
      "fulfilled",
      "cancelled",
      "failed",
    ]);
  });

  it("keeps ignored applications below pending ones even while TikTok still shows pending", () => {
    const ignored = sample(
      "ignored",
      GQL.SampleWorkStatus.RequestPendingReview,
      GQL.AffiliateSampleReviewDisposition.SoftRejected,
    );
    const pending = sample("pending", GQL.SampleWorkStatus.RequestPendingReview);
    expect(sortAffiliateSamplesPendingFirst([ignored, pending])).toEqual([pending, ignored]);
  });

  it("keeps the original order within groups and does not mutate records or input", () => {
    const history = Object.freeze(sample("expired", GQL.SampleWorkStatus.Expired));
    const first = Object.freeze(sample("first", GQL.SampleWorkStatus.RequestPendingReview));
    const second = Object.freeze({
      ...sample("second", GQL.SampleWorkStatus.RequestPendingReview),
      reviewDisposition: null,
    });
    const records = Object.freeze([history, first, second]);
    const sorted = sortAffiliateSamplesPendingFirst(records);
    expect(sorted).toEqual([first, second, history]);
    expect(records).toEqual([history, first, second]);
    expect(sorted[0]).toBe(first);
  });

  it("moves newly loaded or reopened pending applications above history and accepts empty data", () => {
    const history = sample("expired", GQL.SampleWorkStatus.Expired);
    const reopened = sample("reopened", GQL.SampleWorkStatus.RequestPendingReview);
    expect(sortAffiliateSamplesPendingFirst([history, reopened])).toEqual([reopened, history]);
    expect(sortAffiliateSamplesPendingFirst([])).toEqual([]);
  });
});
