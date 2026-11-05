import type { ComponentProps } from "react";
import { afterEach, beforeAll, expect, it } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { AFFILIATE_CREATOR_PERFORMANCE_PROJECTION_STATES_QUERY } from "../../../api/shops-queries.js";
import i18n from "../../../i18n/index.js";
import type { CreatorPerformanceSource } from "../creator-performance-snapshot.js";
import {
  CreatorPerformanceCompactRow,
  CreatorPerformanceSnapshotCard,
} from "./AffiliateCreatorPerformanceSnapshot.js";

beforeAll(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

const SHOP = "shop-1";
const OTHER_SHOP = "shop-2";

const source: CreatorPerformanceSource = {
  performanceSnapshot: {
    lastContentDate: "2026-10-30T00:00:00.000Z",
    lastOrderDate: "2026-10-31T00:00:00.000Z",
    lastSampleShippedDate: null,
    shippedSampleCount: 6,
    contentCount90d: 4,
    orderCount90d: 10,
    netGmvUsd90d: 200,
    shopCount: 2,
  },
  shopStates: [
    {
      shopId: SHOP,
      performanceSnapshot: {
        lastContentDate: "2026-10-29T00:00:00.000Z",
        lastOrderDate: null,
        lastSampleShippedDate: "2026-09-01T00:00:00.000Z",
        shippedSampleCount: 3,
        contentCount90d: 2,
        orderCount90d: 0,
        netGmvUsd90d: 100,
        netGmvNative90d: 2000,
        gmvNativeCurrency: "MXN",
      },
    },
    { shopId: OTHER_SHOP, performanceSnapshot: null },
  ],
};

const LABELS = [
  "最近视频日期",
  "最近出单日期",
  "最近寄样日期",
  "历史累计实际寄出数量",
  "视频数-90天",
  "订单数-90天",
  "GMV-90天",
];

function states(shopIds: string[] | null, rows: Array<{ shopId: string; cutoff: string }>) {
  return {
    request: {
      query: AFFILIATE_CREATOR_PERFORMANCE_PROJECTION_STATES_QUERY,
      variables: { shopIds },
    },
    result: {
      data: {
        affiliateCreatorPerformanceProjectionStates: rows.map((row) => ({
          __typename: "AffiliateCreatorPerformanceProjectionState",
          shopId: row.shopId,
          sourceCutoffAt: row.cutoff,
          windowEndDate: "2026-11-04T00:00:00.000Z",
        })),
      },
    },
  };
}

function renderWith(
  ui: React.ReactElement,
  mocks: ComponentProps<typeof MockedProvider>["mocks"] = [],
) {
  return render(<MockedProvider mocks={mocks}>{ui}</MockedProvider>);
}

/** Value shown for a field label, read from the dt/dd pair. */
function valueOf(label: string) {
  const term = screen.getByText(label, { selector: "dt" });
  return term.parentElement!.querySelector("dd")!.textContent;
}

it("shows the seven seller-named fields of the rollup at the all-shops scope, with UTC calendar dates", async () => {
  renderWith(<CreatorPerformanceSnapshotCard source={source} scopeShopId="" />, [
    states(null, [{ shopId: SHOP, cutoff: "2026-11-04T16:00:00.000Z" }]),
  ]);
  for (const label of LABELS) expect(screen.getByText(label, { selector: "dt" })).toBeTruthy();
  expect(valueOf("最近视频日期")).toContain("10月30日");
  expect(valueOf("最近出单日期")).toContain("10月31日");
  // No ship date was observed: an empty value, not a made-up one.
  expect(valueOf("最近寄样日期")).toBe("—");
  expect(valueOf("历史累计实际寄出数量")).toBe("6");
  expect(valueOf("视频数-90天")).toBe("4");
  expect(valueOf("订单数-90天")).toBe("10");
  expect(valueOf("GMV-90天")).toContain("200");
  expect(valueOf("GMV-90天")).toContain("$");
  expect(screen.getByText("全部店铺（2 家）")).toBeTruthy();
  // The caption is the shop's watermark, never a Creator snapshot timestamp.
  await waitFor(() => expect(screen.getByText(/^数据截至 /)).toBeTruthy());
  expect(screen.getByText(/^数据截至 .*2026年11月/)).toBeTruthy();
});

it("shows the selected shop's own snapshot in the shop currency, keeping a real zero", async () => {
  renderWith(<CreatorPerformanceSnapshotCard source={source} scopeShopId={SHOP} />, [
    states([SHOP], [{ shopId: SHOP, cutoff: "2026-11-04T16:00:00.000Z" }]),
  ]);
  expect(valueOf("最近视频日期")).toContain("10月29日");
  expect(valueOf("最近出单日期")).toBe("—");
  expect(valueOf("最近寄样日期")).toContain("9月1日");
  // A shop that reported zero orders shows 0; only an unreached Creator is blank.
  expect(valueOf("订单数-90天")).toBe("0");
  expect(valueOf("GMV-90天")).toContain("2,000");
  expect(valueOf("GMV-90天")).toBe("MX$2,000");
  expect(screen.getByText("当前店铺")).toBeTruthy();
});

it("leaves every field empty at a shop the projection has not reached, never borrowing the rollup", async () => {
  renderWith(<CreatorPerformanceCompactRow source={source} scopeShopId={OTHER_SHOP} />);
  const row = document.querySelector(".affiliate-creator-compact-performance") as HTMLElement;
  const values = within(row)
    .getAllByText(/./, { selector: "dd" })
    .map((node) => node.textContent);
  expect(values).toEqual(Array(7).fill("—"));
});

it("says the data is not synced when the shop has no watermark yet", async () => {
  renderWith(<CreatorPerformanceSnapshotCard source={null} scopeShopId={SHOP} />, [
    states([SHOP], []),
  ]);
  await waitFor(() => expect(screen.getByText("尚未同步")).toBeTruthy());
  expect(valueOf("订单数-90天")).toBe("—");
});

it("states the three known limits next to the block", () => {
  renderWith(<CreatorPerformanceSnapshotCard source={source} scopeShopId="" />, [states(null, [])]);
  const limits = screen.getByText(/视频数仅统计与样品关联的内容/);
  expect(limits.textContent).toContain("2026-07-22");
  expect(limits.textContent).toContain("买返样品");
});
