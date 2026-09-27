import type { DocumentNode } from "graphql";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/index.js";
import { ToastProvider } from "../../components/Toast.js";
import { CreatorRelationshipDetailModal } from "./AffiliateManagementPage.js";

const state = vi.hoisted(() => ({
  calls: [] as Array<{ operation: string; input: Record<string, unknown> }>,
  refetch: vi.fn(),
  fetchMore: vi.fn(),
  mutate: vi.fn(),
  detail: {} as Record<string, unknown>,
  samples: [] as Array<Record<string, unknown>>,
  entityStore: {
    shops: [
      { id: "1", alias: "1号店", shopName: "One" },
      { id: "2", alias: "2号店", shopName: "Two" },
    ],
    affiliateWorkspace: {
      businessDevelopers: [],
      replaceAffiliateBusinessDevelopers: vi.fn(),
      getBusinessDeveloper: vi.fn(),
    },
  },
}));
vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => state.entityStore }));
vi.mock("@apollo/client/react", () => ({
  useMutation: () => [state.mutate, { loading: false }],
  useLazyQuery: () => [state.mutate, { loading: false }],
  useQuery: (
    document: DocumentNode,
    options: { variables?: { input?: Record<string, unknown> }; skip?: boolean },
  ) => {
    const def = document.definitions.find((d) => d.kind === "OperationDefinition");
    const operation = def?.kind === "OperationDefinition" ? def.name!.value : "";
    const input = options.variables?.input ?? {};
    if (!options.skip) state.calls.push({ operation, input });
    const page = {
      items: operation === "AffiliateRelationshipSampleApplications" ? state.samples : [],
      productSummaries: [],
      hasMore: false,
      nextCursor: null,
    };
    const data: Record<string, unknown> = {
      affiliateCreatorRelationshipDetail: state.detail,
      affiliateRelationshipSampleApplications: page,
      affiliateRelationshipPlatformCollaborations: page,
      affiliateActionProposalPage: page,
      affiliateCreatorMessageHistory: { items: [], hasMore: false },
      affiliateRelationshipTimeline: { items: [], hasOlder: false },
    };
    return { data, loading: false, refetch: state.refetch, fetchMore: state.fetchMore };
  },
}));

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  state.calls.length = 0;
  state.samples = [];
  state.mutate.mockReset().mockResolvedValue({ data: {} });
  state.detail = {
    creator: {
      id: "creator-profile",
      displayName: "Test Creator",
      nickname: "Test Creator",
      username: "tester",
      platformCreatorId: "platform",
      bioDescription: "Global biography",
      performances: [],
    },
    creatorRelationship: {
      id: "creator",
      shopStates: [
        { shopId: "1", sampleTier: "SAMPLE_DELIVERED" },
        { shopId: "2", sampleTier: "SAMPLE_FULFILLED" },
      ],
      agendaItems: [],
      manualTags: [],
      systemTags: [],
      workSummary: { agentRequiredCount: 0, staffRequiredCount: 0, externalWaitingCount: 0 },
    },
    includedShopIds: ["1", "2"],
    counts: {
      sampleApplicationCount: 7,
      platformCollaborationCount: 9,
      pendingProposalCount: 0,
      lifecycleEventCount: 0,
    },
    shopActivitySummaries: [
      {
        shopId: "1",
        sampleApplicationCount: 2,
        platformCollaborationCount: 3,
        pendingProposalCount: 0,
        agendaItemCount: 0,
      },
      {
        shopId: "2",
        sampleApplicationCount: 5,
        platformCollaborationCount: 6,
        pendingProposalCount: 0,
        agendaItemCount: 0,
      },
    ],
  };
  Element.prototype.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

function view(
  relationshipId = "creator",
  tab: "overview" | "samples" | "conversation" = "overview",
) {
  return (
    <ToastProvider>
      <CreatorRelationshipDetailModal
        relationshipId={relationshipId}
        selectedShopId="2"
        initialTab={tab}
        onClose={vi.fn()}
      />
    </ToastProvider>
  );
}
function selectScope(shop: string) {
  fireEvent.click(screen.getByRole("button", { name: "查看范围" }));
  const popup = document.querySelector(".custom-select-dropdown")!;
  fireEvent.click(within(popup as HTMLElement).getByText(shop));
}
function openTab(label: string) {
  fireEvent.click(screen.getByRole("tab", { name: new RegExp(`^${label}`) }));
}

