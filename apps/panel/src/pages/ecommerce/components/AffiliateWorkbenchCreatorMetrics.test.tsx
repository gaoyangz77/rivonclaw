import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import type { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { AffiliateWorkbenchCreatorMetrics } from "./AffiliateWorkbenchCreatorMetrics.js";

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

it("shows market metrics with GMV currency/window, preserving zeros", () => {
  render(
    <AffiliateWorkbenchCreatorMetrics
      row={{
        creatorGmv: { amount: 12500, currency: "MXN", window: "LAST_30_DAYS", precision: "EXACT" },
        creatorPostRate: 0.85,
        creatorAverageVideoViews: 0,
        creatorUnitsSold: 0,
        creatorPerformanceMarket: "MX",
        creatorPerformanceObservedAt: "2026-10-19T00:00:00Z",
      }}
    />,
  );
  expect(screen.getByText(/MX.*12,500/)).toBeTruthy();
  expect(screen.getByText(/近30天/)).toBeTruthy();
  expect(screen.getByText("85%")).toBeTruthy();
  expect(screen.getAllByText("0")).toHaveLength(2);
  expect(screen.getByText(/MX ·/)).toBeTruthy();
});

it("keeps range GMV and does not invent a lifetime reporting period", () => {
  render(
    <AffiliateWorkbenchCreatorMetrics
      row={{
        creatorGmv: {
          minimumAmount: 100,
          maximumAmount: 200,
          currency: "USD",
          window: "UNSPECIFIED",
          precision: "RANGE",
        },
        creatorPostRate: null,
        creatorAverageVideoViews: null,
        creatorUnitsSold: null,
      }}
    />,
  );
  expect(screen.getByText(/100.*–.*200/)).toBeTruthy();
  expect(screen.getByText("统计周期未注明")).toBeTruthy();
  expect(screen.queryByText(/历史累计/)).toBeNull();
  expect(screen.getAllByText("—")).toHaveLength(3);
});

it("renders absent performance without turning it into zero", () => {
  render(<AffiliateWorkbenchCreatorMetrics row={{} as GQL.AffiliateWorkbenchSampleRow} />);
  expect(screen.getAllByText("—")).toHaveLength(4);
  expect(screen.queryByText("0")).toBeNull();
});

it("uses clear Chinese metric names and follows live language changes", async () => {
  render(<AffiliateWorkbenchCreatorMetrics row={{
    creatorGmv: { amount: 100, currency: "USD", window: "UNSPECIFIED", precision: "EXACT" },
  } as GQL.AffiliateWorkbenchSampleRow} />);
  for (const label of ["GMV", "样品履约率", "平均视频播放量", "出售件数", "统计周期未注明"]) {
    expect(screen.getByText(label)).toBeTruthy();
  }
  expect(screen.queryByText("Period unspecified")).toBeNull();
  await act(async () => { await i18n.changeLanguage("en"); });
  expect(screen.getByText("Average video views")).toBeTruthy();
  expect(screen.getByText("Reporting period not specified")).toBeTruthy();
  expect(screen.queryByText("统计周期未注明")).toBeNull();
});
