import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { sampleShipmentWarning, type SampleShipment } from "../affiliate-sample-shipment.js";
import {
  AffiliateSampleShipment,
  AffiliateSampleShipmentWarning,
} from "./AffiliateSampleShipment.js";

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);
const now = Date.parse("2026-10-20T00:00:00Z");
const old = "2026-10-15T00:00:00Z";
const sample: SampleShipment = {
  sampleWorkStatus: GQL.SampleWorkStatus.ShippedInTransit,
  shippedAt: old,
  order: {
    status: "IN_TRANSIT",
    trackingSyncedAt: "2026-10-20T00:00:00Z",
    latestTrackingEventAt: old,
    latestTrackingEventDescription: "Collected",
    latestTrackingEventActionCode: 30901,
  },
};

it("shows a yellow, textual five-day warning even when the last poll was recent", () => {
  render(<AffiliateSampleShipmentWarning sample={sample} nowMs={now} />);
  expect(screen.getByText("物流超过 5 天未更新").className).toContain("warning");
  expect(sampleShipmentWarning(sample, now - 1)).toBeNull();
  expect(
    sampleShipmentWarning(
      { ...sample, order: { ...sample.order, latestTrackingEventAt: "2026-10-19T00:00:00Z" } },
      now,
    ),
  ).toBeNull();
});

it("distinguishes missing tracking from stalled movement; no warning for delivered/cancelled/unshipped records", () => {
  expect(sampleShipmentWarning({ ...sample, order: null }, now)).toBe("shipmentWarningMissing");
  expect(sampleShipmentWarning({ ...sample, order: null, shippedAt: null }, now)).toBeNull();
  expect(sampleShipmentWarning({ ...sample, deliveredAt: old }, now)).toBeNull();
  for (const status of ["DELIVERED", "COMPLETED", "CANCELLED"]) {
    expect(
      sampleShipmentWarning({ ...sample, order: { ...sample.order, status } }, now),
    ).toBeNull();
  }
  expect(
    sampleShipmentWarning(
      { ...sample, order: { ...sample.order, latestTrackingEventActionCode: 50104 } },
      now,
    ),
  ).toBeNull();
  expect(
    sampleShipmentWarning(
      { ...sample, sampleWorkStatus: GQL.SampleWorkStatus.RequestPendingReview },
      now,
    ),
  ).toBeNull();
  expect(
    sampleShipmentWarning(
      { ...sample, sampleWorkStatus: GQL.SampleWorkStatus.ApprovedAwaitingShipment, order: null },
      now,
    ),
  ).toBeNull();
});

it("renders saved logistics details and expands the Provider timeline newest first", () => {
  render(
    <AffiliateSampleShipment
      sample={{
        ...sample,
        order: {
          ...sample.order,
          trackingEvents: [
            { description: "Older event", actionCode: 30901, updateTimeMillis: now - 60_000 },
            { description: "Newer event", actionCode: 50101, updateTimeMillis: now },
          ],
        },
      }}
    />,
  );
  expect(screen.getByText("运输中")).toBeTruthy();
  expect(screen.getByText("最近同步")).toBeTruthy();
  expect(screen.getByText("Collected")).toBeTruthy();
  const region = screen.getByRole("region", { name: "物流状态" });
  expect(
    region.querySelectorAll(".affiliate-sample-shipment-summary > .affiliate-entity-fact"),
  ).toHaveLength(3);
  expect(screen.queryByText("Newer event")).toBeNull();
  const showButton = screen.getByRole("button", { name: "查看物流轨迹" });
  const trackingCard = showButton.closest(".affiliate-sample-shipment-latest");
  expect(trackingCard?.textContent).toContain("Collected");
  expect(showButton.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(showButton);
  expect(screen.getByRole("list").id).toBe(showButton.getAttribute("aria-controls"));
  expect(trackingCard?.contains(screen.getByRole("list"))).toBe(true);
  expect(screen.getAllByRole("listitem").map((e) => e.textContent)).toEqual([
    expect.stringContaining("Newer event"),
    expect.stringContaining("Older event"),
  ]);
  fireEvent.click(screen.getByRole("button", { name: "收起物流轨迹" }));
  expect(screen.queryByRole("list")).toBeNull();
});

it("keeps separate sample timelines independent", () => {
  const withEvents = {
    ...sample,
    order: {
      ...sample.order,
      trackingEvents: [
        { description: "Package delivered", actionCode: 50104, updateTimeMillis: now },
      ],
    },
  };
  render(
    <>
      <AffiliateSampleShipment sample={withEvents} />
      <AffiliateSampleShipment sample={withEvents} />
    </>,
  );
  const buttons = screen.getAllByRole("button", { name: "查看物流轨迹" });
  expect(buttons[0]!.getAttribute("aria-controls")).not.toBe(
    buttons[1]!.getAttribute("aria-controls"),
  );
  fireEvent.click(buttons[0]!);
  expect(screen.getAllByRole("list")).toHaveLength(1);
  expect(buttons[1]!.getAttribute("aria-expanded")).toBe("false");
});

it("does not offer empty tracking history", () => {
  render(<AffiliateSampleShipment sample={sample} />);
  expect(screen.queryByRole("button", { name: "查看物流轨迹" })).toBeNull();
  expect(screen.getByText("Collected")).toBeTruthy();
});

it("does not invent a logistics snapshot before it has been fetched", () => {
  const { container } = render(<AffiliateSampleShipment sample={{ ...sample, order: null }} />);
  expect(container.textContent).toBe("");
});
