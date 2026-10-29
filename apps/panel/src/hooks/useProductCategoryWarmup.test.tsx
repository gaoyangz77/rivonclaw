import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { store } = vi.hoisted(() => ({
  store: {
    currentUser: { userId: "owner" } as { userId: string } | null,
    categorySession: 1,
    ensureCategories: vi.fn(),
  },
}));
vi.mock("../store/entity-store.js", () => ({ entityStore: store }));
import { useProductCategoryWarmup } from "./useProductCategoryWarmup.js";

let callbacks: Map<number, IdleRequestCallback>;
let nextId: number;
const requestIdle = vi.fn((callback: IdleRequestCallback) => {
  const id = ++nextId;
  callbacks.set(id, callback);
  return id;
});
const cancelIdle = vi.fn((id: number) => callbacks.delete(id));
function runIdle() {
  act(() => {
    for (const [id, callback] of callbacks) {
      callbacks.delete(id);
      callback({ didTimeout: false, timeRemaining: () => 50 });
    }
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  callbacks = new Map();
  nextId = 0;
  requestIdle.mockClear();
  cancelIdle.mockClear();
  store.currentUser = { userId: "owner" };
  store.categorySession = 1;
  store.ensureCategories.mockReset().mockResolvedValue(undefined);
  vi.stubGlobal("requestIdleCallback", requestIdle);
  vi.stubGlobal("cancelIdleCallback", cancelIdle);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("idle category preloading", () => {
  it("waits for startup completion, the initial delay, and an idle callback", () => {
    const { rerender } = renderHook(
      ({ enabled }) => useProductCategoryWarmup("owner", 1, "zh", enabled),
      { initialProps: { enabled: false } },
    );
    act(() => vi.advanceTimersByTime(10_000));
    expect(requestIdle).not.toHaveBeenCalled();
    rerender({ enabled: true });
    act(() => vi.advanceTimersByTime(4_999));
    expect(requestIdle).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(requestIdle).toHaveBeenCalledTimes(1);
    expect(store.ensureCategories).not.toHaveBeenCalled();
    runIdle();
    expect(store.ensureCategories).toHaveBeenCalledExactlyOnceWith("zh");
  });

  it("cancels pending work and rejects stale callbacks after account replacement", () => {
    const { rerender } = renderHook(
      ({ session }) => useProductCategoryWarmup("owner", session, "zh", true),
      { initialProps: { session: 1 } },
    );
    act(() => vi.advanceTimersByTime(5_000));
    const stale = [...callbacks.values()][0];
    store.categorySession = 2;
    rerender({ session: 2 });
    expect(cancelIdle).toHaveBeenCalledWith(1);
    act(() => stale({ didTimeout: false, timeRemaining: () => 50 }));
    expect(store.ensureCategories).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(5_000));
    runIdle();
    expect(store.ensureCategories).toHaveBeenCalledExactlyOnceWith("zh");
  });

  it("cancels the startup delay on unmount", () => {
    const { unmount } = renderHook(() => useProductCategoryWarmup("owner", 1, "zh", true));
    unmount();
    act(() => vi.advanceTimersByTime(10_000));
    expect(requestIdle).not.toHaveBeenCalled();
    expect(store.ensureCategories).not.toHaveBeenCalled();
  });

  it("loads each selected locale without requesting a forced refresh", () => {
    const { rerender } = renderHook(
      ({ locale }) => useProductCategoryWarmup("owner", 1, locale, true),
      { initialProps: { locale: "zh" } },
    );
    for (const locale of ["zh", "en", "zh"]) {
      rerender({ locale });
      act(() => vi.advanceTimersByTime(5_000));
      runIdle();
    }
    expect(store.ensureCategories.mock.calls).toEqual([["zh"], ["en"], ["zh"]]);
  });

  it("uses a deferred fallback when idle callbacks are unavailable", () => {
    vi.stubGlobal("requestIdleCallback", undefined);
    renderHook(() => useProductCategoryWarmup("owner", 1, "zh", true));
    act(() => vi.advanceTimersByTime(5_999));
    expect(store.ensureCategories).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(store.ensureCategories).toHaveBeenCalledExactlyOnceWith("zh");
  });
});
