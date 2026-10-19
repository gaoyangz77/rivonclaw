import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useWorkbenchPagination } from "./useWorkbenchPagination.js";

interface Row {
  id: string;
  state: string;
}
interface Page {
  items: Row[];
  nextCursor: string | null;
  hasMore: boolean;
  count: number;
}
const page = (ids: number[], cursor: string | null, state = "pending"): Page => ({
  items: ids.map((id) => ({ id: String(id), state })),
  nextCursor: cursor,
  hasMore: Boolean(cursor),
  count: 100,
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}
function setup(firstPage = page([1, 2], "after-2")) {
  const fetchPage = vi.fn<(cursor: string | null) => Promise<Page | undefined>>();
  const onError = vi.fn<(error: unknown) => "refresh" | void>();
  const initialProps = { filterKey: "pending", firstPage, refreshRevision: 0 };
  const hook = renderHook(
    (props: typeof initialProps) =>
      useWorkbenchPagination<Row, Page>({
        ...props,
        fetchPage,
        onError,
      }),
    { initialProps },
  );
  const ids = () => hook.result.current.items.map((row) => row.id);
  return { ...hook, fetchPage, onError, initialProps, ids };
}
afterEach(cleanup);

describe("workbench loaded-range refresh", () => {
  it("revalidates every loaded page atomically, removes handled rows and advances the cursor", async () => {
    const h = setup();
    h.fetchPage.mockResolvedValueOnce(page([3, 4], "after-4"));
    await act(() => h.result.current.loadMore());
    expect(h.ids()).toEqual(["1", "2", "3", "4"]);
    const tail = deferred<Page>();
    h.fetchPage.mockResolvedValueOnce({ ...page([2, 3], "new-after-3"), count: 99 });
    h.fetchPage.mockReturnValueOnce(tail.promise);
    h.rerender({ ...h.initialProps, refreshRevision: 1 });
    await waitFor(() => expect(h.fetchPage).toHaveBeenLastCalledWith("new-after-3"));
    expect(h.ids()).toEqual(["1", "2", "3", "4"]);
    expect(h.result.current.loading).toBe(true);
    await act(async () => {
      tail.resolve(page([5, 6], "after-6"));
    });
    expect(h.ids()).toEqual(["2", "3", "5", "6"]);
    expect(h.result.current.firstPage?.count).toBe(99);
    h.fetchPage.mockResolvedValueOnce(page([7], null));
    await act(() => h.result.current.loadMore());
    expect(h.fetchPage).toHaveBeenLastCalledWith("after-6");
    expect(h.ids()).toEqual(["2", "3", "5", "6", "7"]);
    expect(h.result.current.hasMore).toBe(false);
  });

  it("refreshes changed tail rows even when the first page is unchanged", async () => {
    const h = setup();
    h.fetchPage.mockResolvedValueOnce(page([3, 4], null));
    await act(() => h.result.current.loadMore());
    h.fetchPage.mockResolvedValueOnce(h.initialProps.firstPage);
    h.fetchPage.mockResolvedValueOnce(page([4, 5], null, "updated"));
    h.rerender({ ...h.initialProps, refreshRevision: 1 });
    await waitFor(() => expect(h.ids()).toEqual(["1", "2", "4", "5"]));
    expect(h.result.current.items[2].state).toBe("updated");
    expect(h.result.current.hasMore).toBe(false);
    expect(h.fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual(["after-2", null, "after-2"]);
  });

  it("reconciles a changed cached first page without dropping later pages", async () => {
    const h = setup();
    h.fetchPage.mockResolvedValueOnce(page([3, 4], "after-4"));
    await act(() => h.result.current.loadMore());
    const tail = deferred<Page>();
    h.fetchPage.mockReturnValueOnce(tail.promise);
    h.rerender({ ...h.initialProps, firstPage: page([0, 1], "new-after-1") });
    expect(h.ids()).toEqual(["1", "2", "3", "4"]);
    await act(async () => {
      tail.resolve(page([2, 3], "new-after-3"));
    });
    expect(h.ids()).toEqual(["0", "1", "2", "3"]);
    expect(h.result.current.nextCursor).toBe("new-after-3");
  });

  it("serializes duplicate clicks and queues a refresh received during load-more", async () => {
    const h = setup();
    const more = deferred<Page>();
    h.fetchPage.mockReturnValueOnce(more.promise);
    let request!: Promise<void>;
    act(() => {
      request = h.result.current.loadMore();
      void h.result.current.loadMore();
    });
    expect(h.fetchPage).toHaveBeenCalledTimes(1);
    h.rerender({ ...h.initialProps, refreshRevision: 1 });
    h.rerender({ ...h.initialProps, refreshRevision: 2 });
    h.fetchPage.mockResolvedValueOnce(page([2, 3], "new-after-3"));
    h.fetchPage.mockResolvedValueOnce(page([4, 5], "after-5"));
    await act(async () => {
      more.resolve(page([3, 4], "after-4"));
      await request;
    });
    expect(h.ids()).toEqual(["2", "3", "4", "5"]);
    expect(h.fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([
      "after-2",
      null,
      "new-after-3",
    ]);
  });

  it("discards a stale response even after filters change from A to B to A", async () => {
    const h = setup();
    const old = deferred<Page>();
    h.fetchPage.mockReturnValueOnce(old.promise);
    let request!: Promise<void>;
    act(() => {
      request = h.result.current.loadMore();
    });
    h.rerender({ ...h.initialProps, filterKey: "resolved", firstPage: page([8], null) });
    expect(h.ids()).toEqual(["8"]);
    h.rerender(h.initialProps);
    expect(h.ids()).toEqual(["1", "2"]);
    await act(async () => {
      old.resolve(page([3, 4], null));
      await request;
    });
    expect(h.ids()).toEqual(["1", "2"]);
    expect(h.result.current.nextCursor).toBe("after-2");
  });

  it("preserves rows and the cursor after a partial refresh fails, and supports retry", async () => {
    const h = setup();
    h.fetchPage.mockResolvedValueOnce(page([3, 4], "after-4"));
    await act(() => h.result.current.loadMore());
    const failure = new Error("offline");
    h.fetchPage.mockResolvedValueOnce(page([2, 3], "new-after-3"));
    h.fetchPage.mockRejectedValueOnce(failure);
    await act(() => h.result.current.refresh());
    expect(h.ids()).toEqual(["1", "2", "3", "4"]);
    expect(h.result.current.nextCursor).toBe("after-4");
    expect(h.onError).toHaveBeenCalledWith(failure);
    expect(h.result.current.loading).toBe(false);
    h.fetchPage.mockResolvedValueOnce(page([2, 3], "new-after-3"));
    h.fetchPage.mockResolvedValueOnce(page([4, 5], null));
    await act(() => h.result.current.refresh());
    expect(h.ids()).toEqual(["2", "3", "4", "5"]);
  });

  it("recovers a stale cursor once, using fresh cursors to rebuild the loaded range", async () => {
    const h = setup();
    h.fetchPage.mockResolvedValueOnce(page([3, 4], "after-4"));
    await act(() => h.result.current.loadMore());
    h.onError.mockReturnValue("refresh");
    h.fetchPage.mockRejectedValueOnce(new Error("stale cursor"));
    h.fetchPage.mockResolvedValueOnce(page([2, 3], "new-after-3"));
    h.fetchPage.mockResolvedValueOnce(page([4, 5], "after-5"));
    await act(() => h.result.current.loadMore());
    expect(h.ids()).toEqual(["2", "3", "4", "5"]);
    expect(h.fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([
      "after-2",
      "after-4",
      null,
      "new-after-3",
    ]);
    h.fetchPage.mockRejectedValue(new Error("still stale"));
    await act(() => h.result.current.loadMore());
    expect(h.fetchPage).toHaveBeenCalledTimes(6);
    expect(h.ids()).toEqual(["2", "3", "4", "5"]);
  });

  it("accepts an empty refreshed range and stops before requesting nonexistent pages", async () => {
    const h = setup();
    h.fetchPage.mockResolvedValueOnce(page([3, 4], null));
    await act(() => h.result.current.loadMore());
    h.fetchPage.mockResolvedValueOnce(page([], null));
    await act(() => h.result.current.refresh());
    expect(h.ids()).toEqual([]);
    expect(h.result.current.loaded).toBe(true);
    expect(h.result.current.hasMore).toBe(false);
    expect(h.fetchPage).toHaveBeenCalledTimes(2);
  });
});


it("cancels a hidden tab's request, preserves its loaded range, and revalidates when enabled", async () => {
  const first = page([1, 2], "after-2");
  const fetchPage = vi.fn<(cursor: string | null) => Promise<Page>>();
  const onError = vi.fn();
  const { result, rerender } = renderHook(({ enabled }) => useWorkbenchPagination<Row, Page>({
    filterKey: "same-creator", firstPage: first, enabled, fetchPage, onError,
  }), { initialProps: { enabled: true } });
  fetchPage.mockResolvedValueOnce(page([3, 4], "after-4"));
  await act(() => result.current.loadMore());
  const old = deferred<Page>();
  fetchPage.mockReturnValueOnce(old.promise);
  let request!: Promise<void>;
  act(() => { request = result.current.refresh(); });
  rerender({ enabled: false });
  await act(async () => { old.reject(new Error("late inactive failure")); await request; });
  expect(onError).not.toHaveBeenCalled();
  expect(result.current.items.map(row => row.id)).toEqual(["1", "2", "3", "4"]);
  const count = fetchPage.mock.calls.length;
  await act(() => result.current.refresh());
  expect(fetchPage).toHaveBeenCalledTimes(count);
  fetchPage.mockResolvedValueOnce(page([3, 5], null));
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.items.map(row => row.id)).toEqual(["1", "2", "3", "5"]));
});
