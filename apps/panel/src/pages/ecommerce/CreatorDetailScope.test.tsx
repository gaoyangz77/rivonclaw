import { useMemo } from "react";
import type { DocumentNode } from "graphql";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n/index.js";
import { ToastProvider } from "../../components/Toast.js";
import { CreatorRelationshipDetailModal, SampleApplicationSummaryCard } from "./AffiliateManagementPage.js";
import type { GQL } from "@rivonclaw/core";

vi.mock("../../components/inputs/MessageEmojiPicker.js", () => ({
  default: ({ onSelect }: { onSelect: (emoji: string) => void }) => (
    <button type="button" onClick={() => onSelect("😊")}>😊</button>
  ),
}));

const state = vi.hoisted(() => ({
  calls: [] as Array<{ operation: string; input: Record<string, unknown> }>,
  refetch: vi.fn(),
  refetches: new Map<string, ReturnType<typeof vi.fn>>(),
  fetchMore: vi.fn(),
  mutate: vi.fn(),
  detail: {} as Record<string, unknown>,
  contactState: {} as Record<string, unknown>,
  samples: [] as Array<Record<string, unknown>>,
  history: [] as Array<Record<string, unknown>>,
  timeline: [] as Array<Record<string, unknown>>,
  proposals: [] as Array<Record<string, unknown>>,
  storedProposals: new Map<string, Record<string, unknown>>(),
  handlers: new Map<string, Set<(payload: unknown) => void>>(),
  entityStore: {
    ensureCategories: vi.fn().mockResolvedValue(undefined),
    productCategoryName: () => null,
    shops: [
      { id: "1", alias: "1号店", shopName: "One" },
      { id: "2", alias: "2号店", shopName: "Two" },
    ],
    affiliateWorkspace: {
      businessDevelopers: [] as Array<{ id: string; displayName: string; archivedAt?: string }>,
      replaceAffiliateBusinessDevelopers: vi.fn(),
      getBusinessDeveloper: vi.fn(),
      proposalProjection: (id: string) => {
        const proposal = state.storedProposals.get(id);
        return proposal ? { proposal } : null;
      },
      upsertAffiliateActionProposal: (proposal: Record<string, any>) => {
        const current = state.storedProposals.get(proposal.id);
        if (current && Date.parse(String(current.updatedAt)) > Date.parse(proposal.updatedAt)) return;
        runInAction(() => state.storedProposals.set(proposal.id, proposal));
      },
    },
  },
}));
vi.mock("../../store/EntityStoreProvider.js", () => ({ useEntityStore: () => state.entityStore }));
vi.mock("../../lib/event-bus.js", () => ({ panelEventBus: {
  subscribe: (event: string, handler: (payload: unknown) => void) => {
    const handlers = state.handlers.get(event) ?? new Set();
    handlers.add(handler);
    state.handlers.set(event, handlers);
    return () => handlers.delete(handler);
  },
} }));
vi.mock("@apollo/client/react", () => ({
  useApolloClient: () => ({ mutate: state.mutate, query: state.refetch }),
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
    const data = useMemo(() => {
      const page = {
        items: operation === "AffiliateRelationshipSampleApplications" ? state.samples
          : operation === "AffiliateActionProposals" ? state.proposals : [],
        productSummaries: [],
        hasMore: false,
        nextCursor: null,
      };
      return {
        affiliateCreatorRelationshipDetail: state.detail,
        affiliateCreatorContactState: state.contactState,
        affiliateChatCampaignTemplates: [],
        affiliateRelationshipSampleApplications: page,
        affiliateRelationshipPlatformCollaborations: page,
        affiliateActionProposalPage: page,
        affiliateCreatorMessageHistory: { items: state.history, hasMore: false },
        affiliateRelationshipTimeline: { items: state.timeline, hasOlder: false },
      };
    }, [operation, state.detail, state.contactState, state.samples, state.proposals, state.history, state.timeline]);
    if (!state.refetches.has(operation)) {
      state.refetches.set(operation, vi.fn(() => state.refetch(operation)));
    }
    return { data: options.skip ? undefined : data, loading: false,
      refetch: state.refetches.get(operation), fetchMore: state.fetchMore };
  },
}));

