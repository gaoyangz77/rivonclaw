import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export interface WorkbenchPage<Row> {
  items: Row[];
  nextCursor?: string | null;
  hasMore: boolean;
}

interface PageBuffer<Row, Page extends WorkbenchPage<Row>> {
  filterKey: string;
  firstPage: Page | undefined;
  items: Row[];
  pageCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

interface Options<Row, Page extends WorkbenchPage<Row>> {
  filterKey: string;
  firstPage: Page | undefined;
  refreshRevision: number;
  /** Read a page without replacing the observed first-page query in Apollo. */
  fetchPage: (cursor: string | null) => Promise<Page | undefined>;
  /** A changed product binding can invalidate a cursor; retry once from page 1. */
  onError: (error: unknown) => "refresh" | void;
}

function emptyBuffer<Row, Page extends WorkbenchPage<Row>>(
  filterKey: string,
): PageBuffer<Row, Page> {
  return {
    filterKey,
    firstPage: undefined,
    items: [],
    pageCount: 0,
    nextCursor: null,
    hasMore: false,
  };
}

function uniqueRows<Row extends { id: string }>(rows: Row[]): Row[] {
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

/**
 * Workbench facts change while a seller reviews later pages. Revalidate the
 * whole loaded range with fresh, chained cursors and publish it atomically.
 * Merely merging page 1 into an old tail would retain handled/deleted rows;
 * replacing it would collapse the list after every SSE/focus refresh.
 */
export function useWorkbenchPagination<Row extends { id: string }, Page extends WorkbenchPage<Row>>(
  options: Options<Row, Page>,
) {
  const { filterKey, firstPage, refreshRevision } = options;
  const [buffer, setBuffer] = useState<PageBuffer<Row, Page>>(() => emptyBuffer(filterKey));
  const [busyKey, setBusyKey] = useState<string | null>(null);
  // These are plain Apollo result snapshots and request state, never MST nodes.
  const bufferRef = useRef(buffer);
  const optionsRef = useRef(options);
  const scopeRef = useRef({ filterKey, running: false, refreshing: false, refreshQueued: false });
  useLayoutEffect(() => {
    optionsRef.current = options;
    if (scopeRef.current.filterKey !== filterKey) {
      // Object identity invalidates requests even after A -> B -> A filters.
      scopeRef.current = { filterKey, running: false, refreshing: false, refreshQueued: false };
      setBusyKey(null);
    }
  });

  const commit = useCallback((next: PageBuffer<Row, Page>) => {
    bufferRef.current = next;
    setBuffer(next);
  }, []);

  const run = useCallback(
    async (mode: "more" | "refresh", seed?: Page) => {
      const scope = scopeRef.current;
      if (scope.running) {
        if (mode === "refresh") scope.refreshQueued = true;
        return;
      }
      const request = optionsRef.current;
      const currentBuffer =
        bufferRef.current.filterKey === scope.filterKey
          ? bufferRef.current
          : emptyBuffer<Row, Page>(scope.filterKey);
      if (mode === "more" && (!currentBuffer.hasMore || !currentBuffer.nextCursor)) return;
      scope.running = true;
      setBusyKey(scope.filterKey);
      const active = () => scopeRef.current === scope;
      let cursorRecovered = false;
      try {
        do {
          scope.refreshQueued = false;
          scope.refreshing = mode === "refresh";
          const current =
            bufferRef.current.filterKey === scope.filterKey
              ? bufferRef.current
              : emptyBuffer<Row, Page>(scope.filterKey);
          try {
            if (mode === "more") {
              const next = await request.fetchPage(current.nextCursor);
              if (!active() || !next) return;
              commit({
                ...current,
                items: uniqueRows([...current.items, ...next.items]),
                pageCount: current.pageCount + 1,
                nextCursor: next.nextCursor ?? null,
                hasMore: next.hasMore,
              });
            } else {
              let page = seed ?? (await request.fetchPage(null));
              if (!active() || !page) return;
              const refreshedFirstPage = page;
              let items = page.items;
              let pageCount = 1;
              while (pageCount < current.pageCount && page.hasMore && page.nextCursor) {
                page = await request.fetchPage(page.nextCursor);
                if (!active() || !page) return;
                items = [...items, ...page.items];
                pageCount += 1;
              }
              commit({
                filterKey: scope.filterKey,
                firstPage: refreshedFirstPage,
                items: uniqueRows(items),
                pageCount,
                nextCursor: page.nextCursor ?? null,
                hasMore: page.hasMore,
              });
            }
          } catch (error) {
            if (!active()) return;
            const recovery = request.onError(error);
            if (recovery === "refresh" && !cursorRecovered) {
              cursorRecovered = true;
              scope.refreshQueued = true;
            }
          }
          mode = "refresh";
          seed = undefined;
        } while (active() && scope.refreshQueued);
      } finally {
        if (active()) {
          scope.running = false;
          scope.refreshing = false;
          setBusyKey(null);
        }
      }
    },
    [commit],
  );

  useEffect(() => {
    if (!firstPage) return;
    const scope = scopeRef.current;
    if (scope.running) {
      // A cache update during pagination must be checked after the append.
      if (!scope.refreshing) scope.refreshQueued = true;
      return;
    }
    const current = bufferRef.current;
    if (current.filterKey === filterKey && current.pageCount > 1) {
      void run("refresh", firstPage);
    } else {
      commit({
        filterKey,
        firstPage,
        items: uniqueRows(firstPage.items),
        pageCount: 1,
        nextCursor: firstPage.nextCursor ?? null,
        hasMore: firstPage.hasMore,
      });
    }
  }, [commit, filterKey, firstPage, run]);

  const lastRevision = useRef(refreshRevision);
  useEffect(() => {
    if (lastRevision.current === refreshRevision) return;
    lastRevision.current = refreshRevision;
    void run("refresh");
  }, [refreshRevision, run]);
  useEffect(
    () => () => {
      // Unmounted tabs cannot commit responses or display their errors.
      scopeRef.current = { filterKey: "", running: false, refreshing: false, refreshQueued: false };
    },
    [],
  );

  const active = buffer.filterKey === filterKey ? buffer : emptyBuffer<Row, Page>(filterKey);
  return {
    ...active,
    loaded: active.pageCount > 0,
    loading: busyKey === filterKey,
    loadMore: useCallback(() => run("more"), [run]),
    refresh: useCallback(() => run("refresh"), [run]),
  };
}
