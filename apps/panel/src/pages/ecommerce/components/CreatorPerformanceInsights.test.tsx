import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { applySnapshot } from "mobx-state-tree";
import { entityStore } from "../../../store/entity-store.js";
import { productCategoryCacheSnapshot } from "@rivonclaw/core/models";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { CreatorPerformanceInsights } from "./CreatorPerformanceInsights.js";

const details = {
  observedAt: "2026-10-23T10:00:00Z",
  followerAge: [{ key: "25-34", share: 0.3031 }],
  followerGender: [
    { key: "male", share: 0.3422 },
    { key: "female", share: 0.148 },
  ],
  followerLocation: [{ key: "MEXICO CITY", share: 0.1306 }],
  categoryGmvDistribution: [
    { key: "600942", share: 0.5304 },
    { key: "-1", share: 0.1 },
  ],
  contentGmvDistribution: [
    { key: "VIDEO_GMV", share: 0.9353 },
    { key: "LIVE_GMV", share: 0.0647 },
  ],
  averageCommissionRate: 0,
  averageVideoLikeCount: 0,
} as GQL.AffiliateCreatorPerformanceDetails;

beforeEach(() => {
  void i18n.changeLanguage("zh");
});
afterEach(() => {
  cleanup();
  applySnapshot(entityStore.categories, {});
});

describe("Creator Performance insights", () => {
  it("reacts to MobX category updates and language changes without crossing markets", async () => {
    render(<CreatorPerformanceInsights details={details} market="FR" />);
    expect(screen.getByText("类目 600942")).toBeTruthy();
    const catalog = {
      locale: "zh",
      fetchedAt: new Date().toISOString(),
      items: [
        {
          id: "TIKTOK_SHOP:FR:v2:TIKTOK_SHOP:600942",
          categoryId: "600942",
          market: "FR",
          categoryVersion: "v2",
          listingPlatform: "TIKTOK_SHOP",
          parentId: "0",
          isLeaf: false,
          name: "家电",
        },
      ],
      marketVersions: [{ market: "FR", categoryVersion: "v2" }],
      syncStatus: [],
    };
    act(() => applySnapshot(entityStore.categories, { zh: productCategoryCacheSnapshot(catalog) }));
    fireEvent.focus(screen.getByRole("button", { name: "家电" }));
    expect(screen.getByRole("tooltip").textContent).toBe("家电 (600942)");
    await act(() => i18n.changeLanguage("en"));
    expect(screen.queryByText("家电")).toBeNull();
    expect(screen.getByText("Category 600942")).toBeTruthy();
    act(() =>
      applySnapshot(entityStore.categories, {
        en: productCategoryCacheSnapshot({
          ...catalog,
          locale: "en",
          items: [{ ...catalog.items[0], name: "Household Appliances" }],
        }),
      }),
    );
    expect(screen.getByText("Household Appliances")).toBeTruthy();
    expect(entityStore.productCategoryName("en", "MX", "600942")).toBeNull();
  });
  it("labels the real channel and location values and preserves partial shares", () => {
    render(<CreatorPerformanceInsights details={details} />);
    const gender = screen.getByRole("region", { name: "粉丝性别分布" });
    expect(within(gender).getByText("34.22%")).toBeTruthy();
    expect(within(gender).getByText("14.8%")).toBeTruthy();
    expect(within(gender).queryByText("69.81%")).toBeNull();
    const channel = screen.getByRole("region", { name: "各销售渠道 GMV 占比" });
    expect(within(channel).getByText("短视频")).toBeTruthy();
    expect(within(channel).getByText("93.53%")).toBeTruthy();
    expect(screen.getByText("MEXICO CITY")).toBeTruthy();
    expect(screen.getByText("类目 600942")).toBeTruthy();
    expect(screen.getByText("0%")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "视频表现" })).getByText("0")).toBeTruthy();
  });

  it("distinguishes unreported distributions from zero", () => {
    render(<CreatorPerformanceInsights details={{ ...details, contentGmvDistribution: [] }} />);
    const channel = screen.getByRole("region", { name: "各销售渠道 GMV 占比" });
    expect(within(channel).getByText("平台暂未提供此项分布。")).toBeTruthy();
    expect(within(channel).queryByRole("img")).toBeNull();
    expect(within(channel).queryByText("0%")).toBeNull();
  });

  it("shows an unavailable state for a projection without a full snapshot", () => {
    render(<CreatorPerformanceInsights details={null} />);
    expect(screen.getByText("暂未获得详细表现数据。")).toBeTruthy();
  });

  it("shows a one-sided money range without inventing an exact amount", () => {
    render(
      <CreatorPerformanceInsights
        details={{
          ...details,
          averageGmvPerBuyer: { currency: "USD", minimumAmount: 10 },
        }}
      />,
    );
    expect(
      within(screen.getByRole("region", { name: "合作指标" })).getByText(/≥.*10/),
    ).toBeTruthy();
  });
});