beforeEach(async () => {
  await i18n.changeLanguage("zh");
  state.calls.length = 0;
  state.contactState = { channelContacts: [], whatsAppAccounts: [], emailAccounts: [] };
  state.samples = [];
  state.history = [];
  state.timeline = [];
  state.proposals = [];
  state.storedProposals = observable.map([], { deep: false });
  state.handlers.clear();
  state.refetch.mockReset();
  state.refetches.clear();
  state.mutate.mockReset().mockResolvedValue({ data: {} });
  state.detail = {
    viewerCanPerformDailyOperations: true,
    viewerCanEditCreatorConfiguration: true,
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

describe("Sample card order facts", () => {
  function card(orderId: string | null, tracking: Partial<GQL.SampleApplicationOrderRecord> = {}) {
    const sample = { id: "sample-order", shopId: "1", platformApplicationId: "application-order",
      sampleWorkStatus: "APPROVED_AWAITING_SHIPMENT", updatedAt: "2026-10-15T00:00:00.000Z",
      observedContentCount: 0, order: { platformOrderId: orderId, trackingNumber: "TRACK-123", ...tracking },
    } as GQL.SampleApplicationRecord;
    return <ToastProvider><SampleApplicationSummaryCard sampleApplication={sample} embedded /></ToastProvider>;
  }
  it("shows a separately labelled copyable order ID without confusing it with tracking", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(card("1234567890123456789"));
    expect(screen.getByText("订单号")).toBeTruthy();
    expect(screen.getByText("TRACK-123")).toBeTruthy();
    fireEvent.click(screen.getByText("1234567890123456789").closest("button")!);
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("1234567890123456789"));
  });
  it("shows the persisted shipping snapshot inside the Sample card", () => {
    render(card("123", { status: "IN_TRANSIT", trackingSyncedAt: "2026-10-20T00:00:00Z",
      latestTrackingEventAt: "2026-10-19T00:00:00Z", latestTrackingEventDescription: "Out for delivery" }));
    const shipment = screen.getByRole("region", { name: "物流状态" });
    expect(shipment.parentElement?.classList.contains("affiliate-collaboration-sample-grid")).toBe(true);
    expect(shipment.querySelectorAll(".affiliate-sample-shipment-summary > .affiliate-entity-fact")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "查看详情" }).classList.contains("tk-v1-button-secondary")).toBe(true);
    expect(screen.getByText("运输中")).toBeTruthy();
    expect(screen.getByText("Out for delivery")).toBeTruthy();
    expect(screen.getByText("TRACK-123")).toBeTruthy();
  });
  it.each([null, "0"])("shows unavailable instead of %s", orderId => {
    render(card(orderId));
    expect(screen.getByText("暂未获取")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
  });
});

