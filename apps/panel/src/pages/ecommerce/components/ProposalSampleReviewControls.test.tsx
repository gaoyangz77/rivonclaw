import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { AgentWorkBundleCard } from "../AffiliateManagementPage.js";

vi.mock("../../../store/RuntimeStatusProvider.js", () => ({ useRuntimeStatus: () => ({ appSettings: { privacyMode: false } }) }));
vi.mock("../../../components/Toast.js", () => ({ useToast: () => ({ showToast: vi.fn() }) }));
beforeEach(async () => { await i18n.changeLanguage("zh"); });
afterEach(cleanup);
const modes = [
  { decision: GQL.AffiliateSampleReviewDecision.Approve, executionMode: GQL.AffiliateSampleReviewExecutionMode.PlatformAction },
  { decision: GQL.AffiliateSampleReviewDecision.Reject, executionMode: GQL.AffiliateSampleReviewExecutionMode.PlatformAction },
  { decision: GQL.AffiliateSampleReviewDecision.Reject, executionMode: GQL.AffiliateSampleReviewExecutionMode.AllowPlatformExpiry },
];
function proposal(mode = modes[0], messages = false): GQL.ActionProposal {
  return {
    id: "proposal-1", status: GQL.ActionProposalStatus.Pending, type: GQL.ActionProposalType.ReviewSampleApplication,
    steps: [{ stepId: "sample-1", type: GQL.ActionProposalType.ReviewSampleApplication,
      sampleReviewIntent: { sampleApplicationRecordId: "sample-1", ...mode } },
    ...(messages ? [{ stepId: "message", type: GQL.ActionProposalType.SendMessage, messageIntent: { parts: [{ kind: GQL.AffiliateMessagePartKind.Text, text: "Original message" }] } }] : [])],
  } as unknown as GQL.ActionProposal;
}
describe("shared sample proposal review controls", () => {
  it.each(modes.flatMap((original) => modes.map((final, index) => ({ original, final, label: ["同意", "拒绝", "忽略"][index] }))))("submits $label over $original without executing on selection", ({ original, final, label }) => {
    const approve = vi.fn().mockResolvedValue(true);
    const source = proposal(original);
    render(<AgentWorkBundleCard proposal={source} variant="embedded" shopLabel={{ text: "5号", sensitive: false }} onApprove={approve} />);
    fireEvent.click(screen.getByRole("radio", { name: label }));
    expect(approve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认最终处置" }));
    expect(approve).toHaveBeenCalledWith(source, { sampleReviews: [{ sampleApplicationRecordId: "sample-1", ...final }], confirmRelatedMessages: false });
    expect(source.steps[0].sampleReviewIntent).toMatchObject(original);
  });
  it("requires confirmation of attached messages after an override", () => {
    const approve = vi.fn();
    render(<AgentWorkBundleCard proposal={proposal(modes[0], true)} reviewLayout variant="embedded" shopLabel={{ text: "5号", sensitive: false }} onApprove={approve} />);
    fireEvent.click(screen.getByRole("radio", { name: "忽略" }));
    const submit = screen.getByRole("button", { name: "确认最终处置" }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(submit.disabled).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: "拒绝" }));
    expect(submit.disabled).toBe(true);
    expect(approve).not.toHaveBeenCalled();
  });
  it("displays stored final decisions next to unchanged AI recommendations", () => {
    const source = proposal();
    source.status = GQL.ActionProposalStatus.Executed;
    source.decision = { sampleReviews: [{ sampleApplicationRecordId: "sample-1", ...modes[2] }] };
    render(<AgentWorkBundleCard proposal={source} variant="embedded" shopLabel={{ text: "5号", sensitive: false }} />);
    expect(screen.queryByRole("radiogroup")).toBeNull();
    const final = screen.getByText("最终处置").parentElement!;
    expect(within(final).getByText("忽略")).toBeTruthy();
    expect(screen.getAllByText("发样").length).toBeGreaterThan(0);
  });
});
