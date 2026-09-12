import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "../../../i18n/index.js";
import { AFFILIATE_PROPOSAL_TRANSLATIONS } from "../../../i18n/affiliate-proposal-translations.js";
import { AgentWorkBundleCard } from "../AffiliateManagementPage.js";

vi.mock("../../../store/RuntimeStatusProvider.js", () => ({
  useRuntimeStatus: () => ({ appSettings: { privacyMode: false } }),
}));
vi.mock("../../../components/Toast.js", () => ({ useToast: () => ({ showToast: vi.fn() }) }));

const dispositions = {
  同意: {
    decision: GQL.AffiliateSampleReviewDecision.Approve,
    executionMode: GQL.AffiliateSampleReviewExecutionMode.PlatformAction,
  },
  拒绝: {
    decision: GQL.AffiliateSampleReviewDecision.Reject,
    executionMode: GQL.AffiliateSampleReviewExecutionMode.PlatformAction,
  },
  忽略: {
    decision: GQL.AffiliateSampleReviewDecision.Reject,
    executionMode: GQL.AffiliateSampleReviewExecutionMode.AllowPlatformExpiry,
  },
};
type Disposition = keyof typeof dispositions;

function proposalFor(action: Disposition): GQL.ActionProposal {
  const sampleReviewIntent = { ...dispositions[action], sampleApplicationRecordId: "sample-1" };
  return {
    id: `proposal-${action}`,
    status: GQL.ActionProposalStatus.Pending,
    type: GQL.ActionProposalType.ReviewSampleApplication,
    sampleReviewIntent,
    steps: [
      {
        stepId: "sample-1",
        type: GQL.ActionProposalType.ReviewSampleApplication,
        sampleReviewIntent,
      },
    ],
  } as unknown as GQL.ActionProposal;
}

function renderProposal(proposal: GQL.ActionProposal, decidingProposal = false) {
  const onApprove = vi.fn().mockResolvedValue(true);
  const onReject = vi.fn().mockResolvedValue(true);
  const onRequestRevision = vi.fn().mockResolvedValue(true);
  const onIgnore = vi.fn().mockResolvedValue(true);
  render(
    <AgentWorkBundleCard
      proposal={proposal}
      reviewLayout
      variant="embedded"
      shopLabel={{ text: "Test shop", sensitive: false }}
      decidingProposal={decidingProposal}
      onApprove={onApprove}
      onReject={onReject}
      onRequestRevision={onRequestRevision}
      onIgnore={onIgnore}
    />,
  );
  return { onApprove, onReject, onRequestRevision, onIgnore };
}

function messageProposal(): GQL.ActionProposal {
  const messageIntent = {
    parts: [{ kind: GQL.AffiliateMessagePartKind.Text, text: "Merci pour votre confirmation." }],
  } as GQL.ActionProposalMessageIntent;
  return {
    id: "proposal-message",
    status: GQL.ActionProposalStatus.Pending,
    type: GQL.ActionProposalType.SendMessage,
    messageIntent,
    steps: [
      { stepId: "message-1", type: GQL.ActionProposalType.SendMessage, messageIntent },
    ],
  } as unknown as GQL.ActionProposal;
}

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});