function view(
  relationshipId = "creator",
  tab: "overview" | "samples" | "platform" | "profile" | "conversation" | "activity" = "overview",
  businessDeveloperOnly = false,
) {
  return (
    <ToastProvider>
      <CreatorRelationshipDetailModal
        relationshipId={relationshipId}
        selectedShopId="2"
        initialTab={tab}
        businessDeveloperOnly={businessDeveloperOnly}
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

describe("public Creator claim visibility", () => {
  it("keeps a colleague's samples and messages readable without review or reply controls", () => {
    state.detail.viewerCanPerformDailyOperations = false;
    state.detail.viewerCanEditCreatorConfiguration = false;
    (state.detail.creatorRelationship as Record<string, unknown>).businessDeveloperId = "colleague";
    state.samples = [{
      id: "sample-read-only", creatorRelationshipId: "creator", shopId: "1",
      platformApplicationId: "application-read-only", productId: "product-read-only",
      sampleWorkStatus: "REQUEST_PENDING_REVIEW", reviewDisposition: "OPEN",
      reviewDispositionRevision: 1, projectionRevision: 1,
      firstObservedAt: "2026-10-01T00:00:00Z", lastObservedAt: "2026-10-01T00:00:00Z",
    }];
    const instance = render(view("creator", "samples", true));
    expect(document.querySelector(".affiliate-workbench-sample-review-card")).not.toBeNull();
    const banner = screen.getByText(i18n.t("ecommerce.affiliateWorkspace.workbench.otherBdReadOnly")).closest(".affiliate-relationship-readonly-banner")!;
    expect(banner).not.toBeNull();
    expect(banner.previousElementSibling?.classList.contains("modal-header")).toBe(true);
    expect(banner.nextElementSibling?.classList.contains("affiliate-relationship-workspace-body")).toBe(true);
    expect(banner.closest(".affiliate-collaboration-tab-panel")).toBeNull();
    expect(screen.queryByRole("button", { name: "同意" })).toBeNull();
    expect(screen.queryByRole("button", { name: "拒绝" })).toBeNull();
    expect(screen.queryByRole("button", { name: "忽略" })).toBeNull();
    instance.rerender(view("creator", "conversation", true));
    expect(screen.getAllByText(i18n.t("ecommerce.affiliateWorkspace.workbench.otherBdReadOnly"))).toHaveLength(1);
    expect(document.querySelector(".affiliate-relationship-readonly-banner")).toBe(banner);
    expect(document.querySelector(".affiliate-message-composer")).toBeNull();
    expect(state.calls.some(call => call.operation === "AffiliateCreatorMessageHistory")).toBe(true);
    expect(state.mutate).not.toHaveBeenCalled();
  });

  it("retains daily operations on a public Creator without granting configuration rights", () => {
    state.detail.viewerCanEditCreatorConfiguration = false;
    render(view("creator", "conversation", true));
    expect(document.querySelector(".affiliate-message-composer")).not.toBeNull();
    expect(screen.queryByText(i18n.t("ecommerce.affiliateWorkspace.workbench.otherBdReadOnly"))).toBeNull();
  });

  it("offers self-claim to BD staff on a public Creator", () => {
    render(view("creator", "overview", true));
    fireEvent.click(screen.getByRole("tab", { name: "关系管理" }));
    expect(screen.getByRole("button", { name: "认领给我" })).toBeTruthy();
  });
  it("does not offer self-claim on an assigned Creator", () => {
    (state.detail.creatorRelationship as Record<string, unknown>).businessDeveloperId = "bd";
    render(view("creator", "overview", true));
    fireEvent.click(screen.getByRole("tab", { name: "关系管理" }));
    expect(screen.queryByRole("button", { name: "认领给我" })).toBeNull();
  });
  it("hides self-claim on protected public Creators but retains release for protected owners", () => {
    state.detail.protection = { id: "protection", note: "Protected" };
    const instance = render(view("creator", "overview", true));
    fireEvent.click(screen.getByRole("tab", { name: "关系管理" }));
    expect(screen.queryByRole("button", { name: "认领给我" })).toBeNull();
    (state.detail.creatorRelationship as Record<string, unknown>).businessDeveloperId = "bd";
    instance.rerender(view("creator", "overview", true));
    expect(screen.getByRole("button", { name: "退回公池" })).toBeTruthy();
  });
  it("keeps the supervisor's existing reassignment control", () => {
    render(view());
    fireEvent.click(screen.getByRole("tab", { name: "关系管理" }));
    expect(screen.queryByRole("button", { name: "认领给我" })).toBeNull();
  });
  it.each([true, false])("offers release to an authorized owner/supervisor (BD-only=%s)", businessDeveloperOnly => {
    (state.detail.creatorRelationship as Record<string, unknown>).businessDeveloperId = "bd";
    render(view("creator", "overview", businessDeveloperOnly));
    fireEvent.click(screen.getByRole("tab", { name: "关系管理" }));
    expect(screen.getByRole("button", { name: "退回公池" })).toBeTruthy();
  });
  it("does not offer release for public Creators or without configuration permission", () => {
    state.detail.viewerCanEditCreatorConfiguration = false;
    (state.detail.creatorRelationship as Record<string, unknown>).businessDeveloperId = "bd";
    render(view("creator", "overview", true));
    fireEvent.click(screen.getByRole("tab", { name: "关系管理" }));
    expect(screen.queryByRole("button", { name: "退回公池" })).toBeNull();
  });
});

describe("live proposal state inside Creator details", () => {
  function pending(id = "proposal-old") {
    return {
      id, userId: "user", creatorRelationshipId: "creator", shopIds: ["1"],
      type: "SEND_MESSAGE", status: "PENDING", operatorSummary: `Reply ${id}`,
      createdAt: "2026-10-14T10:27:06Z", updatedAt: "2026-10-14T10:27:06Z",
      steps: [], revisionHistory: [], messageIntent: { parts: [{ kind: "TEXT", text: "Hola" }] },
    };
  }
  function superseded() {
    return { ...pending(), status: "SUPERSEDED", updatedAt: "2026-10-14T10:27:48Z" };
  }
  function receive(proposal: Record<string, unknown>) {
    act(() => {
      for (const handler of state.handlers.get("affiliate-action-proposal-changed") ?? []) handler({ proposal });
    });
  }
  it("removes decisions immediately when invalidated with an Ignore confirmation open, despite the old query snapshot", async () => {
    state.proposals = [pending()];
    const rendered = render(view());
fireEvent.click(screen.getByRole("button", { name: "忽略" }));
    expect(screen.getByRole("button", { name: "确认忽略" })).toBeTruthy();
    receive(superseded());
    await waitFor(() => expect(screen.queryByRole("button", { name: "确认忽略" })).toBeNull());
    rendered.rerender(view());
    expect(screen.queryByRole("button", { name: "忽略" })).toBeNull();
    expect(state.mutate).not.toHaveBeenCalled();
  });
  it("treats a stale Ignore response as a state refresh, never a successful ignore", async () => {
    state.proposals = [pending()];
    state.mutate.mockResolvedValue({ data: { decideActionProposal: superseded() } });
    render(view());
    fireEvent.click(screen.getByRole("button", { name: "忽略" }));
    fireEvent.click(screen.getByRole("button", { name: "确认忽略" }));
    await waitFor(() => expect(screen.getByText("这条建议已不可操作，当前待办已更新，请查看最新建议。")).toBeTruthy());
    expect(document.querySelector('.toast-warning')).toBeTruthy();
    expect(document.querySelector('.toast-success')).toBeNull();
    expect(screen.queryByRole("button", { name: "忽略" })).toBeNull();
  });
  it("does not resurrect the captured Pending proposal when a request fails after an invalidation event", async () => {
    state.proposals = [pending()];
    let reject: (error: Error) => void = () => {};
    state.mutate.mockReturnValue(new Promise((_resolve, no) => { reject = no; }));
    render(view());
    fireEvent.click(screen.getByRole("button", { name: "忽略" }));
    fireEvent.click(screen.getByRole("button", { name: "确认忽略" }));
    receive(superseded());
    await act(async () => reject(new Error("Network unavailable")));
    await waitFor(() => expect(screen.getByText("Network unavailable")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "忽略" })).toBeNull();
    expect(document.querySelector('.toast-success')).toBeNull();
    expect(state.refetch).toHaveBeenCalled();
  });
  it("does not reactivate a hidden proposal or activity query when a decision finishes after switching tabs", async () => {
    state.proposals = [pending()];
    let finish!: (value: unknown) => void;
    state.mutate.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(view());
    fireEvent.click(screen.getByRole("button", { name: "忽略" }));
    fireEvent.click(screen.getByRole("button", { name: "确认忽略" }));
    openTab("沟通记录");
    state.refetch.mockClear();
    await act(async () => finish({ data: { decideActionProposal: { ...pending(), status: "IGNORED" } } }));
    expect(state.refetch.mock.calls.map(call => call[0])).toEqual(["AffiliateCreatorRelationshipDetail"]);
  });
  it("keeps a genuinely new proposal actionable without reviving the old one", async () => {
    state.proposals = [pending(), pending("proposal-new")];
    render(view());
    receive(superseded());
    await waitFor(() => expect(screen.getAllByRole("button", { name: "忽略" })).toHaveLength(1));
    expect(screen.getByText("Reply proposal-new")).toBeTruthy();
  });
});

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

  it("names the reviewer of a Sample Application, falling back to the generic label", () => {
    const reviewed = {
      id: "sample-1",
      creatorRelationshipId: "creator",
      shopId: "1",
      platformApplicationId: "platform-sample-1",
      productId: "product-1",
      sampleWorkStatus: "REQUEST_PENDING_REVIEW",
      reviewDisposition: "OPEN",
      reviewDispositionRevision: 1,
      projectionRevision: 3,
      platformStatus: "PENDING",
      firstObservedAt: "2026-09-27T10:00:00.000Z",
      lastObservedAt: "2026-09-27T10:00:00.000Z",
      merchantReviewDecidedAt: "2026-09-27T10:05:00.000Z",
    };
    state.samples = [
      {
        ...reviewed,
        id: "sample-bd",
        merchantReviewActorType: "HUMAN",
        merchantReviewActor: { kind: "BUSINESS_DEVELOPER", displayName: "孙浩鹏" },
      },
      {
        ...reviewed,
        id: "sample-agent",
        merchantReviewActorType: "AGENT",
        merchantReviewActor: { kind: "AGENT", displayName: null },
      },
      // Older payloads carry only the coarse actor type.
      { ...reviewed, id: "sample-legacy", merchantReviewActorType: "HUMAN" },
    ];
    render(view("creator", "samples"));

    const lines = [...document.querySelectorAll(".affiliate-workbench-review-attribution")].map(
      (node) => node.textContent ?? "",
    );
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/^孙浩鹏 于 .+ 处理$/);
    expect(lines[1]).toMatch(/^Agent 于 .+ 处理$/);
    expect(lines[2]).toMatch(/^员工 于 .+ 处理$/);
  });

  it("shows who performed each timeline event and keeps the generic marker when none is recorded", () => {
    const event = (id: string, actor: Record<string, unknown> | null) => ({
      id,
      kind: "ACTION_EVENT",
      occurredAt: "2026-09-27T10:00:00.000Z",
      actorType: "HUMAN",
      actorRole: "STAFF",
      actor,
      summary: "",
      relatedIds: {},
      actionEvent: { eventType: "SAMPLE_APPROVED", actorRole: "STAFF" },
      businessEvent: null,
      message: null,
      timePassed: null,
    });
    state.timeline = [
      event("event-bd", { kind: "BUSINESS_DEVELOPER", displayName: "孙浩鹏" }),
      event("event-owner", { kind: "OWNER", displayName: null }),
      event("event-none", null),
    ];
    render(view("creator", "activity"));

    const metas = [...document.querySelectorAll(".affiliate-timeline-meta")].map(
      (node) => node.firstElementChild?.textContent ?? "",
    );
    expect(metas).toEqual([
      "孙浩鹏",
      "主账号",
      i18n.t("ecommerce.affiliateWorkspace.historyActors.STAFF_ACTION"),
    ]);
  });

  it("captions an outbound message with its sender and leaves other messages bare", () => {
    const message = (messageRef: string, direction: string, sentBy: unknown) => ({
      channel: "WHATSAPP",
      direction,
      messageRef,
      parts: [{ kind: "TEXT", text: `text ${messageRef}` }],
      createdAt: "2026-09-27T10:00:00.000Z",
      source: "TEST",
      sentBy,
    });
    state.history = [
      message("m1", "SELLER", { kind: "BUSINESS_DEVELOPER", displayName: "孙浩鹏" }),
      message("m2", "SELLER", { kind: "AGENT", displayName: null }),
      message("m3", "SELLER", null),
      message("m4", "CREATOR", null),
    ];
    render(view("creator", "conversation"));

    const rows = [...document.querySelectorAll(".affiliate-conversation-message-row")];
    expect(rows).toHaveLength(4);
    expect(rows[0]!.textContent).toContain("孙浩鹏 发送");
    expect(rows[1]!.textContent).toContain("Agent 发送");
    expect(rows[2]!.textContent).not.toContain("发送");
    expect(rows[3]!.textContent).not.toContain("发送");
  });
  it("captions scoped outbound messages with their sender from the shop timeline", () => {
    const item = (id: string, direction: string, sentBy: Record<string, unknown> | null) => ({
      id,
      kind: "MESSAGE",
      occurredAt: "2026-09-27T10:00:00.000Z",
      actor: null,
      sentBy,
      summary: "",
      relatedIds: { shopId: "1" },
      message: {
        channel: "WHATSAPP",
        direction,
        messageRef: id,
        parts: [{ kind: "TEXT", text: `text ${id}` }],
      },
    });
    state.timeline = [
      item("t1", "SELLER", { kind: "BUSINESS_DEVELOPER", displayName: "孙浩鹏" }),
      item("t2", "SELLER", { kind: "AGENT", displayName: null }),
      item("t3", "SELLER", null),
      item("t4", "CREATOR", null),
    ];
    render(view("creator", "conversation"));
    selectScope("1号店");

    const rows = [...document.querySelectorAll(".affiliate-conversation-message-row")];
    expect(rows).toHaveLength(4);
    expect(rows[0]!.textContent).toContain("孙浩鹏 发送");
    expect(rows[1]!.textContent).toContain("Agent 发送");
    expect(rows[2]!.textContent).not.toContain("发送");
    expect(rows[3]!.textContent).not.toContain("发送");
  });
});

