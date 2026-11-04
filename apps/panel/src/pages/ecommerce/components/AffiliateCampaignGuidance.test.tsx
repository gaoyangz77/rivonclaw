// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import {
  AffiliateCampaignGuidancePreview,
  AffiliateCampaignGuidanceSummary,
  AffiliateCampaignGuidanceUsage,
} from "./AffiliateCampaignGuidance.js";

const checklist = [
  { requirement: "粉丝至少 5000", treatment: GQL.AffiliateCampaignGuidanceTreatment.Exact },
  {
    requirement: "月销 8000 美元",
    treatment: GQL.AffiliateCampaignGuidanceTreatment.Approximate,
    note: "按近 30 天销售额",
  },
  {
    requirement: "真人出镜",
    treatment: GQL.AffiliateCampaignGuidanceTreatment.Unsupported,
    note: "平台无此数据",
  },
];

describe("Campaign guidance presentation", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("zh");
  });
  afterEach(cleanup);

  it("shows each requirement with a text label, the note, and the restatement", () => {
    render(
      <AffiliateCampaignGuidancePreview
        state={{ status: "ready", checklist, restatement: "粉丝多或销售高均可" }}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByText("粉丝至少 5000")).toBeTruthy();
    expect(screen.getByText(/按要求筛选/)).toBeTruthy();
    expect(screen.getByText(/近似筛选/)).toBeTruthy();
    expect(screen.getByText("按近 30 天销售额")).toBeTruthy();
    expect(screen.getByText(/无法筛选，仅作搜索方向参考/)).toBeTruthy();
    expect(screen.getByText("我们的理解")).toBeTruthy();
    expect(screen.getByText("粉丝多或销售高均可")).toBeTruthy();
  });

  it("returns to editing from the preview", () => {
    const onEdit = vi.fn();
    render(<AffiliateCampaignGuidancePreview state={{ status: "loading" }} onEdit={onEdit} />);
    fireEvent.click(screen.getByText("返回修改筛选要求"));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("explains an empty guidance and each failure without blocking", () => {
    const { rerender } = render(
      <AffiliateCampaignGuidancePreview state={{ status: "empty" }} onEdit={() => {}} />,
    );
    expect(screen.getByText("未填写筛选要求，不做额外筛选")).toBeTruthy();
    rerender(
      <AffiliateCampaignGuidancePreview
        state={{ status: "error", errorKey: "quotaExhausted" }}
        onEdit={() => {}}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain("云端生成额度已用完");
  });

  it("tells the detail reader when nothing has been interpreted yet", () => {
    render(<AffiliateCampaignGuidanceSummary loading={false} interpretation={null} />);
    expect(screen.getByText("尚未解析：生成下一组搜索条件时会自动解析")).toBeTruthy();
  });

  it("lists the shop's own category specialties and places content language by capability", () => {
    const label = (value: string) => value.toLowerCase();
    const { rerender, container } = render(
      <AffiliateCampaignGuidanceUsage
        capabilities={{ languages: ["ENGLISH"], categoryPros: ["BEAUTY", "HOME"] }}
        marketplaceLabel={label}
      />,
    );
    expect(container.textContent).toContain("类目专长（beauty, home）");
    const groups = () =>
      Array.from(container.querySelectorAll(".affiliate-guidance-usage-groups section"));
    expect(groups()[0]?.textContent).toContain("内容语言");
    expect(groups()[2]?.textContent).not.toContain("内容语言");
    rerender(
      <AffiliateCampaignGuidanceUsage
        capabilities={{ languages: [], categoryPros: [] }}
        marketplaceLabel={label}
      />,
    );
    expect(groups()[2]?.textContent).toContain("内容语言（本站点不提供）");
  });
});
