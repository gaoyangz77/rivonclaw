import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { panelEventBus } from "../../lib/event-bus.js";
import { useAffiliateWorkbenchRefresh } from "./useAffiliateWorkbenchRefresh.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

it("coalesces UI refreshes, filters the modal relationship, and cancels on unmount", () => {
  vi.useFakeTimers();
  let receive: (payload: unknown) => void = () => {};
  const unsubscribe = vi.fn();
  vi.spyOn(panelEventBus, "subscribe").mockImplementation((event, handler) => {
    if (event === "affiliate-workbench-changed") {
      receive = handler;
      return unsubscribe;
    }
    return vi.fn();
  });
  const refresh = vi.fn();
  const { unmount } = renderHook(() => useAffiliateWorkbenchRefresh(refresh, "creator-one"));
  act(() => {
    receive({ creatorRelationshipId: "creator-two" });
    vi.advanceTimersByTime(250);
  });
  expect(refresh).not.toHaveBeenCalled();
  act(() => {
    receive({ creatorRelationshipId: "creator-one" });
    receive({ creatorRelationshipId: "creator-one" });
    vi.advanceTimersByTime(250);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
  act(() => receive({ creatorRelationshipId: "creator-one" }));
  unmount();
  act(() => vi.advanceTimersByTime(250));
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});

it("refreshes the workbench for any relationship without a modal scope", () => {
  vi.useFakeTimers();
  let receive: (payload: unknown) => void = () => {};
  vi.spyOn(panelEventBus, "subscribe").mockImplementation((_event, handler) => {
    receive = handler;
    return vi.fn();
  });
  const refresh = vi.fn();
  renderHook(() => useAffiliateWorkbenchRefresh(refresh));
  act(() => {
    receive({ creatorRelationshipId: "public-creator" });
    vi.advanceTimersByTime(250);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
});

it("defers hidden-window refresh until the page is visible again", () => {
  vi.useFakeTimers();
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
  let receive: (payload: unknown) => void = () => {};
  vi.spyOn(panelEventBus, "subscribe").mockImplementation((_event, handler) => {
    receive = handler;
    return vi.fn();
  });
  const refresh = vi.fn();
  renderHook(() => useAffiliateWorkbenchRefresh(refresh));
  act(() => {
    receive({ creatorRelationshipId: "public-creator" });
    vi.advanceTimersByTime(1000);
  });
  expect(refresh).not.toHaveBeenCalled();
  hidden.mockReturnValue(false);
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(250);
  });
  expect(refresh).toHaveBeenCalledTimes(1);
});