describe("Creator Detail for a business developer (ADR 085)", () => {
  const ALICE = { id: "bd-alice", displayName: "Alice" };

  beforeEach(() => {
    state.entityStore.affiliateWorkspace.businessDevelopers = [ALICE];
    state.entityStore.affiliateWorkspace.getBusinessDeveloper.mockImplementation((id: string) =>
      id === ALICE.id ? ALICE : undefined,
    );
    const relationship = state.detail.creatorRelationship as Record<string, unknown>;
    relationship.businessDeveloperId = ALICE.id;
    relationship.manualTags = [{ id: "tag-vip", name: "VIP", sensitive: false }];
  });
  afterEach(() => {
    state.entityStore.affiliateWorkspace.businessDevelopers = [];
    state.entityStore.affiliateWorkspace.getBusinessDeveloper.mockReset();
  });

  function openManagement() {
    fireEvent.click(
      screen.getByRole("tab", {
        name: i18n.t("ecommerce.affiliateWorkspace.relationshipInspectorManagement"),
      }),
    );
  }
  const ownerCard = () => document.querySelector(".affiliate-relationship-owner-card")!;
  const renameLabel = () =>
    i18n.t("ecommerce.affiliateWorkspace.manualTags.rename", { name: "VIP" });
  const removeLabel = () =>
    i18n.t("ecommerce.affiliateWorkspace.manualTags.remove", { name: "VIP" });
  const createLabel = () =>
    i18n.t("ecommerce.affiliateWorkspace.manualTags.createAndAdd", { name: "New label" });
  function searchNewTag() {
    fireEvent.change(
      screen.getByRole("textbox", {
        name: i18n.t("ecommerce.affiliateWorkspace.manualTags.searchLabel"),
      }),
      { target: { value: "New label" } },
    );
  }

  it("shows the owning BD as text and offers no owner reassignment", () => {
    render(view("creator", "overview", true));
    openManagement();

    expect(ownerCard().querySelector("label")).toBeNull();
    expect(ownerCard().querySelector(".affiliate-relationship-owner-value")?.textContent).toContain(
      "Alice",
    );
  });

  it("keeps assigning and removing tags but withholds creating and renaming them", () => {
    render(view("creator", "overview", true));
    openManagement();
    searchNewTag();

    expect(screen.getByRole("button", { name: removeLabel() })).toBeTruthy();
    expect(screen.queryByRole("button", { name: renameLabel() })).toBeNull();
    expect(screen.queryByRole("button", { name: createLabel() })).toBeNull();
  });

  it("keeps owner reassignment and tag catalog edits for a supervisor", () => {
    render(view("creator", "overview", false));
    openManagement();
    searchNewTag();

    expect(ownerCard().querySelector("label")).not.toBeNull();
    expect(ownerCard().querySelector(".affiliate-relationship-owner-value")).toBeNull();
    expect(screen.getByRole("button", { name: removeLabel() })).toBeTruthy();
    expect(screen.getByRole("button", { name: renameLabel() })).toBeTruthy();
    expect(screen.getByRole("button", { name: createLabel() })).toBeTruthy();
  });
});


