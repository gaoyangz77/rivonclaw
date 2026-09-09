import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n/index.js";
import { GQL } from "@rivonclaw/core";
import { AgentWorkBundleCard, ProposalSampleDecisionBundle, proposalSampleReviewRows } from "../AffiliateManagementPage.js";
import { AffiliateProposalStock, type AffiliateProposalStockItem } from "./AffiliateProposalStock.js";

vi.mock("../../../store/RuntimeStatusProvider.js", () => ({
  useRuntimeStatus: () => ({ appSettings: { privacyMode: false } }),
}));
vi.mock("../../../components/Toast.js", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

beforeEach(async () => { await i18n.changeLanguage("zh"); });
afterEach(cleanup);

const item = (label: string, quantity: number | null): AffiliateProposalStockItem => ({
  id: `internal-${label}`,
  skuId: `platform-${label}`,
  label,
  quantity,
});

describe("Affiliate proposal stock", () => {
  const rejection = {
    id: "reject-bundle",
    status: GQL.ActionProposalStatus.Pending,
    type: GQL.ActionProposalType.ReviewSampleApplication,
    steps: [{
      stepId: "sample-1",
      type: GQL.ActionProposalType.ReviewSampleApplication,
      sampleReviewIntent: {
        decision: GQL.AffiliateSampleReviewDecision.Reject,
        rejectReason: "OTHER",
        rejectReasonExplanation: "Long rejection explanation with evidence, kept outside the decision metric.",
      },
    }],
  } as unknown as GQL.ActionProposal;

  it("renders long reasons outside the short decision label", () => {
    const { container } = render(<ProposalSampleDecisionBundle
      proposal={rejection}
      rows={proposalSampleReviewRows(rejection)}
      shopLabelForId={() => ({ text: "5号", sensitive: false })}
    />);
    const reason = screen.getByText(rejection.steps[0].sampleReviewIntent!.rejectReasonExplanation!);
    expect(reason.closest(".affiliate-sample-decision-reason")).toBeTruthy();
    expect(reason.closest(".affiliate-sample-decision-metric")).toBeNull();
    expect(container.querySelector(".tk-v1-badge-danger")?.textContent).toBe("拒绝");
  });

  it("keeps review actions and revision editor outside the scroll region", () => {
    const approve = vi.fn().mockResolvedValue(true);
    const revise = vi.fn().mockResolvedValue(true);
    render(<AgentWorkBundleCard proposal={rejection} reviewLayout variant="embedded"
      shopLabel={{ text: "5号", sensitive: false }} onApprove={approve} onRequestRevision={revise} />);
    const content = screen.getByRole("region", { name: "工作详情" });
    const rewrite = screen.getByRole("button", { name: "请求重写" });
    expect(content.contains(rewrite)).toBe(false);
    fireEvent.click(rewrite);
    const editor = screen.getByRole("textbox");
    expect(content.contains(editor)).toBe(false);
    expect(editor.closest(".affiliate-proposal-row-decision")).toBeTruthy();
    expect(approve).not.toHaveBeenCalled();
    expect(revise).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("does not expose decision actions for finished work", () => {
    render(<AgentWorkBundleCard proposal={{ ...rejection, status: GQL.ActionProposalStatus.Approved }}
      reviewLayout variant="embedded" shopLabel={{ text: "5号", sensitive: false }}
      onApprove={vi.fn()} onRequestRevision={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "请求重写" })).toBeNull();
  });
  it("shows Seller SKUs or product names beside stock without exposing platform IDs", () => {
    render(
      <AffiliateProposalStock items={[
        item("ROPE-GOLD-18", 21),
        item("ROPE-GOLD-20", 370),
        item("Holylegend full product name with size and material", 234),
      ]} />,
    );
    const table = screen.getByRole("table", { name: "SKU / 库存" });
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "SKU / 商品", "库存",
    ]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.textContent)).toEqual([
      "ROPE-GOLD-1821", "ROPE-GOLD-20370", "Holylegend full product name with size and material234",
    ]);
    expect(screen.queryByText(/platform-/)).toBeNull();
    expect(within(rows[0]).getByText("ROPE-GOLD-18").getAttribute("data-tk-private")).toBe("text");
    expect(within(rows[2]).getByText("Holylegend full product name with size and material").getAttribute("data-tk-private")).toBe("text");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("keeps zero stock distinct from unknown stock", () => {
    render(<AffiliateProposalStock items={[item("empty", 0), item("unknown", null)]} />);
    expect(screen.getByText("0")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("shows missing SKU data without inventing a product-level quantity", () => {
    render(<AffiliateProposalStock items={[{ id: "missing", skuId: null, label: null, quantity: null }]} />);
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("renders no SKU rows for message-only proposals", () => {
    render(<AffiliateProposalStock items={[]} />);
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("localizes stock counts without changing Seller SKU labels", async () => {
    await i18n.changeLanguage("de");
    render(<AffiliateProposalStock items={[item("ROPE-GOLD-18", 1234)]} />);
    expect(screen.getByRole("table", { name: "SKU / Bestand" })).toBeTruthy();
    expect(screen.getByText("ROPE-GOLD-18")).toBeTruthy();
    expect(screen.getByText("1.234")).toBeTruthy();
  });

  it("keeps SKU subrows under each Sample without duplicating the Sample's decision", () => {
    const proposal = {
      id: "bundle",
      productSummaries: [{
        productId: "product-1",
        title: "Gold rope necklace",
        totalAvailableQuantity: 999,
        skus: [
          { skuId: "sku-1", sellerSku: "ROPE-GOLD-18", totalAvailableQuantity: 7 },
          { skuId: "sku-2", totalAvailableQuantity: 0 },
        ],
      }],
      steps: ["application-1", "application-2"].map((stepId) => ({
        stepId,
        shopId: "shop-1",
        productId: "product-1",
        type: GQL.ActionProposalType.ReviewSampleApplication,
        sampleReviewIntent: { decision: GQL.AffiliateSampleReviewDecision.Approve },
      })),
    } as unknown as GQL.ActionProposal;
    render(<ProposalSampleDecisionBundle
      proposal={proposal}
      rows={proposalSampleReviewRows(proposal)}
      shopLabelForId={() => ({ text: "5号", sensitive: false })}
    />);
    const applications = screen.getAllByRole("article");
    expect(applications).toHaveLength(2);
    for (const application of applications) {
      const stock = within(application).getByRole("table", { name: "SKU / 库存" });
      expect(within(stock).getAllByRole("row")).toHaveLength(3);
      expect(within(stock).getByText("ROPE-GOLD-18")).toBeTruthy();
      expect(within(stock).getByText("Gold rope necklace")).toBeTruthy();
      expect(within(stock).getByText("7")).toBeTruthy();
      expect(within(stock).getByText("0")).toBeTruthy();
      expect(within(application).getAllByText(i18n.t("ecommerce.affiliateWorkspace.sampleDecisionBundle.agentDecision"))).toHaveLength(1);
    }
    expect(screen.getByText("共 2 条申样 · 同意 2 条 · 拒绝 0 条 · 忽略 0 条")).toBeTruthy();
    expect(screen.queryByText("999")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
