import type { ReactNode } from "react";
import type { DocumentNode, SelectionSetNode } from "graphql";
import { MockedProvider } from "@apollo/client/testing/react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AFFILIATE_CREATOR_MESSAGE_HISTORY_QUERY as HISTORY,
  AFFILIATE_RELATIONSHIP_TIMELINE_QUERY as TIMELINE,
} from "../../../api/shops-queries.js";
import { useCreatorScopeConversation } from "./useCreatorScopeConversation.js";

afterEach(cleanup);
const base = { creatorRelationshipId: "creator", limit: 25 };
const shopInput = (shop: string, cursor?: string) => ({
  ...base,
  shopIds: [shop],
  itemTypes: ["MESSAGE"],
  ...(cursor ? { cursor } : {}),
});
const msg = (id: string, shopId: string | null, createdAt = "2026-09-08T12:00:00Z") => ({
  messageRef: id,
  shopId,
  createdAt,
  channel: "PLATFORM_CHAT",
  source: "test",
  parts: [{ kind: "TEXT", text: id }],
});
const entry = (id: string, shopId: string | null, occurredAt?: string) => ({
  id,
  kind: "MESSAGE",
  occurredAt: occurredAt ?? "2026-09-08T12:00:00Z",
  summary: id,
  relatedIds: { shopId },
  message: msg(id, shopId),
});

// Populate optional selected fields explicitly to exercise Apollo cache without missing-field warnings.
function selectedFields(
  set: SelectionSetNode,
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    set.selections.flatMap((field) => {
      if (field.kind !== "Field") return [];
      const key = field.name.value;
      const item = value[key] ?? null;
      return [
        [
          key,
          field.selectionSet && item != null
            ? Array.isArray(item)
              ? item.map((row) => selectedFields(field.selectionSet!, row))
              : selectedFields(field.selectionSet, item as Record<string, unknown>)
            : item,
        ],
      ];
    }),
  );
}
function mock(query: DocumentNode, input: object, payload: Record<string, unknown>, delay = 0) {
  const operation = query.definitions.find((item) => item.kind === "OperationDefinition")!;
  if (operation.kind !== "OperationDefinition") throw new Error("missing operation");
  const result = vi.fn(() => ({ data: selectedFields(operation.selectionSet, payload) }));
  return { request: { query, variables: { input } }, result, delay };
}
function history(items: object[], nextOffset: number | null = null) {
  return {
    affiliateCreatorMessageHistory: {
      items,
      offset: 0,
      limit: 25,
      nextOffset,
      hasMore: nextOffset !== null,
    },
  };
}
function timeline(items: object[], olderCursor: string | null = null) {
  return {
    affiliateRelationshipTimeline: {
      items,
      limit: 25,
      readAt: "2026-09-08T12:00:00Z",
      realItemCount: items.length,
      olderCursor,
      hasOlder: olderCursor !== null,
    },
  };
}

describe("creator scoped conversation API and pagination", () => {
  it("keeps global history, queries a shop with existing timeline filters, and returns to global", async () => {
    const global = history([msg("global", null), msg("other", "2", "2026-09-07T12:00:00Z")]);
    const mocks = [
      mock(HISTORY, base, global),
      mock(
        TIMELINE,
        shopInput("1"),
        timeline([entry("own", "1"), entry("unknown", null), entry("other", "2")]),
      ),
      mock(HISTORY, base, global),
    ];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MockedProvider mocks={mocks}>{children}</MockedProvider>
    );
    const { result, rerender } = renderHook(
      ({ shop }) => useCreatorScopeConversation("creator", shop),
      { initialProps: { shop: "" }, wrapper },
    );
    await waitFor(() =>
      expect(result.current.messages.map((m) => m.messageRef)).toEqual(["other", "global"]),
    );
    rerender({ shop: "1" });
    await waitFor(() => expect(result.current.messages.map((m) => m.messageRef)).toEqual(["own"]));
    expect(mocks[1].result).toHaveBeenCalledOnce();
    rerender({ shop: "" });
    await waitFor(() =>
      expect(result.current.messages.map((m) => m.messageRef)).toEqual(["other", "global"]),
    );
  });

  it("can load older even when the first page has only global messages, keeping shop/type/cursor filters", async () => {
    const mocks = [
      mock(TIMELINE, shopInput("1"), timeline([entry("global", null)], "cursor-1")),
      mock(
        TIMELINE,
        shopInput("1", "cursor-1"),
        timeline([entry("own", "1", "2026-09-07T12:00:00Z"), entry("global", null)]),
      ),
    ];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MockedProvider mocks={mocks}>{children}</MockedProvider>
    );
    const { result } = renderHook(() => useCreatorScopeConversation("creator", "1"), { wrapper });
    await waitFor(() => expect(result.current.hasOlder).toBe(true));
    expect(result.current.messages).toEqual([]);
    await act(async () => {
      await result.current.loadOlder();
    });
    await waitFor(() => expect(result.current.messages.map((m) => m.messageRef)).toEqual(["own"]));
    expect(result.current.hasOlder).toBe(false);
    expect(mocks[1].result).toHaveBeenCalledOnce();
  });

  it("does not leak a late older-page response into a newly selected shop", async () => {
    const mocks = [
      mock(TIMELINE, shopInput("1"), timeline([entry("one", "1")], "older")),
      mock(TIMELINE, shopInput("1", "older"), timeline([entry("old-one", "1")]), 50),
      mock(TIMELINE, shopInput("2"), timeline([entry("two", "2")])),
    ];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MockedProvider mocks={mocks}>{children}</MockedProvider>
    );
    const { result, rerender } = renderHook(
      ({ shop }) => useCreatorScopeConversation("creator", shop),
      { initialProps: { shop: "1" }, wrapper },
    );
    await waitFor(() => expect(result.current.hasOlder).toBe(true));
    let pending: Promise<void>;
    act(() => {
      pending = result.current.loadOlder();
    });
    rerender({ shop: "2" });
    await act(async () => {
      await pending!;
    });
    await waitFor(() => expect(result.current.messages.map((m) => m.messageRef)).toEqual(["two"]));
  });

  it("deduplicates global offset pages and preserves ascending order", async () => {
    const latest = msg("new", "1");
    const mocks = [
      mock(HISTORY, base, history([latest], 25)),
      mock(
        HISTORY,
        { ...base, offset: 25 },
        history([msg("old", null, "2026-09-01T12:00:00Z"), latest]),
      ),
    ];
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MockedProvider mocks={mocks}>{children}</MockedProvider>
    );
    const { result } = renderHook(() => useCreatorScopeConversation("creator", ""), { wrapper });
    await waitFor(() => expect(result.current.hasOlder).toBe(true));
    await act(async () => {
      await result.current.loadOlder();
    });
    await waitFor(() =>
      expect(result.current.messages.map((m) => m.messageRef)).toEqual(["old", "new"]),
    );
    expect(result.current.hasOlder).toBe(false);
  });

  it("retries errors with the same shop scope", async () => {
    const failure = {
      request: { query: TIMELINE, variables: { input: shopInput("1") } },
      error: new Error("offline"),
      delay: 0,
    };
    const success = mock(TIMELINE, shopInput("1"), timeline([entry("one", "1")]));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MockedProvider mocks={[failure, success]}>{children}</MockedProvider>
    );
    const { result } = renderHook(() => useCreatorScopeConversation("creator", "1"), { wrapper });
    await waitFor(() => expect(result.current.error?.message).toBe("offline"));
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.messages.map((m) => m.messageRef)).toEqual(["one"]);
  });
});