describe("Creator detail loads only visible collections", () => {
  const summary = "AffiliateCreatorRelationshipDetail";
  function queried() { return [...new Set(state.calls.map(c => c.operation))].sort(); }
  it.each([
    ["conversation", ["AffiliateCreatorMessageHistory", "AffiliateChatCampaignTemplates"]],
    ["overview", ["AffiliateActionProposals"]],
    ["samples", ["AffiliateRelationshipSampleApplications"]],
    ["platform", ["AffiliateRelationshipPlatformCollaborations"]],
    ["profile", ["AffiliateCreatorProfile"]],
    ["activity", ["AffiliateRelationshipTimeline"]],
  ] as const)("opens %s without querying other tabs", (tab, operations) => {
    render(view("creator", tab));
    expect(queried()).toEqual([summary, ...operations].sort());
    // Collection counts remain available before their tabs have been opened.
    expect(screen.getByRole("tab", { name: /^样品申请/ }).textContent).toContain("7");
    expect(screen.getByRole("tab", { name: /^平台合作/ }).textContent).toContain("9");
  });
  it("loads the management directory and global tag history only when that inspector is visible", () => {
    render(view("creator", "conversation"));
    selectScope("1号店");
    state.calls.length = 0;
    fireEvent.click(screen.getByRole("tab", { name: "关系管理" }));
    expect(queried()).toEqual([summary, "AffiliateBusinessDevelopers", "AffiliateChatCampaignTemplates",
      "AffiliateRelationshipTimeline", "AffiliateCreatorSystemTagDefinitions", "CreatorManualTags"].sort());
    expect(state.calls.some(c => c.operation === "AffiliateRelationshipTimeline" && !c.input.shopIds)).toBe(true);
    state.calls.length = 0;
    fireEvent.click(document.querySelector('.affiliate-context-inspector-close')!);
    expect(queried()).not.toContain("AffiliateBusinessDevelopers");
    // The scoped conversation still uses its shop timeline for messages.
    expect(state.calls.some(c => c.operation === "AffiliateRelationshipTimeline" && !c.input.shopIds)).toBe(false);
    expect(queried()).not.toContain("CreatorManualTags");
  });
  it("does not refresh inactive collections on focus or reconnect, including after switching tabs", async () => {
    render(view("creator", "conversation"));
    act(() => {
      for (const handler of state.handlers.get("entity-snapshot") ?? []) handler({});
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() => expect(state.refetch).toHaveBeenCalled());
    expect(state.refetch.mock.calls.map(call => call[0]).sort()).toEqual([summary, "AffiliateCreatorMessageHistory"].sort());
    openTab("样品申请");
    state.refetch.mockClear();
    act(() => {
      for (const handler of state.handlers.get("affiliate-workbench-changed") ?? []) handler({creatorRelationshipId: "creator"});
    });
    await waitFor(() => expect(state.refetch).toHaveBeenCalled());
    expect(state.refetch.mock.calls.map(call => call[0]).sort()).toEqual([summary, "AffiliateRelationshipSampleApplications"].sort());
  });
});


describe("manual message submission and history refresh", () => {
  const accepted = { data: { sendAffiliateCreatorMessage: { delivery: { id: "delivery-1", status: "SENT" } } } };
  function compose(text = "Hola, gracias") {
    fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });
  }
  function send() { fireEvent.click(screen.getByRole("button", { name: "发送" })); }

  it("inserts emoji in the creator reply and sends it as text only after Send is clicked", async () => {
    state.mutate.mockResolvedValue(accepted);
    render(view("creator", "conversation"));
    compose("Hola, gracias ");
    const input = screen.getByRole<HTMLTextAreaElement>("textbox");
    input.setSelectionRange(input.value.length, input.value.length);
    fireEvent.click(screen.getByRole("button", { name: "表情" }));
    const picker = await screen.findByRole("dialog", { name: "表情" });
    fireEvent.click(await within(picker).findByRole("button", { name: "😊" }));
    expect(input.value).toBe("Hola, gracias 😊");
    expect(state.mutate).not.toHaveBeenCalled();
    send();
    await waitFor(() => expect(state.mutate).toHaveBeenCalledOnce());
    expect(state.mutate.mock.calls[0][0].variables.input.parts).toEqual([
      { kind: "TEXT", text: "Hola, gracias 😊" },
    ]);
  });

  it("acknowledges delivery and releases the composer while history is still pending", async () => {
    state.mutate.mockResolvedValue(accepted);
    state.refetch.mockReturnValue(new Promise(() => {}));
    render(view("creator", "conversation"));
    compose(); send();
    await waitFor(() => expect(screen.getByText("消息已提交，正在更新记录")).toBeTruthy());
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    expect(screen.getByText("请勿重复发送；可刷新记录确认最新消息。")).toBeTruthy();
    compose("A different next message");
    expect((screen.getByRole("button", { name: "发送" }) as HTMLButtonElement).disabled).toBe(false);
    expect(state.mutate).toHaveBeenCalledTimes(1);
    expect(state.mutate.mock.calls[0][0].variables.input.idempotencyKey).toMatch(/^human-ui:/);
  });

  it("queues a fresh history read when another message is accepted during the first read", async () => {
    let finishFirst!: (value: unknown) => void;
    state.refetch.mockReturnValueOnce(new Promise(resolve => { finishFirst = resolve; })).mockResolvedValue(undefined);
    state.mutate.mockResolvedValue(accepted);
    render(view("creator", "conversation"));
    compose(); send();
    await waitFor(() => expect(state.refetch).toHaveBeenCalledTimes(1));
    compose("Next message"); send();
    await waitFor(() => expect(state.mutate).toHaveBeenCalledTimes(2));
    expect(state.refetch).toHaveBeenCalledTimes(1);
    await act(async () => finishFirst(undefined));
    await waitFor(() => expect(state.refetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByText("消息已提交，正在更新记录")).toBeNull();
    expect(state.mutate.mock.calls[0][0].variables.input.idempotencyKey).not.toBe(state.mutate.mock.calls[1][0].variables.input.idempotencyKey);
  });

  it("treats a failed history refresh as a read failure and retries only the read", async () => {
    state.mutate.mockResolvedValue(accepted);
    state.refetch.mockRejectedValueOnce(new Error("History timed out")).mockResolvedValue(undefined);
    render(view("creator", "conversation"));
    compose(); send();
    await waitFor(() => expect(screen.getByText("消息已提交，但记录刷新失败")).toBeTruthy());
    expect(screen.queryByText("消息发送失败")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "刷新" }));
    await waitFor(() => expect(screen.queryByText("消息已提交，但记录刷新失败")).toBeNull());
    expect(state.mutate).toHaveBeenCalledTimes(1);
    expect(state.refetch).toHaveBeenCalledTimes(2);
  });

  it("reuses the draft idempotency key after an uncertain transport failure", async () => {
    state.mutate.mockRejectedValueOnce(new Error("Network timeout")).mockResolvedValue(accepted);
    render(view("creator", "conversation"));
    compose(); send();
    await waitFor(() => expect(screen.getByText("Network timeout")).toBeTruthy());
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Hola, gracias");
    send();
    await waitFor(() => expect(screen.getByText("消息已提交")).toBeTruthy());
    const inputs = state.mutate.mock.calls.map(call => call[0].variables.input);
    expect(inputs).toHaveLength(2);
    expect(inputs[0].idempotencyKey).toBe(inputs[1].idempotencyKey);
  });

  it("blocks two clicks in the same render before disabled state is applied", async () => {
    let finish!: (value: unknown) => void;
    state.mutate.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(view("creator", "conversation"));
    compose();
    const button = screen.getByRole("button", { name: "发送" });
    act(() => {
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(state.mutate).toHaveBeenCalledTimes(1);
    await act(async () => finish(accepted));
  });

  it("creates a new attempt after an authoritative failed delivery", async () => {
    state.mutate.mockResolvedValueOnce({data: {sendAffiliateCreatorMessage: {delivery: {status: "FAILED", errorCode: "TikTokApiError", errorMessage: "Quota rejected"}}}})
      .mockResolvedValue(accepted);
    render(view("creator", "conversation"));
    compose(); send();
    await waitFor(() => expect(screen.getByText("Quota rejected")).toBeTruthy());
    send();
    await waitFor(() => expect(screen.getByText("消息已提交")).toBeTruthy());
    const inputs = state.mutate.mock.calls.map(call => call[0].variables.input);
    expect(inputs[0].idempotencyKey).not.toBe(inputs[1].idempotencyKey);
  });

  it("does not create a new send for an ambiguous provider transport failure labelled FAILED", async () => {
    state.mutate.mockResolvedValue({data: {sendAffiliateCreatorMessage: {delivery: {status: "FAILED", errorCode: "AbortError", errorMessage: "Provider timeout"}}}});
    render(view("creator", "conversation"));
    compose(); send();
    await waitFor(() => expect(screen.getByText("Provider timeout")).toBeTruthy());
    send();
    await waitFor(() => expect(state.mutate).toHaveBeenCalledTimes(2));
    expect(state.mutate.mock.calls[0][0].variables.input.idempotencyKey).toBe(state.mutate.mock.calls[1][0].variables.input.idempotencyKey);
  });

  it("keeps partial deliveries on the same key, and changes keys when an unsent draft is edited", async () => {
    state.mutate.mockResolvedValue({data: {sendAffiliateCreatorMessage: {delivery: {status: "PARTIALLY_SENT", errorMessage: "One part accepted"}}}});
    render(view("creator", "conversation"));
    compose(); send();
    await waitFor(() => expect(screen.getByText("One part accepted")).toBeTruthy());
    send();
    await waitFor(() => expect(state.mutate).toHaveBeenCalledTimes(2));
    expect(state.mutate.mock.calls[0][0].variables.input.idempotencyKey).toBe(state.mutate.mock.calls[1][0].variables.input.idempotencyKey);
    compose("Edited draft"); send();
    await waitFor(() => expect(state.mutate).toHaveBeenCalledTimes(3));
    expect(state.mutate.mock.calls[2][0].variables.input.idempotencyKey).not.toBe(state.mutate.mock.calls[0][0].variables.input.idempotencyKey);
  });

  it("explains an HTML 413 upload response without trying to parse it as JSON", async () => {
    const json = vi.fn();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 413, ok: false, json } as unknown as Response);
    try {
      render(view("creator", "conversation"));
      fireEvent.change(document.querySelector('input[type="file"]')!, {target: { files: [new File(["image"], "photo.jpg", {type: "image/jpeg"})] }});
      await waitFor(() => expect(screen.getByText("图片或附件超过上传大小限制，请压缩或选择较小的文件后重试。")).toBeTruthy());
      expect(json).not.toHaveBeenCalled();
      expect(state.mutate).not.toHaveBeenCalled();
    } finally { fetchMock.mockRestore(); }
  });
});

