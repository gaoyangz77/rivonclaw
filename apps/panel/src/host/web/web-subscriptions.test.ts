import { describe, expect, it, vi } from "vitest";
import { HOST_SHARED_EVENTS } from "../host-adapter.js";
import { SUBSCRIPTION_SPECS, createWebSubscriptions } from "./web-subscriptions.js";
import type { WebHostStore } from "./web-bootstrap.js";

function setup() {
  const sinks = new Map<string, { next(r: unknown): void }>();
  const clientOptions: { on?: { connected?: () => void }; connectionParams?: () => unknown }[] = [];
  const fakeClient = {
    subscribe: vi.fn((payload: { query: string; variables?: unknown }, sink: { next(r: unknown): void }) => {
      sinks.set(payload.query, sink);
      return vi.fn();
    }),
    dispose: vi.fn(),
  };
  const store = {
    ingestGraphQLResponse: vi.fn(),
    upsertShopsFromGraphQL: vi.fn(),
    shopIds: () => ["shop-1", "shop-2"],
  } as unknown as WebHostStore;
  const request = vi.fn();
  const emit = vi.fn();
  const onReconnected = vi.fn();
  const subscriptions = createWebSubscriptions({
    wsUrl: "ws://x/api/graphql",
    session: { getAccessToken: async () => "tok" } as never,
    store,
    request,
    emit,
    onReconnected,
    createClientImpl: ((options: never) => {
      clientOptions.push(options);
      return fakeClient;
    }) as never,
  });
  const push = (field: string, payload: unknown) => {
    const spec = SUBSCRIPTION_SPECS.find((s) => s.field === field)!;
    sinks.get(spec.query)!.next({ data: { [field]: payload } });
  };
  return { subscriptions, fakeClient, store, request, emit, onReconnected, push, clientOptions };
}

describe("backend subscriptions to host events", () => {
  it("opens one subscription per shared backend event, scoping CS conversations to the user's shops", () => {
    const { subscriptions, fakeClient } = setup();
    subscriptions.start();
    expect(fakeClient.subscribe).toHaveBeenCalledTimes(SUBSCRIPTION_SPECS.length);
    const cs = fakeClient.subscribe.mock.calls.find((c) => c[0].query.includes("csConversationChanged"));
    expect(cs![0].variables).toEqual({ shopIds: ["shop-1", "shop-2"] });
  });

  it("covers every shared event except the two the local feed does not stream", () => {
    const produced = new Set<string>();
    const { subscriptions, emit, push, request } = setup();
    request.mockResolvedValue({});
    subscriptions.start();
    const payloads: Record<string, unknown> = {
      oauthComplete: { shops: [] },
      shopUpdated: { id: "s", shopName: "S" },
      adsOAuthComplete: { advertiserIds: [] },
      affiliateOutreachAccountConnected: {},
      csEscalationEvent: {},
      csConversationChanged: {},
      affiliateWorkItemChanged: {},
      affiliateActionProposalChanged: {},
      affiliateWorkbenchChanged: {},
      affiliateEscalationChanged: {},
    };
    for (const [field, payload] of Object.entries(payloads)) push(field, payload);
    return vi.waitFor(() => {
      for (const call of emit.mock.calls) produced.add(call[0]);
      const expected = HOST_SHARED_EVENTS.filter((e) => e !== "entity-snapshot" && e !== "entity-patch");
      expect([...produced].sort()).toEqual([...expected].sort());
    });
  });

  it("upserts OAuth shops into the store before announcing completion", () => {
    const { subscriptions, store, emit, push } = setup();
    subscriptions.start();
    const payload = { shops: [{ id: "s1" }] };
    push("oauthComplete", payload);
    expect(store.upsertShopsFromGraphQL).toHaveBeenCalledWith(payload.shops, "oauth-complete");
    expect(emit).toHaveBeenCalledWith("oauth-complete", payload);
  });

  it("writes a pushed shop into the store and announces it by id and name", () => {
    const { subscriptions, store, emit, push } = setup();
    subscriptions.start();
    push("shopUpdated", { id: "s1", shopName: "Brightloom" });
    expect(store.ingestGraphQLResponse).toHaveBeenCalledWith({ shopUpdated: { id: "s1", shopName: "Brightloom" } });
    expect(emit).toHaveBeenCalledWith("shop-updated", { shopId: "s1", shopName: "Brightloom" });
  });

  it("wraps payloads the way the Desktop events carry them", () => {
    const { subscriptions, emit, push } = setup();
    subscriptions.start();
    push("affiliateActionProposalChanged", { id: "p" });
    push("affiliateWorkItemChanged", { id: "w" });
    push("csConversationChanged", { conversationId: "c" });
    push("affiliateEscalationChanged", { escalationId: "e" });
    push("affiliateWorkbenchChanged", { creatorRelationshipId: "r", shopIds: [] });
    expect(emit).toHaveBeenCalledWith("affiliate-action-proposal-changed", { proposal: { id: "p" } });
    expect(emit).toHaveBeenCalledWith("affiliate-work-item-changed", { workItem: { id: "w" } });
    expect(emit).toHaveBeenCalledWith("cs-conversation-changed", { conversation: { conversationId: "c" } });
    expect(emit).toHaveBeenCalledWith("affiliate-escalation-changed", { change: { escalationId: "e" } });
    expect(emit).toHaveBeenCalledWith("affiliate-workbench-changed", { creatorRelationshipId: "r", shopIds: [] });
  });

  it("refreshes the Ads accounts before announcing an Ads authorization", async () => {
    const { subscriptions, store, request, emit, push } = setup();
    request.mockResolvedValue({ adsAdvertisers: [{ id: "a" }] });
    subscriptions.start();
    push("adsOAuthComplete", { advertiserIds: ["a"] });
    await vi.waitFor(() => expect(emit).toHaveBeenCalledWith("ads-oauth-complete", { advertiserIds: ["a"] }));
    expect(store.ingestGraphQLResponse).toHaveBeenCalledWith({ adsAdvertisers: [{ id: "a" }] });
  });

  it("authenticates the socket with the current token and reports a reconnect, not the first connect", async () => {
    const { subscriptions, clientOptions, onReconnected } = setup();
    subscriptions.start();
    const options = clientOptions[0]!;
    await expect((options.connectionParams as () => Promise<unknown>)()).resolves.toEqual({
      authorization: "Bearer tok",
    });
    options.on!.connected!();
    expect(onReconnected).not.toHaveBeenCalled();
    options.on!.connected!();
    expect(onReconnected).toHaveBeenCalledOnce();
  });

  it("logs a subscription payload it cannot use instead of dropping it silently", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { subscriptions, emit, fakeClient } = setup();
    subscriptions.start();
    const sink = fakeClient.subscribe.mock.calls[0]![1] as { next(r: unknown): void };
    sink.next({ errors: [{ message: "denied" }] });
    expect(emit).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