describe("single sample proposal actions", () => {
  it.each(Object.keys(dispositions) as Disposition[])(
    "confirms the Agent's %s recommendation directly",
    (action) => {
      const proposal = proposalFor(action);
      const { onApprove, onReject } = renderProposal(proposal);
      expect(screen.getByText(action, { selector: ".tk-v1-badge" })).toBeTruthy();
      expect(screen.queryByText("最终处置")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: `确认${action}` }));
      expect(onApprove).toHaveBeenCalledWith(proposal);
      expect(onReject).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["同意", "拒绝"],
    ["同意", "忽略"],
    ["拒绝", "同意"],
    ["拒绝", "忽略"],
    ["忽略", "同意"],
    ["忽略", "拒绝"],
  ] as const)("offers only the alternatives to %s and executes %s", (from, to) => {
    const proposal = proposalFor(from);
    const { onReject, onApprove } = renderProposal(proposal);
    fireEvent.click(screen.getByRole("button", { name: "改为…" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(2);
    expect(within(menu).queryByRole("menuitem", { name: new RegExp(`^改为${from}`) })).toBeNull();
    fireEvent.click(within(menu).getByRole("menuitem", { name: new RegExp(`^改为${to}`) }));
    expect(onReject).toHaveBeenCalledWith(proposal, dispositions[to]);
    expect(onApprove).not.toHaveBeenCalled();
  });

  it.each(["multiple", "message on proposal", "message on step", "extra step"])(
    "does not override a proposal with %s",
    (kind) => {
      const proposal = proposalFor("同意");
      const messageIntent = {
        parts: [{ kind: GQL.AffiliateMessagePartKind.Text, text: "Hello" }],
      } as GQL.ActionProposalMessageIntent;
      if (kind === "multiple") proposal.steps.push({ ...proposal.steps[0]!, stepId: "sample-2" });
      if (kind === "message on proposal") proposal.messageIntent = messageIntent;
      if (kind === "message on step") proposal.steps[0]!.messageIntent = messageIntent;
      if (kind === "extra step")
        proposal.steps.push({
          stepId: "message",
          type: GQL.ActionProposalType.SendMessage,
          messageIntent,
        } as GQL.ActionProposalStep);
      const { onApprove } = renderProposal(proposal);
      expect(screen.queryByRole("button", { name: "改为…" })).toBeNull();
      expect(screen.getByRole("button", { name: "请求重写" })).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "确认全部 Agent 建议" }));
      expect(onApprove).toHaveBeenCalledWith(proposal);
    },
  );

  it("disables every decision while submitting", () => {
    const { onApprove, onReject } = renderProposal(proposalFor("忽略"), true);
    for (const name of ["确认忽略", "请求重写", "改为…"]) {
      const button = screen.getByRole("button", { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
      fireEvent.click(button);
    }
    expect(onApprove).not.toHaveBeenCalled();
    expect(onReject).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("keeps rewrite separate from a sample decision", () => {
    const proposal = proposalFor("拒绝");
    const { onRequestRevision, onReject } = renderProposal(proposal);
    fireEvent.click(screen.getByRole("button", { name: "请求重写" }));
    expect(screen.queryByRole("button", { name: "改为…" })).toBeNull();
    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "请重新考虑近期销量" } });
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("ecommerce.shopDrawer.affiliate.sendProposalRevisionRequest"),
      }),
    );
    expect(onRequestRevision).toHaveBeenCalledWith(proposal, "请重新考虑近期销量");
    expect(onReject).not.toHaveBeenCalled();
  });

  it("provides all three dispositions in every supported language", () => {
    for (const language of Object.keys(AFFILIATE_PROPOSAL_TRANSLATIONS)) {
      for (const group of ["label", "confirm", "changeTo"]) {
        for (const action of ["APPROVE", "REJECT", "IGNORE"]) {
          const key = `ecommerce.affiliateWorkspace.sampleReviewActions.${group}.${action}`;
          expect(i18n.getResource(language, "translation", key)).toBeTruthy();
        }
      }
    }
  });
});

describe("ignoring a message proposal", () => {
  it("asks for confirmation first, then reports the decision", () => {
    const proposal = messageProposal();
    const { onIgnore, onApprove } = renderProposal(proposal);

    fireEvent.click(screen.getByRole("button", { name: "忽略" }));
    // The confirmation states the consequence: nothing is sent, and the
    // messages will not come back as new work.
    expect(screen.getByText(/不会发送任何消息/)).toBeTruthy();
    expect(onIgnore).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "确认忽略" }));
    expect(onIgnore).toHaveBeenCalledWith(proposal);
    expect(onApprove).not.toHaveBeenCalled();
  });

  it("lets the operator back out of the confirmation", () => {
    const { onIgnore, onApprove } = renderProposal(messageProposal());

    fireEvent.click(screen.getByRole("button", { name: "忽略" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(onIgnore).not.toHaveBeenCalled();
    expect(onApprove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "忽略" })).toBeTruthy();
  });

  it("stays out of a sample review, which has its own Ignore disposition", () => {
    renderProposal(proposalFor("同意"));
    expect(screen.queryByRole("button", { name: "忽略" })).toBeNull();
  });
});