describe("channel-first manual reply routing", () => {
  function selectReplyChannel(label: string) {
    fireEvent.click(screen.getByRole("button", { name: "回复渠道" }));
    const popup = document.querySelector(".custom-select-dropdown")!;
    fireEvent.click(within(popup as HTMLElement).getByRole("button", { name: label }));
  }
  function contacts() {
    state.detail = { ...state.detail, creatorRelationship: { ...(state.detail.creatorRelationship as object), businessDeveloperId: "bd-1" } };
    state.contactState = {
      preferredWhatsAppAccount: { id: "wa-a" },
      whatsAppAccounts: [
        { id: "wa-a", displayName: "WA Account A", status: "CONNECTED", provider: "EVOLUTION_API" },
        { id: "wa-b", displayName: "WA Account B", status: "CONNECTED", provider: "EVOLUTION_API" },
      ],
      emailAccounts: [{ id: "mail-a", displayName: "Email Account", status: "CONNECTED", provider: "MICROSOFT_GRAPH" }],
      channelContacts: [
        { id: "wa-contact-a", accountBindingId: "wa-a", channel: "WHATSAPP", status: "ACTIVE", lastObservedAt: "2026-10-20T00:00:00Z" },
        { id: "wa-contact-b", accountBindingId: "wa-b", channel: "WHATSAPP", status: "ACTIVE", lastObservedAt: "2026-10-20T00:00:00Z" },
        { id: "mail-contact", accountBindingId: "mail-a", channel: "EMAIL", status: "ACTIVE", lastObservedAt: "2026-10-20T00:00:00Z" },
      ],
    };
  }
  it("queries account routes only for external channels, honors the selected account and sends without a shop", async () => {
    contacts(); state.mutate.mockResolvedValue({ data: { sendAffiliateCreatorMessage: { delivery: { status: "SENT" } } } });
    render(view("creator", "conversation"));
    expect(state.calls.some(call => call.operation === "AffiliateCreatorContactState")).toBe(false);
    const route = document.querySelector(".affiliate-message-composer-route")!;
    expect(route.firstElementChild?.textContent).toContain("店铺后台私信");
    selectReplyChannel("WhatsApp");
    expect(screen.queryByRole("button", { name: i18n.t("ecommerce.affiliateWorkspace.selectMessageShop") })).toBeNull();
    expect(screen.queryByRole("button", { name: "发送定邀" })).toBeNull();
    expect(state.calls.some(call => call.operation === "AffiliateCreatorContactState")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "选择发送账号" }));
    fireEvent.click(screen.getByRole("button", { name: "WA Account B" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Reply via the chosen WhatsApp account" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));
    await waitFor(() => expect(state.mutate).toHaveBeenCalledOnce());
    expect(state.mutate.mock.calls[0][0].variables.input).toMatchObject({ preferredChannel: "WHATSAPP", channelContactId: "wa-contact-b" });
    expect(state.mutate.mock.calls[0][0].variables.input.shopId).toBeUndefined();
    selectReplyChannel(i18n.t("ecommerce.affiliateWorkspace.messageChannels.EMAIL"));
    expect(screen.getByRole("button", { name: "选择发送账号" }).textContent).toContain("Email Account");
    selectReplyChannel("店铺后台私信");
    expect(screen.getByRole("button", { name: i18n.t("ecommerce.affiliateWorkspace.selectMessageShop") })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "选择发送账号" })).toBeNull();
  });
  it("shows a disabled send and no shop controls when the selected channel has no usable account", () => {
    render(view("creator", "conversation")); selectReplyChannel("WhatsApp");
    expect(screen.getByText("当前渠道暂无可用于联系此达人的账号。")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Unroutable draft" } });
    expect((screen.getByRole("button", { name: "发送" }) as HTMLButtonElement).disabled).toBe(true);
    expect(state.mutate).not.toHaveBeenCalled();
  });
});
