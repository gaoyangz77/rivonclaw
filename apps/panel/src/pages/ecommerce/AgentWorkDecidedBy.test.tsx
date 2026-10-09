import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GQL } from "@rivonclaw/core";
import i18n from "../../i18n/index.js";
import { ToastProvider } from "../../components/Toast.js";
import {
  AgentWorkBundleDetailModal,
  AgentWorkBundleTable,
  type AgentWorkBundle,
} from "./AffiliateManagementPage.js";

vi.mock("@apollo/client/react", () => ({
  useMutation: () => [vi.fn(), { loading: false }],
  useLazyQuery: () => [vi.fn(), { loading: false }],
  useQuery: () => ({ data: undefined, loading: false, error: undefined, refetch: vi.fn() }),
}));
vi.mock("../../store/EntityStoreProvider.js", () => ({
  useEntityStore: () => ({ shops: [], affiliateWorkspace: {} }),
}));

beforeEach(async () => {
  await i18n.changeLanguage("zh");
});
afterEach(cleanup);

function bundle(
  id: string,
  status: GQL.ActionProposalStatus,
  decisionActor: Record<string, unknown> | null,
): AgentWorkBundle {
  const proposal = {
    id,
    type: GQL.ActionProposalType.SendMessage,
    status,
    shopIds: ["shop-1"],
    focusShopId: "shop-1",
    creatorRelationshipId: `rel-${id}`,
    operatorSummary: "Work",
    createdAt: "2026-10-08T00:00:00Z",
    viewerCanAccessCurrentCreator: true,
    steps: [],
    revisionHistory: [],
    decisionActor,
    messageIntent: { parts: [{ kind: GQL.AffiliateMessagePartKind.Text, text: "Hello" }] },
  } as unknown as GQL.ActionProposal;
  return { rootProposalId: id, proposal, revisionHistory: [] };
}

const BD = { kind: "BUSINESS_DEVELOPER", displayName: "孙浩鹏", businessDeveloperId: "bd-1" };
const label = () => ({ text: "Shop", sensitive: false });

describe("Agent workbench decided-by caption", () => {
  it("names who decided a proposal under its status badge and nothing for an undecided one", () => {
    const { container } = render(
      <ToastProvider>
        <AgentWorkBundleTable
          bundles={[
            bundle("decided", GQL.ActionProposalStatus.Approved, BD),
            bundle("agent", GQL.ActionProposalStatus.Rejected, {
              kind: "AGENT",
              displayName: null,
              businessDeveloperId: null,
            }),
            bundle("pending", GQL.ActionProposalStatus.Pending, null),
          ]}
          shopLabelForId={label}
          onOpen={vi.fn()}
          onOpenCreator={vi.fn()}
        />
      </ToastProvider>,
    );

    const cells = [...container.querySelectorAll("td.affiliate-agent-work-table-status")].map(
      (cell) => cell.querySelector(".affiliate-agent-work-decided-by")?.textContent ?? null,
    );
    expect(cells).toEqual(["处理人：孙浩鹏", "处理人：Agent", null]);
  });

  it("shows the decider in the proposal detail drawer once decided", () => {
    const renderDrawer = (item: AgentWorkBundle) =>
      render(
        <ToastProvider>
          <AgentWorkBundleDetailModal
            bundle={item}
            shopLabelForId={label}
            decidingProposal={false}
            affiliateWorkspace={{} as never}
            covered={false}
            onClose={vi.fn()}
            onOpenCreator={vi.fn()}
            onApprove={vi.fn()}
            onReject={vi.fn()}
            onRequestRevision={vi.fn()}
            onIgnore={vi.fn()}
          />
        </ToastProvider>,
      );

    renderDrawer(bundle("decided", GQL.ActionProposalStatus.Approved, BD));
    expect(document.querySelector(".affiliate-agent-work-decided-by")?.textContent).toBe(
      "处理人：孙浩鹏",
    );
    cleanup();

    renderDrawer(bundle("pending", GQL.ActionProposalStatus.Pending, null));
    expect(document.querySelector(".affiliate-agent-work-decided-by")).toBeNull();
  });
});
