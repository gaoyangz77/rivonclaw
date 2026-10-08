import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "../../i18n/index.js";
import { ToastProvider } from "../../components/Toast.js";
import { AgentWorkBundleCard } from "./AffiliateManagementPage.js";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
afterEach(cleanup);

it("disables configuration approval without removing the permitted request-revision action", () => {
  const proposal = {
    id: "public-proposal",
    type: GQL.ActionProposalType.SendMessage,
    status: GQL.ActionProposalStatus.Pending,
    creatorRelationshipId: "public-creator",
    operatorSummary: "Public work",
    createdAt: "2026-10-08T00:00:00Z",
    viewerCanApprove: false,
    viewerCanAccessCurrentCreator: true,
    steps: [],
    revisionHistory: [],
    messageIntent: { parts: [{ kind: GQL.AffiliateMessagePartKind.Text, text: "Hello" }] },
  } as unknown as GQL.ActionProposal;
  render(
    <ToastProvider>
      <AgentWorkBundleCard
        proposal={proposal}
        shopLabel={{ text: "Shop", sensitive: false }}
        allowDecisionActions
        onApprove={vi.fn()}
        onRequestRevision={vi.fn()}
      />
    </ToastProvider>,
  );
  expect(
    (
      screen.getByRole("button", {
        name: i18n.t("ecommerce.shopDrawer.affiliate.requestProposalRevision"),
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
  const approval = screen.getByRole("button", { name: i18n.t("common.approve") });
  expect((approval as HTMLButtonElement).disabled).toBe(true);
});
