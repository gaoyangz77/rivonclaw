import { GQL } from "@rivonclaw/core";
import { createInstance } from "i18next";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AFFILIATE_CAMPAIGN_TRANSLATIONS } from "../../i18n/affiliate-campaign-translations.js";
import { CampaignFunnel, campaignScreeningPassRate } from "./AffiliateCampaignPage.js";

afterEach(cleanup);

const counters: GQL.AffiliateCampaignExecutionCounters = {
  scanned: 3045,
  matched: 1420,
  protected: 342,
  outreachPolicyBlocked: 107,
  evaluated: 971,
  qualified: 315,
  qualificationFailed: 656,
  scheduled: 311,
  submitted: 283,
  sent: 273,
  failed: 10,
  replied: 0,
  uncertain: 0,
  cancelled: 0,
};

async function showFunnel(
  strategy: GQL.AffiliateCampaignSelectionStrategy = GQL.AffiliateCampaignSelectionStrategy
    .AiPreApproval,
  version = 3,
  values = counters,
  breakdown: GQL.AffiliateCampaignScreeningBreakdown | undefined = {
    marketLocalDate: "2026-09-21",
    aiRejectedCount: 600,
    otherRejectedCount: 50,
    unattributedRejectedCount: 6,
  },
) {
  const i18n = createInstance();
  await i18n.init({
    lng: "zh",
    resources: { zh: { translation: AFFILIATE_CAMPAIGN_TRANSLATIONS.zh } },
  });
  return render(
    <CampaignFunnel
      counters={values}
      screeningBreakdown={breakdown}
      counterSchemaVersion={version}
      selectionStrategy={strategy}
      deliveryFailureReasons={[]}
      searchPlanCount={4}
      onOpenSentCreators={vi.fn()}
      t={i18n.t}
    />,
  );
}

describe("Campaign qualification funnel", () => {
  it("shows qualification outcomes without expanding details and separates prechecks from screening", async () => {
    const { container } = await showFunnel();
    expect(screen.getByText("当前模式 · 智能筛选")).toBeTruthy();
    expect(screen.getByText("32.4%")).toBeTruthy();
    const rejected = screen.getByText("AI 模型筛除").closest("article")!;
    expect(rejected.querySelector(".affiliate-campaign-funnel-stage-value")?.textContent).toBe(
      "600",
    );
    expect(screen.getByText("其他条件筛除")).toBeTruthy();
    expect(screen.getByText("原因未归类")).toBeTruthy();
    expect(rejected.querySelector("details")).toBeNull();
    expect(screen.getByText("筛选前排除").closest("article")?.textContent).toContain("2,074");
    expect(container.querySelectorAll(".affiliate-campaign-funnel-mainline article")).toHaveLength(
      4,
    );
    expect(screen.getByText(/AI 筛除单独按实际决策归因/)).toBeTruthy();
  });

  it("keeps the AI card at zero in Marketplace mode and explains why", async () => {
    await showFunnel(GQL.AffiliateCampaignSelectionStrategy.MarketplaceRules);
    expect(screen.getByText("当前模式 · 达人广场规则")).toBeTruthy();
    expect(screen.queryByText("当前模式 · 智能筛选")).toBeNull();
    expect(screen.queryByText(/智能模式使用预审模型/)).toBeNull();
    const aiCard = screen.getByText("AI 模型筛除").closest("article")!;
    expect(aiCard.querySelector(".affiliate-campaign-funnel-stage-value")?.textContent).toBe("0");
    expect(aiCard.textContent).toContain("当前 Campaign 使用达人广场模式");
    expect(aiCard.textContent).not.toContain("其他条件筛除");
  });

  it("does not infer AI rejection counts from legacy totals or current mode", async () => {
    await showFunnel(GQL.AffiliateCampaignSelectionStrategy.AiPreApproval, 1);
    expect(screen.getByText("AI 模型筛除").closest("article")?.textContent).toContain("600");
    expect(screen.queryByText("32.4%")).toBeNull();
  });

  it("explains the AI model tradeoff from the funnel card", async () => {
    await showFunnel();
    const tooltipTrigger = screen.getByRole("button", {
      name: /AI 模型筛除: AI 模式使用机器学习/,
    });
    fireEvent.focus(tooltipTrigger);
    expect(screen.getByRole("tooltip").textContent).toContain("减少可触达达人数量");
    expect(screen.getByRole("tooltip").textContent).toContain("提高触达达人的平均质量");
  });

  it("shows missing attribution as unavailable, never as all qualification failures or zero", async () => {
    const i18n = createInstance();
    await i18n.init({
      lng: "zh",
      resources: { zh: { translation: AFFILIATE_CAMPAIGN_TRANSLATIONS.zh } },
    });
    render(
      <CampaignFunnel
        counters={counters}
        counterSchemaVersion={3}
        selectionStrategy={GQL.AffiliateCampaignSelectionStrategy.AiPreApproval}
        screeningUnavailable
        deliveryFailureReasons={[]}
        searchPlanCount={1}
        onOpenSentCreators={vi.fn()}
        t={i18n.t}
      />,
    );
    expect(
      screen
        .getByText("AI 模型筛除")
        .closest("article")
        ?.querySelector(".affiliate-campaign-funnel-stage-value")?.textContent,
    ).toBe("—");
    expect(screen.getByText(/AI 筛除明细暂不可用/)).toBeTruthy();
  });

  it("calculates rate only from decided outcomes, not scanned or pending evaluations", () => {
    expect(campaignScreeningPassRate(315, 656)).toBeCloseTo(32.4408, 3);
    expect(campaignScreeningPassRate(10, 0)).toBe(100);
    expect(campaignScreeningPassRate(0, 10)).toBe(0);
    expect(campaignScreeningPassRate(0, 0)).toBeNull();
    expect(campaignScreeningPassRate(10, null)).toBeNull();
  });

  it("renders no percentage when no decisions have completed", async () => {
    await showFunnel(GQL.AffiliateCampaignSelectionStrategy.AiPreApproval, 3, {
      ...counters,
      evaluated: 10,
      qualified: 0,
      qualificationFailed: 0,
    });
    expect(screen.queryByText("0.0%")).toBeNull();
    expect(screen.queryByText("NaN%")).toBeNull();
  });

  it("provides all screening copy in all eight locales", () => {
    const expectedKeys = Object.keys(
      AFFILIATE_CAMPAIGN_TRANSLATIONS.en.ecommerce.affiliateCampaign.screening,
    ).sort();
    for (const [locale, resource] of Object.entries(AFFILIATE_CAMPAIGN_TRANSLATIONS)) {
      const copy = resource.ecommerce.affiliateCampaign.screening;
      expect(Object.keys(copy).sort()).toEqual(expectedKeys);
      expect(Object.values(copy).every((value) => value.trim().length > 0)).toBe(true);
      if (locale !== "en")
        expect(copy.aiHint).not.toBe(
          AFFILIATE_CAMPAIGN_TRANSLATIONS.en.ecommerce.affiliateCampaign.screening.aiHint,
        );
    }
  });
});