describe("Creator Detail scope integration", () => {
  it("starts globally even from a shop page and keeps shop scope across all entity tabs", () => {
    render(view());
    expect(screen.getByRole("button", { name: "查看范围" }).textContent).toContain("全局视角");
    selectScope("1号店");
    expect(screen.getByRole("button", { name: "查看范围" }).textContent).toContain("1号店");
    for (const label of ["样品申请", "平台合作", "沟通记录", "达人资料", "操作历史", "当前待办"]) {
      openTab(label);
      expect(screen.getByRole("button", { name: "查看范围" }).textContent).toContain("1号店");
    }
    for (const operation of [
      "AffiliateRelationshipSampleApplications",
      "AffiliateRelationshipPlatformCollaborations",
      "AffiliateActionProposals",
    ]) {
      expect(state.calls.filter((c) => c.operation === operation).at(-1)?.input.shopId).toBe("1");
    }
    expect(
      state.calls.filter((c) => c.operation === "AffiliateRelationshipTimeline").at(-1)?.input
        .shopIds,
    ).toEqual(["1"]);
    const facts = document.querySelector(".affiliate-relationship-work-side-facts")!;
    expect(facts.textContent).toContain("样品申请2");
    expect(facts.textContent).toContain("平台合作3");
    expect(document.querySelectorAll(".affiliate-relationship-shop-state")).toHaveLength(1);
    expect(
      document.querySelector(".affiliate-relationship-header-progress")?.textContent,
    ).toContain("已收样");
    expect(
      document.querySelector(".affiliate-relationship-header-progress")?.getAttribute("title"),
    ).toBe("当前店铺 · 合作进度");
    openTab("达人资料");
    expect(
      screen.getByText(i18n.t("ecommerce.affiliateWorkspace.creatorScope.profileHint")),
    ).toBeTruthy();
  });

  it("confirms discarding a draft and locks replies to the scoped shop", () => {
    render(view("creator", "conversation"));
    const textbox = screen.getByRole("textbox");
    fireEvent.change(textbox, { target: { value: "Do not send to another shop" } });
    selectScope("1号店");
    expect(
      screen.getByText(i18n.t("ecommerce.affiliateWorkspace.creatorScope.discardDraftHint")),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: i18n.t("common.cancel") }));
    expect((textbox as HTMLTextAreaElement).value).toBe("Do not send to another shop");
    expect(screen.getByRole("button", { name: "查看范围" }).textContent).toContain("全局视角");
    selectScope("1号店");
    fireEvent.click(
      screen.getByRole("button", {
        name: i18n.t("ecommerce.affiliateWorkspace.creatorScope.discardAndSwitch"),
      }),
    );
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    const shopSelector = screen.getByRole("button", {
      name: i18n.t("ecommerce.affiliateWorkspace.selectMessageShop"),
    }) as HTMLButtonElement;
    expect(shopSelector.disabled).toBe(true);
    expect(shopSelector.textContent).toContain("1号店");
  });

  it("resets to global when opening a different creator", () => {
    const instance = render(view());
    selectScope("1号店");
    instance.rerender(view("another-creator"));
    expect(screen.getByRole("button", { name: "查看范围" }).textContent).toContain("全局视角");
  });

  it("sends and then displays an optional note for a manual sample review", async () => {
    state.samples = [
      {
        id: "sample-1",
        creatorRelationshipId: "creator",
        shopId: "1",
        platformApplicationId: "platform-sample-1",
        productId: "product-1",
        productName: "Test product",
        sampleWorkStatus: "REQUEST_PENDING_REVIEW",
        reviewDisposition: "OPEN",
        reviewDispositionRevision: 1,
        projectionRevision: 3,
        platformStatus: "PENDING",
        firstObservedAt: "2026-09-27T10:00:00.000Z",
        lastObservedAt: "2026-09-27T10:00:00.000Z",
      },
    ];
    const instance = render(view("creator", "samples"));

    fireEvent.click(screen.getByRole("button", { name: "同意" }));
    fireEvent.change(screen.getByRole("textbox", { name: "操作备注（选填）" }), {
      target: { value: "库存和内容方向均已人工确认" },
    });
    fireEvent.click(screen.getByRole("button", { name: i18n.t("common.confirm") }));

    await waitFor(() => {
      expect(state.mutate).toHaveBeenCalledWith({
        variables: {
          input: expect.objectContaining({
            sampleApplicationRecordId: "sample-1",
            decision: "APPROVE",
            reviewNote: "库存和内容方向均已人工确认",
          }),
        },
      });
    });

    state.samples = [
      {
        ...state.samples[0],
        merchantReviewDecidedAt: "2026-09-27T10:05:00.000Z",
        merchantReviewActorType: "HUMAN",
        merchantReviewNote: "库存和内容方向均已人工确认",
      },
    ];
    instance.rerender(view("creator", "samples"));
    expect(screen.getByText("审核备注")).toBeTruthy();
    expect(screen.getByText("库存和内容方向均已人工确认")).toBeTruthy();
  });
});
