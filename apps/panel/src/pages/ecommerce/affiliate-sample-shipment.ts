import { GQL } from "@rivonclaw/core";

export type SampleShipment = Pick<
  GQL.SampleApplicationRecord,
  "sampleWorkStatus" | "order" | "shippedAt" | "deliveredAt"
>;

export function sampleShipmentWarning(sample: SampleShipment, nowMs = Date.now()) {
  if (
    (sample.sampleWorkStatus !== GQL.SampleWorkStatus.ApprovedAwaitingShipment &&
      sample.sampleWorkStatus !== GQL.SampleWorkStatus.ShippedInTransit) ||
    sample.deliveredAt ||
    ["DELIVERED", "COMPLETED", "CANCELLED", "CANCELED", "CANCEL"].includes(
      sample.order?.status ?? "",
    ) ||
    sample.order?.latestTrackingEventActionCode === 50104
  )
    return null;
  const staleBefore = nowMs - 5 * 24 * 60 * 60_000;
  const lastEventAt = sample.order?.latestTrackingEventAt;
  if (lastEventAt) return Date.parse(lastEventAt) <= staleBefore ? "shipmentWarningStale" : null;
  const shipped =
    sample.sampleWorkStatus === GQL.SampleWorkStatus.ShippedInTransit ||
    sample.order?.status === "IN_TRANSIT";
  return shipped && sample.shippedAt && Date.parse(sample.shippedAt) <= staleBefore
    ? "shipmentWarningMissing"
    : null;
}
